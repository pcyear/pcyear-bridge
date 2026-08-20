// 多源音乐桥 - 核心类型定义
// 所有音乐服务适配器（飞牛音乐 / WebDAV / Subsonic 等）都实现统一的 SourceAdapter 接口，
// 这样插件后端、宿主音源钩子与前端 UI 都能以一致的方式访问不同服务。

export interface Track {
  id: string;            // 该音源内部的唯一曲目 ID
  title: string;
  artist: string;
  album?: string;
  albumArtist?: string;
  duration?: number;    // 秒（对齐 SongLoft Song.duration）
  trackNo?: number;
  discNo?: number;
  year?: number;
  coverId?: string;     // 用于拼接封面 URL 的标识
  coverUrl?: string;    // 直接可用的封面 URL（SongLoft 本地库歌曲用宿主 cover_url）
  size?: number;        // 字节
  path?: string;        // 相对路径（WebDAV/文件夹浏览用）
  bitrate?: number;
  codec?: string;
  // 插件内部使用
  _source?: string;
  _raw?: any;
}

export interface Album {
  id: string;
  name: string;
  artist?: string;
  year?: number;
  coverId?: string;
  /** 同专辑（或同目录）内可解析封面的候选曲目 coverId，按序择优；pickResolvableCover 失败兜底用 */
  coverCandidates?: string[];
  trackCount?: number;
  _source?: string;
  _raw?: any;
}

export interface Artist {
  id: string;
  name: string;
  coverId?: string;
  /** 同艺术家（或同目录）内可解析封面的候选曲目 coverId，按序择优；pickResolvableCover 失败兜底用 */
  coverCandidates?: string[];
  albumCount?: number;
  trackCount?: number;
  _source?: string;
  _raw?: any;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverId?: string;
  trackCount?: number;
  _source?: string;
  _raw?: any;
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
}

export type SourceType = 'fnMusic' | 'webdav' | 'subsonic' | 'songloft' | 'audiobook' | 'geak';

export interface SourceConfig {
  id: string;             // 实例唯一 ID（用户可添加多个同类服务）
  type: SourceType;
  name: string;           // 展示名，如 "我的飞牛音乐"
  enabled: boolean;
  isDefault?: boolean;
  // 通用字段
  baseUrl: string;        // 服务地址，如 http://192.168.31.28:5666/music
  username?: string;
  password?: string;
  /** 飞牛 fnOS 开启「访问码」后填写：网关层鉴权用，后端自动向 /access_code_verify 换 os-access-code cookie。留空=不启用。 */
  accessCode?: string;
  // WebDAV / Subsonic 专用
  rootPath?: string;      // 起始目录（单值，兼容旧配置）
  rootPaths?: string[];   // 起始目录（多选）；WebDAV 为相对路径数组，Subsonic 为音乐库 ID 数组
  extra?: Record<string, any>;
}

/** 解析后的上游资源：URL + 宿主代理拉取时需附带的请求头 */
export interface UpstreamRef {
  url: string;
  headers: Record<string, string>;
  /**
   * 内联二进制（如音频文件内嵌的封面）。当宿主无法代理二进制体（onHTTPRequest 回传 0 字节）
   * 时，插件直接把解析出的字节塞进 UpstreamRef，由 /cover-data 包成 data URI 返回。
   */
  inline?: EmbeddedArt;
  /**
   * 直接给前端使用的 URL（不经插件 fetch）。宿主原生端点（如 /api/v1/songs/{id}/cover）Go 层代理，
   * 插件 fetch 它可能经宿主代理回调插件自身路由 → 单 worker 死锁；改由前端浏览器直接加载（带 access_token）。
   */
  directUrl?: string;
}

/** 内嵌二进制封面：直接字节 + MIME 类型（由调用方包成 data URI） */
export interface EmbeddedArt {
  contentType: string;
  data: Uint8Array;
}

/**
 * 统一适配器接口。
 * 注意 resolveStream / resolveCover 是异步的——适配器需要按需登录、刷新 token。
 */
export interface SourceAdapter {
  readonly type: SourceType;
  readonly sourceId: string;

  /** 测试连通性 / 登录 */
  testConnection(): Promise<{ ok: boolean; message: string }>;

  listTracks(opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }>;
  listAlbums(opts: { limit?: number; offset?: number }): Promise<{ list: Album[]; total: number }>;
  listArtists(opts: { limit?: number; offset?: number }): Promise<{ list: Artist[]; total: number }>;
  listPlaylists?(opts: { limit?: number; offset?: number }): Promise<{ list: Playlist[]; total: number }>;
  albumTracks(albumId: string, opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }>;
  artistTracks(artistId: string, opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }>;
  playlistTracks?(playlistId: string, opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }>;
  // 上游歌单变更（仅 Subsonic 等支持写操作的音源实现；其余音源留空 → 前端隐藏写按钮）
  createPlaylist?(name: string, trackIds?: string[]): Promise<Playlist>;
  updatePlaylist?(playlistId: string, opts: { name?: string; trackIdsToAdd?: string[]; trackIdsToRemove?: string[] }): Promise<void>;
  deletePlaylist?(playlistId: string): Promise<void>;
  search(query: string, opts: { limit?: number; dir?: string }): Promise<SearchResults>;

  /** 解析真实播放地址（含鉴权头），供宿主 /api/music/url 与插件代理使用 */
  resolveStream(trackId: string): Promise<UpstreamRef>;
  /** 解析封面地址（含鉴权头）；无封面返回 null */
  resolveCover(coverId?: string): Promise<UpstreamRef | null>;
  /** 上游流地址宿主媒体层无法直连（证书/跨域/鉴权头）时置 true，
   *  main.ts 的 /api/music/url 会改走插件 /api/upstream-stream 代理（由插件代拉上游再 serveFile）。可选。 */
  streamViaProxy?: boolean;

  /** 歌词（LRC 文本），可选 */
  lyric?(trackId: string): Promise<string | null>;
  /** 平台原生收藏：读取该音源服务端收藏列表（如 GEAK /api/songs/favorites、飞牛收藏接口）。
   *  实现此方法的音源，其收藏选项卡直接读写平台服务端，而非插件 KV。可选。 */
  listFavorites?(opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }>;
  /** 平台原生收藏：切换某曲目收藏状态（fav=true 收藏 / false 取消）。适配器需自行保证幂等。
   *  与 listFavorites 配套，可选。 */
  setFavorite?(trackId: string, fav: boolean): Promise<void>;
  /** 平台原生收藏：返回该音源已收藏曲目的 id 集合（用于红心状态判定）。可选，缺省时由
   *  listFavorites 结果推导。 */
  favoriteIds?(): Promise<string[]>;
  /** 列举可选择的目录（供前端目录多选器），可选；WebDAV 支持多层钻取，Subsonic 返回一层音乐库。
   *  不再默认返回 count（v1.2.21 起改为前端按需调用 countSongsIn，避免挂载网盘时默认卡顿）。 */
  listDirectories?(path?: string): Promise<{ path: string; name: string; count?: number }[]>;
  /** 递归统计某目录（WebDAV 递归扫目录树 / Subsonic 递归音乐库）下的歌曲总数，前端「加载数量」按需触发。
   *  适配器需自行做有界/超时保护，避免挂载网盘等巨大目录卡死单线程后端。 */
  countSongsIn?(path: string): Promise<number>;
  /** 清理会话 */
  dispose?(): void;
}

/** 前端展示用的音源摘要（不含密码） */
export interface SourceSummary {
  id: string;
  type: SourceType;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  baseUrl: string;
  username?: string;
  rootPath?: string;
  rootPaths?: string[];
  /** 是否已设置访问码（与密码同等加密存储，不回显明文，仅用此标志给前端提示） */
  hasAccessCode?: boolean;
  /** 是否已设置密码（密码加密存储，不回显明文，仅用此标志给前端提示） */
  hasPassword?: boolean;
}

/**
 * 写入宿主 Song.source_data 的载荷。
 * 宿主在播放时把它原样回传给 POST /api/music/url，插件据此解析真实地址。
 */
export interface MusicSourceData {
  /** 固定标记，便于识别是本插件产生的数据 */
  provider: 'multisource-music';
  sourceId: string;
  sourceType: SourceType;
  trackId: string;
  title?: string;
  artist?: string;
  album?: string;
  coverId?: string;
  /** WebDAV 用相对路径直接定位 */
  path?: string;
}
