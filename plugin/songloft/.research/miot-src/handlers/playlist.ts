// MIoT 智能音箱插件 - 歌单播放 Handler
// 翻译自 Go 源码: plugins/songloft-plugin-xiaomi/handlers/playlist_handler.go

import { jsonResponse, parseQuery } from '@songloft/plugin-sdk';
import type { Router, HTTPRequest } from '@songloft/plugin-sdk';
import { PlaylistManagerMap, isTempPlaylistId } from '../player/manager';
import type { PlaylistManager } from '../player/manager';
import { MinaService } from '../service/service';
import { ConfigManager } from '../config/manager';
import { callHostAPI } from '../utils/http';
import type { PlayMode, PlayState } from '../types';

/** 解析请求体（兼容 Uint8Array 和 string） */
function parseBody(req: HTTPRequest): any {
  if (!req.body) return {};
  try {
    const str = typeof req.body === 'string'
      ? req.body
      : String.fromCharCode.apply(null, Array.from(req.body as Uint8Array));
    return JSON.parse(str);
  } catch {
    return {};
  }
}

/** 判断是否为本地回环地址 */
function isLoopbackAddress(host: string): boolean {
  if (!host) return false;
  let hostname = host;
  const protoIdx = host.indexOf('://');
  if (protoIdx >= 0) {
    const rest = host.slice(protoIdx + 3);
    const slashIdx = rest.indexOf('/');
    const colonIdx = rest.indexOf(':');
    hostname = rest.slice(0, slashIdx >= 0 ? slashIdx : (colonIdx >= 0 ? colonIdx : undefined));
  }
  hostname = hostname.toLowerCase().trim();
  return hostname === 'localhost' || hostname.startsWith('127.') || hostname === '::1';
}

/** 设备播放状态缓存（避免多调用方重复查询设备） */
interface DeviceStatusCache {
  volume: number;
  state: string;
  position: number;  // 秒
  duration: number;  // 秒
  timestamp: number;
  volumeLockedUntil: number;  // 用户显式设置音量后锁定期截止时间戳
  // position 是否真的来自设备的 play_song_detail（而非本地推算/动作后的乐观写入）。
  // 只有设备实测位置才允许回写本地进度，见 syncManagerFromDeviceState。
  positionFromDevice: boolean;
}
const deviceStatusCache: Map<string, DeviceStatusCache> = new Map();
const deviceStatusInflight: Map<string, Promise<any>> = new Map();
export const DEVICE_STATUS_TTL = 4000; // 4秒缓存，略短于前端5秒轮询间隔

/** 主动更新设备状态缓存（供外部调用，如 playURL 成功后刷新） */
export function updateDeviceStatusCache(accountId: string, deviceId: string, data: Partial<DeviceStatusCache> & { lockVolume?: boolean }): void {
  const key = accountId + ':' + deviceId;
  const existing = deviceStatusCache.get(key);
  deviceStatusCache.set(key, {
    volume: data.volume ?? existing?.volume ?? -1,
    state: data.state ?? existing?.state ?? 'idle',
    position: data.position ?? existing?.position ?? 0,
    duration: data.duration ?? existing?.duration ?? 0,
    timestamp: Date.now(),
    volumeLockedUntil: data.lockVolume ? Date.now() + 10000 : (existing?.volumeLockedUntil ?? 0),
    // 外部写入（播放/暂停/停止动作后的乐观刷新）给的都是本地推算位置，不是设备实测
    positionFromDevice: data.positionFromDevice ?? false,
  });
}

/** 获取设备状态缓存 */
export function getDeviceStatusCache(accountId: string, deviceId: string): DeviceStatusCache | undefined {
  return deviceStatusCache.get(accountId + ':' + deviceId);
}

/** 同一设备的远程状态探针 in-flight 去重，避免并发轮询刷爆 Mina ubus。 */
export async function getOrFetchDeviceStatus(accountId: string, deviceId: string, fetcher: () => Promise<any>): Promise<any> {
  const key = accountId + ':' + deviceId;
  const existing = deviceStatusInflight.get(key);
  if (existing) {
    return existing;
  }

  const inflight = fetcher().finally(() => {
    if (deviceStatusInflight.get(key) === inflight) {
      deviceStatusInflight.delete(key);
    }
  });
  deviceStatusInflight.set(key, inflight);
  return inflight;
}

function syncManagerFromDeviceState(
  manager: PlaylistManager,
  localState: PlayState,
  deviceState: string,
  devicePosition: number,
  deviceReportsProgress: boolean,
): void {
  // 小爱在 URL/MUSIC 播放模式下会偶发把正常播放的流上报成 paused/stopped。
  // 读状态接口不能因此清掉本地自动切歌定时器；只有设备确认在播放时才用它校准恢复。
  if (localState === 'paused' && deviceState === 'playing') {
    // 只认「设备真的在推进」的上报。部分型号暂停后会持续上报 status=1 且不带
    // play_song_detail（位置退化为 0），此时校准会把已暂停播放器的 playStartTimeMs 改写成「现在」，
    // 导致网页进度条归零、续播位置算错（songloft-org/songloft-plugin-miot#60）。
    if (deviceReportsProgress) {
      manager.resetAutoNextTimer(devicePosition);
    }
  } else if (localState === 'playing' && deviceState === 'playing' && manager.isVoiceSuspended()) {
    manager.resetAutoNextTimer(devicePosition);
  } else if (localState === 'playing' && deviceState === 'playing') {
    // 远程歌曲需要缓冲时间，本地定时器从发送 URL 就开始计时，
    // 但设备要等缓冲完成才开始播放，导致本地位置显著超前设备实际位置。
    // 只在播放早期用设备实际位置校准定时器，防止歌曲提前切歌。
    // 歌曲接近结束后设备可能重拉同一首并上报小进度，此时不能回拨定时器，
    // 否则自动下一首会被无限推迟。
    const localPosition = manager.getPosition();
    if (localPosition - devicePosition >= 5 && manager.canCalibrateAutoNextTimer(devicePosition)) {
      manager.resetAutoNextTimer(devicePosition);
    }
  }
}

function resolveReportState(localState: PlayState, deviceState: string): string {
  if (localState === 'stopped') {
    return 'stopped';
  }
  if (localState === 'playing' && (deviceState === 'paused' || deviceState === 'stopped')) {
    return 'playing';
  }
  return deviceState;
}

function resolveReportPosition(localState: PlayState, deviceState: string, localPosition: number, devicePosition: number): number {
  if (localState === 'stopped') {
    return 0;
  }
  if (localState === 'playing' && deviceState !== 'playing') {
    return localPosition;
  }
  return devicePosition;
}

/**
 * 解析设备的播放状态（本地播放状态优先，设备数据用于音量/进度校准）。
 *
 * 抽取自原 `GET /player/status` handler，供 HTTP 端点与 WebSocket 推送循环
 * 共用同一份状态融合逻辑，避免两条链路结果漂移。返回的对象即前端消费的 `data`
 * 负载：`{ ...localStatus, state, position, duration, volume }`。
 */
export async function resolvePlayerStatus(
  playlistManagerMap: PlaylistManagerMap,
  minaService: MinaService,
  account_id: string,
  device_id: string,
): Promise<Record<string, any>> {
  const manager = await playlistManagerMap.getOrCreate(account_id, device_id);
  const localStatus = manager.getStatus();
  const cacheKey = account_id + ':' + device_id;
  const now = Date.now();

  // 带 seek 的续播流对设备是「从 0 开始的新流」，它上报的 position 只是流内偏移；
  // 加上偏移才是曲内绝对位置。不补的话续播后进度条会掉回 0（songloft-org/songloft-plugin-miot#60）。
  const seekOffset = manager.getStreamSeekOffsetSec();

  // 检查设备状态缓存（4秒内直接复用，避免多调用方重复查询设备）
  const cached = deviceStatusCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < DEVICE_STATUS_TTL) {
    const duration = localStatus.duration > 0 ? localStatus.duration : cached.duration;
    const cachedAbsPosition = cached.positionFromDevice ? cached.position + seekOffset : cached.position;

    // 播放中时用缓存position + 已过时间推算当前位置，避免返回过时进度
    let position = cachedAbsPosition;
    if (cached.state === 'playing' && duration > 0) {
      const elapsed = (now - cached.timestamp) / 1000;
      position = Math.min(cachedAbsPosition + elapsed, duration);
    }

    // 用被查询设备的物理进度校准共享切歌定时器。分组下无论查询哪个成员都可校准
    // （成员播放同一首、进度相近，校准收敛）；已有的近末尾/重拉守卫防止异常重置。
    syncManagerFromDeviceState(manager, localStatus.state, cached.state, cachedAbsPosition,
      cached.positionFromDevice && cached.position > 0);

    // 本地已 stop 时，不让设备残留的播放状态覆盖，避免前端进度条跳动
    const reportState = resolveReportState(localStatus.state, cached.state);
    const reportPosition = resolveReportPosition(localStatus.state, cached.state, localStatus.position, position);

    return { ...localStatus, state: reportState, position: reportPosition, duration, volume: cached.volume };
  }

  // 缓存过期，从设备获取真实播放状态
  let volume = cached?.volume ?? -1;
  let realPosition = localStatus.position;
  let realDuration = localStatus.duration;
  let realState = localStatus.state;
  let devicePosition = -1; // 设备 play_song_detail 上报的流内位置，-1 = 未上报
  try {
    const raw = await getOrFetchDeviceStatus(account_id, device_id, () => minaService.getPlayerStatus(account_id, device_id));
    const info = raw?.data?.info;
    if (typeof info === 'string') {
      const parsed = JSON.parse(info);
      if (typeof parsed.volume === 'number') {
        if (!cached?.volumeLockedUntil || Date.now() > cached.volumeLockedUntil) {
          volume = parsed.volume;
        }
      }
      if (parsed.status === 1) realState = 'playing';
      else if (parsed.status === 2) realState = 'paused';
      else if (parsed.status === 0) realState = 'stopped';
      if (parsed.play_song_detail) {
        const d = parsed.play_song_detail;
        if (typeof d.position === 'number') {
          devicePosition = Math.floor(d.position / 1000);
          // seek 流从曲内 seekOffset 秒开始，设备给的是流内偏移，补成曲内绝对位置
          realPosition = devicePosition + seekOffset;
        }
        if (typeof d.duration === 'number') realDuration = Math.floor(d.duration / 1000);
      }
    }
  } catch (e: any) {
    songloft.log.warn('[player/status] getPlayerStatus failed: ' + String(e));
  }

  // 本地歌曲 duration（来自文件元数据）比设备报告的更可靠，
  // 设备在 MUSIC 模式（keepLight=true）下经常报告错误的 duration
  if (localStatus.duration > 0) {
    realDuration = localStatus.duration;
  }

  // 更新缓存。position 存设备原始的流内偏移（未加 seekOffset）：偏移会随下一次重推变化，
  // 缓存里留裸值、读取时再补，才不会在切歌/续播后拿到被旧偏移污染的位置。
  deviceStatusCache.set(cacheKey, {
    volume,
    state: realState,
    position: devicePosition >= 0 ? devicePosition : realPosition,
    duration: realDuration,
    timestamp: now,
    volumeLockedUntil: cached?.volumeLockedUntil ?? 0,
    positionFromDevice: devicePosition >= 0,
  });

  syncManagerFromDeviceState(manager, localStatus.state, realState, realPosition, devicePosition > 0);

  // 本地已 stop 时，不让设备残留的播放状态覆盖
  const reportState = resolveReportState(localStatus.state, realState);
  const reportPosition = resolveReportPosition(localStatus.state, realState, localStatus.position, realPosition);

  return { ...localStatus, state: reportState, position: reportPosition, duration: realDuration, volume };
}

/**
 * 注册歌单播放相关路由
 * GET  /playlists            → 获取歌单列表
 * GET  /playlists/:id/songs  → 获取歌单歌曲
 * POST /player/play          → 播放歌单
 * POST /player/stop          → 停止播放
 * POST /player/previous      → 上一首
 * POST /player/next          → 下一首
 * POST /player/mode          → 设置播放模式
 * GET  /player/status        → 获取播放状态
 */
export function registerPlaylistHandlers(
  router: Router,
  playlistManagerMap: PlaylistManagerMap,
  minaService: MinaService,
  configManager: ConfigManager,
): void {

  // GET /playlists - 获取歌单列表
  router.get('/playlists', async (req: HTTPRequest) => {
    try {
      const config = await configManager.getConfig();
      if (!config.server_host) {
        // 未配置服务器地址时返回空列表（附带提示信息），而不是 400 错误
        return jsonResponse({ success: true, data: [], message: '未配置服务器地址，请先在「设置」中配置服务器地址。' });
      }
      if (isLoopbackAddress(config.server_host)) {
        // 回环地址时返回空列表（附带提示信息），而不是 400 错误
        return jsonResponse({ success: true, data: [], message: '服务器地址为本地回环地址（localhost/127.0.0.1），MIoT 智能音箱无法访问。请在「设置」中修改为局域网 IP 地址。' });
      }
      const playlists = await songloft.playlists.list();
      const tempPlaylists = playlistManagerMap.getTempPlaylists();
      const allPlaylists = [
        ...(playlists || []),
        ...tempPlaylists.map(tp => ({ id: tp.id, name: tp.name, song_count: tp.songCount })),
      ];
      return jsonResponse({ success: true, data: allPlaylists });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // GET /playlists/:id/songs - 获取歌单歌曲
  router.get('/playlists/:id/songs', async (req: HTTPRequest, params: Record<string, string>) => {
    try {
      const playlistId = Number(params.id);
      if (!playlistId || isNaN(playlistId)) {
        return jsonResponse({ success: false, error: 'invalid playlist id' });
      }
      if (isTempPlaylistId(playlistId)) {
        const manager = playlistManagerMap.findByPlaylistId(playlistId);
        if (!manager) {
          return jsonResponse({ success: true, data: [] });
        }
        return jsonResponse({ success: true, data: manager.getSongs() });
      }
      const songs = await songloft.playlists.getSongs(playlistId, { limit: 100000 });
      return jsonResponse({ success: true, data: songs });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // POST /player/play - 播放歌单
  router.post('/player/play', async (req: HTTPRequest) => {
    try {
      const body = parseBody(req);
      const { account_id, device_id, playlist_id, start_index, play_mode, song_id } = body;

      if (!account_id) {
        return jsonResponse({ success: false, error: 'account_id is required' });
      }
      if (!device_id) {
        return jsonResponse({ success: false, error: 'device_id is required' });
      }
      if (!playlist_id) {
        return jsonResponse({ success: false, error: 'playlist_id is required' });
      }

      // 检查服务器地址
      const config = await configManager.getConfig();
      if (!config.server_host) {
        return jsonResponse({ success: false, error: '未配置服务器地址，请先在「设置」中配置服务器地址。' });
      }
      if (isLoopbackAddress(config.server_host)) {
        return jsonResponse({ success: false, error: '服务器地址为本地回环地址，MIoT 智能音箱无法访问。请在「设置」中修改为局域网 IP 地址。' });
      }

      const manager = await playlistManagerMap.getOrCreate(account_id, device_id);
      const mode: PlayMode = play_mode || 'order';
      const playlistId = Number(playlist_id);
      const startIndex = Number(start_index) || 0;
      const songId = Number(song_id) || 0;

      // 起始歌曲优先按 song_id 定位：调用方（网页列表）的下标可能基于一份已过期的歌单快照，
      // 与服务端此刻拉到的顺序错位就会播成邻近的歌（#59）。song_id 找不到时才退回下标。
      let ok: boolean;
      if (isTempPlaylistId(playlistId)) {
        // 临时歌单（语音「播放歌手XX」等）只存在于内存，没法按 ID 重新拉取
        const localStatus = manager.getStatus();
        const songs = manager.getSongs();
        if (!songs || songs.length === 0 || localStatus.playlist_id !== playlistId) {
          return jsonResponse({ success: false, error: 'temp playlist expired, please re-issue voice command' });
        }
        const idx = songId > 0 ? songs.findIndex((s: any) => s.id === songId) : -1;
        ok = await manager.playWithSongs(songs as any, idx >= 0 ? idx : startIndex, mode, localStatus.playlist_name);
      } else if (songId > 0) {
        ok = await manager.playPlaylistFromSong(playlistId, songId, mode, startIndex);
      } else {
        ok = await manager.play(playlistId, startIndex, mode);
      }
      if (!ok) {
        return jsonResponse({ success: false, error: 'failed to start playlist' });
      }

      return jsonResponse({
        success: true,
        data: {
          message: 'playlist started',
          playlist_id: playlistId,
          play_mode: mode,
          // 前端据此纠正高亮/列表：与请求的 start_index 不一致说明本地列表已过期
          current_index: manager.getStatus().current_index,
          current_song: manager.getCurrentSong(),
        },
      });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // POST /player/stop - 停止播放
  router.post('/player/stop', async (req: HTTPRequest) => {
    try {
      const body = parseBody(req);
      const query = parseQuery(req.query);
      const account_id = body.account_id || query.account_id;
      const device_id = body.device_id || query.device_id;

      if (!account_id || !device_id) {
        return jsonResponse({ success: false, error: 'account_id and device_id are required' });
      }

      const manager = playlistManagerMap.get(account_id, device_id);
      if (!manager) {
        return jsonResponse({ success: false, error: 'no active playlist for this device' });
      }
      const lastPosition = manager.getStatus().position;
      await manager.stop();
      updateDeviceStatusCache(account_id, device_id, { state: 'stopped', position: lastPosition });
      return jsonResponse({ success: true, data: { message: 'playlist stopped' } });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // POST /player/toggle - 切换播放/暂停状态
  router.post('/player/toggle', async (req: HTTPRequest) => {
    try {
      const body = parseBody(req);
      const query = parseQuery(req.query);
      const account_id = body.account_id || query.account_id;
      const device_id = body.device_id || query.device_id;

      if (!account_id || !device_id) {
        return jsonResponse({ success: false, error: 'account_id and device_id are required' });
      }

      const manager = await playlistManagerMap.getOrCreate(account_id, device_id);
      const status = manager.getStatus();

      if (manager.isPlaying()) {
        // 正在播放，暂停
        const lastPosition = manager.getStatus().position;
        await manager.pause();
        updateDeviceStatusCache(account_id, device_id, { state: 'paused', position: lastPosition });
        return jsonResponse({ success: true, data: { message: 'playlist paused', state: 'paused' } });
      }

      if (!manager.hasPlaylist()) {
        return jsonResponse({ success: false, error: 'no playlist loaded, please select a playlist first' });
      }

      // 检查是否处于 paused 状态，如果是则恢复
      if (status.state === 'paused') {
        const ok = await manager.resumePlayback();
        if (ok) {
          updateDeviceStatusCache(account_id, device_id, { state: 'playing', position: manager.getStatus().position });
          return jsonResponse({
            success: true,
            data: {
              message: 'playlist resumed',
              state: 'playing',
              current_song: manager.getCurrentSong(),
            },
          });
        }
        // 如果 resumePlayback 失败，回退到重新播放
      }

      // 检查服务器地址
      const config = await configManager.getConfig();
      if (!config.server_host) {
        return jsonResponse({ success: false, error: '未配置服务器地址，请先在「设置」中配置服务器地址。' });
      }
      if (isLoopbackAddress(config.server_host)) {
        return jsonResponse({ success: false, error: '服务器地址为本地回环地址，MIoT 智能音箱无法访问。请在「设置」中修改为局域网 IP 地址。' });
      }

      // 处于 stopped 状态或 resumePlayback 失败，重新播放
      if (isTempPlaylistId(status.playlist_id)) {
        // 临时歌单：内存中歌曲列表仍在，直接重放
        const songs = manager.getSongs();
        if (!songs || songs.length === 0) {
          return jsonResponse({ success: false, error: 'temp playlist expired, please re-issue voice command' });
        }
        const ok = await manager.playWithSongs(songs as any, status.current_index, status.play_mode as PlayMode, status.playlist_name);
        if (!ok) {
          return jsonResponse({ success: false, error: 'failed to resume temp playlist' });
        }
      } else {
        const ok = await manager.play(status.playlist_id, status.current_index, status.play_mode as PlayMode);
        if (!ok) {
          return jsonResponse({ success: false, error: 'failed to resume playback' });
        }
      }

      updateDeviceStatusCache(account_id, device_id, { state: 'playing', position: 0 });
      return jsonResponse({
        success: true,
        data: {
          message: 'playlist resumed',
          state: 'playing',
          current_song: manager.getCurrentSong(),
        },
      });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // POST /player/previous - 上一首
  router.post('/player/previous', async (req: HTTPRequest) => {
    try {
      const body = parseBody(req);
      const query = parseQuery(req.query);
      const account_id = body.account_id || query.account_id;
      const device_id = body.device_id || query.device_id;

      if (!account_id || !device_id) {
        return jsonResponse({ success: false, error: 'account_id and device_id are required' });
      }

      const manager = playlistManagerMap.get(account_id, device_id);
      if (!manager) {
        return jsonResponse({ success: false, error: 'no active playlist for this device' });
      }

      const ok = await manager.previous();
      if (!ok) {
        return jsonResponse({ success: false, error: 'failed to play previous' });
      }
      return jsonResponse({ success: true, data: { message: 'playing previous song', current_song: manager.getCurrentSong() } });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // POST /player/next - 下一首
  router.post('/player/next', async (req: HTTPRequest) => {
    try {
      const body = parseBody(req);
      const query = parseQuery(req.query);
      const account_id = body.account_id || query.account_id;
      const device_id = body.device_id || query.device_id;

      if (!account_id || !device_id) {
        return jsonResponse({ success: false, error: 'account_id and device_id are required' });
      }

      const manager = playlistManagerMap.get(account_id, device_id);
      if (!manager) {
        return jsonResponse({ success: false, error: 'no active playlist for this device' });
      }

      const ok = await manager.next();
      if (!ok) {
        return jsonResponse({ success: false, error: 'failed to play next' });
      }
      return jsonResponse({ success: true, data: { message: 'playing next song', current_song: manager.getCurrentSong() } });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // POST /player/mode - 设置播放模式
  router.post('/player/mode', async (req: HTTPRequest) => {
    try {
      const body = parseBody(req);
      const query = parseQuery(req.query);
      const account_id = body.account_id || query.account_id;
      const device_id = body.device_id || query.device_id;
      const play_mode = body.play_mode;

      if (!account_id || !device_id) {
        return jsonResponse({ success: false, error: 'account_id and device_id are required' });
      }
      if (!play_mode) {
        return jsonResponse({ success: false, error: 'play_mode is required' });
      }

      const manager = playlistManagerMap.get(account_id, device_id);
      if (!manager) {
        return jsonResponse({ success: false, error: 'no active playlist for this device' });
      }

      await manager.setPlayMode(play_mode as PlayMode);
      return jsonResponse({ success: true, data: { message: 'play mode set', play_mode } });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // GET /player/status - 获取播放状态（本地播放状态优先，设备数据用于音量/进度校准）
  router.get('/player/status', async (req: HTTPRequest) => {
    try {
      const query = parseQuery(req.query);
      const { account_id, device_id } = query;

      if (!account_id || !device_id) {
        return jsonResponse({ success: false, error: 'account_id and device_id are required' });
      }

      const data = await resolvePlayerStatus(playlistManagerMap, minaService, account_id, device_id);
      return jsonResponse({ success: true, data });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // GET /player/favorite/status - 查询歌曲是否已收藏
  router.get('/player/favorite/status', async (req: HTTPRequest) => {
    try {
      const query = parseQuery(req.query);
      const songId = Number(query.song_id);
      if (!songId || isNaN(songId)) {
        return jsonResponse({ success: false, error: 'song_id is required' });
      }
      const playlists = await songloft.playlists.list();
      const favPlaylist = playlists.find(p => p.name === '收藏' && p.type === 'normal');
      if (!favPlaylist) {
        return jsonResponse({ success: true, data: { is_favorited: false } });
      }
      const songs = await songloft.playlists.getSongs(favPlaylist.id, { limit: 100000 });
      const isFavorited = songs.some((s: any) => s.id === songId);
      return jsonResponse({ success: true, data: { is_favorited: isFavorited, playlist_id: favPlaylist.id } });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // POST /player/favorite/toggle - 收藏/取消收藏歌曲
  router.post('/player/favorite/toggle', async (req: HTTPRequest) => {
    try {
      const body = parseBody(req);
      const songId = Number(body.song_id);
      const action = body.action; // 'add' | 'remove'
      if (!songId || isNaN(songId)) {
        return jsonResponse({ success: false, error: 'song_id is required' });
      }
      if (action !== 'add' && action !== 'remove') {
        return jsonResponse({ success: false, error: 'action must be "add" or "remove"' });
      }
      const playlists = await songloft.playlists.list();
      const favPlaylist = playlists.find(p => p.name === '收藏' && p.type === 'normal');
      if (!favPlaylist) {
        return jsonResponse({ success: false, error: '未找到收藏歌单' });
      }
      if (action === 'add') {
        await callHostAPI('POST', `/api/v1/playlists/${favPlaylist.id}/songs`, { song_ids: [songId] });
      } else {
        await callHostAPI('DELETE', `/api/v1/playlists/${favPlaylist.id}/songs/${songId}`);
      }
      return jsonResponse({ success: true, data: { is_favorited: action === 'add' } });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });
}
