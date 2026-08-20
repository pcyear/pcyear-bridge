// 哈希 / 编码工具。
//
// SongLoft 的 QuickJS 运行时注入了原生桥接（__go_crypto_md5 / __go_crypto_sha256 /
// __go_buffer_from / __go_buffer_to_string），比纯 JS 快且无精度坑，优先使用；
// 仅在桥接缺失时（如本机 node 单测）回退到内置纯 JS 实现。
//
// 用途：
//  - sha256：飞牛音乐登录密码（password = SHA256(明文)）
//  - md5：Subsonic token（t = MD5(password + salt)）
//  - base64：WebDAV Basic Auth

declare const __go_crypto_md5: ((s: string) => string) | undefined;
declare const __go_crypto_sha256: ((s: string) => string) | undefined;
declare const __go_buffer_from: ((data: string, encoding: string) => string) | undefined;
declare const __go_buffer_to_string: ((hex: string, encoding: string) => string) | undefined;

// AES 凭证加密依赖的 Go 桥接（与 geak.ts 的 __go_crypto_* 同源，由 QuickJS 运行时注入）。
// 全部 hex 入参/出参，规避 SDK 对 string 类型 key 的 UTF-8/hex 编码歧义。
declare const __go_crypto_aes_encrypt: ((dataHex: string, mode: string, keyHex: string, ivHex: string) => string) | undefined;
declare const __go_crypto_aes_decrypt: ((dataHex: string, mode: string, keyHex: string, ivHex: string) => string) | undefined;
declare const __go_crypto_random_bytes: ((size: number) => string) | undefined;

declare const songloft: any;

function hasFn(name: string): boolean {
  try {
    return typeof (globalThis as any)[name] === 'function';
  } catch {
    return false;
  }
}

function utf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
    else if (c < 0xd800 || c >= 0xe000) { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    else {
      i++;
      c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

function toHex(bytes: number[]): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const h = (bytes[i] & 0xff).toString(16);
    s += h.length === 1 ? '0' + h : h;
  }
  return s;
}

// ---------------- SHA-256 ----------------
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Pure(message: string): string {
  const bytes = utf8Bytes(message);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const l = bytes.length;
  const withOne = l + 1;
  const k = (56 - (withOne % 64) + 64) % 64;
  const total = withOne + k + 8;
  const msg = new Array(total).fill(0);
  for (let i = 0; i < l; i++) msg[i] = bytes[i];
  msg[l] = 0x80;
  // 长度以 bit 表示，写入末尾 8 字节（大端）。高 32 位支持 >512MB 输入。
  const bitLenLo = (l * 8) >>> 0;
  const bitLenHi = Math.floor((l * 8) / 4294967296) >>> 0;
  msg[total - 8] = (bitLenHi >>> 24) & 0xff;
  msg[total - 7] = (bitLenHi >>> 16) & 0xff;
  msg[total - 6] = (bitLenHi >>> 8) & 0xff;
  msg[total - 5] = bitLenHi & 0xff;
  msg[total - 4] = (bitLenLo >>> 24) & 0xff;
  msg[total - 3] = (bitLenLo >>> 16) & 0xff;
  msg[total - 2] = (bitLenLo >>> 8) & 0xff;
  msg[total - 1] = bitLenLo & 0xff;

  const w = new Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = ((msg[i + j * 4] << 24) | (msg[i + j * 4 + 1] << 16) | (msg[i + j * 4 + 2] << 8) | msg[i + j * 4 + 3]) | 0;
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K256[j] + w[j]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  const out: number[] = [];
  for (let i = 0; i < 8; i++) {
    out.push((H[i] >>> 24) & 0xff, (H[i] >>> 16) & 0xff, (H[i] >>> 8) & 0xff, H[i] & 0xff);
  }
  return toHex(out);
}

// ---------------- MD5 ----------------
const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const MD5_K: number[] = (() => {
  const k = new Array(64);
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  return k;
})();

function md5Pure(message: string): string {
  const bytes = utf8Bytes(message);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const lo = bitLen >>> 0;
  const hi = Math.floor(bitLen / 4294967296) >>> 0;
  for (let i = 0; i < 4; i++) bytes.push((lo >>> (i * 8)) & 0xff);
  for (let i = 0; i < 4; i++) bytes.push((hi >>> (i * 8)) & 0xff);

  // 状态在所有分组间连续累积（这是纯 JS 实现最常见的出错点）
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476;
  const x = new Array(16);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      x[i] = (bytes[off + i * 4] | (bytes[off + i * 4 + 1] << 8) | (bytes[off + i * 4 + 2] << 16) | (bytes[off + i * 4 + 3] << 24)) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d;
      d = c; c = b;
      const sum = (a + f + MD5_K[i] + x[g]) | 0;
      const s = MD5_S[i];
      b = (b + (((sum << s) | (sum >>> (32 - s))) | 0)) | 0;
      a = tmp;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
  }
  const out: number[] = [];
  for (const v of [h0, h1, h2, h3]) {
    out.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  }
  return toHex(out);
}

// ---------------- Base64 ----------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Pure(input: string): string {
  const bytes = utf8Bytes(input);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 0x3f] : '=';
  }
  return out;
}

// ---------------- 对外 API（优先原生桥接）----------------

export function sha256(message: string): string {
  // 强制小写 hex：fnOS Music 的登录密码哈希区分大小写（大写会被判为密码错误 →
  // code:120001 "unauthorized"）。纯 JS 回退本就是小写，但 Go 桥接 __go_crypto_sha256
  // 可能返回大写，统一转小写，避免内网 IP 直连密码登录失败。
  const h = hasFn('__go_crypto_sha256') ? (__go_crypto_sha256 as any)(message) : sha256Pure(message);
  return typeof h === 'string' ? h.toLowerCase() : h;
}

export function md5(message: string): string {
  if (hasFn('__go_crypto_md5')) return (__go_crypto_md5 as any)(message);
  return md5Pure(message);
}

export function base64(input: string): string {
  if (hasFn('__go_buffer_from') && hasFn('__go_buffer_to_string')) {
    try {
      return (__go_buffer_to_string as any)((__go_buffer_from as any)(input, 'utf8'), 'base64');
    } catch { /* 回退 */ }
  }
  return base64Pure(input);
}

/** 生成随机设备 ID（飞牛登录需要 deviceId 字段） */
export function randomDeviceId(): string {
  const hex = '0123456789abcdef';
  let s = 'slp-';
  for (let i = 0; i < 24; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

/** Subsonic salt */
export function randomSalt(len = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ---------------- 凭证加密（AES-256-CBC，宿主随机密钥）----------------
//
// 策略：插件首次激活时用宿主随机字节生成一根 AES-256 密钥，存到
// songloft.persistentStorage（宿主沙盒 KV，跨插件更新/重启保留，与配置隔离）。
// 配置落盘前对 password 字段做 AES-256-CBC 加密（随机 IV，密文 hex），
// 读取时再解密；明文仅在内存短暂存在，磁盘/导出的 JSON 不含明文密码。
//
// 直接走 Go 桥接 __go_crypto_aes_*（全 hex），避免 SDK aesEncrypt 对 string key 的
// UTF-8/hex 编码歧义。桥接缺失时降级为明文 + 日志告警（绝不崩）。

const ENC_KEY_STORAGE = 'msm_enc_key';
const ENC_PREFIX = 'ENC1:';          // 自描述前缀，便于识别已加密载荷
const AES_KEY_BYTES = 32;            // AES-256
const AES_IV_BYTES = 16;             // CBC 块大小

// 模块级缓存：插件单 VM 进程内复用，避免每次保存/读取都回 persistentStorage
let keyCache: string | null | undefined = undefined;

/** 桥接齐全时返回 true；否则说明运行环境不支持加密，应降级为明文。 */
export function credentialsEncryptionAvailable(): boolean {
  return hasFn('__go_crypto_aes_encrypt') && hasFn('__go_crypto_aes_decrypt')
    && hasFn('__go_crypto_random_bytes') && hasFn('__go_buffer_from') && hasFn('__go_buffer_to_string');
}

/** 生成 32 字节随机密钥（hex，64 字符）。 */
export function generateKeyHex(): string {
  if (hasFn('__go_crypto_random_bytes')) return (__go_crypto_random_bytes as any)(AES_KEY_BYTES);
  // 退化路径：桥接缺失的本地单测场景，用 Math.random 凑 64 hex（仅用于不崩，安全性弱）
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < AES_KEY_BYTES * 2; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

/**
 * 取（或惰性生成并持久化）加密密钥，返回 hex 字符串。
 * 密钥持久化到插件数据目录下的文件（msm_enc_key）：跨 reload/redeploy 一定保留，
 * 避免旧实现只存 persistentStorage 在重新部署后密钥丢失、旧密文无法解密（表现为「用户名密码错误」）。
 * 同时兼容旧实现：曾存于 persistentStorage 的密钥仍可被读出并同步回文件。
 */
const ENC_KEY_FILE = 'msm_enc_key';
export async function ensureEncryptionKey(): Promise<string> {
  if (keyCache !== undefined && keyCache !== null) return keyCache as string;
  // 1) 优先从文件读（最稳，跨 reload/redeploy 保留）
  let stored: string | null = null;
  try {
    const f = await (songloft as any).fs.readFile(ENC_KEY_FILE, { encoding: 'utf8' });
    if (typeof f === 'string' && f.trim().length === AES_KEY_BYTES * 2) stored = f.trim();
  } catch { /* 文件不存在或读失败，忽略 */ }
  // 2) 兼容旧实现：曾存于 persistentStorage
  if (!stored) {
    try {
      const raw = await (songloft as any).persistentStorage.get(ENC_KEY_STORAGE);
      if (typeof raw === 'string' && raw.length === AES_KEY_BYTES * 2) stored = raw;
    } catch { /* 忽略 */ }
  }
  if (stored) {
    keyCache = stored;
    // 双保险：把密钥也落到文件，确保后续 reload 一定读得到
    try { await (songloft as any).fs.writeFile(ENC_KEY_FILE, stored, { encoding: 'utf8' }); } catch { /* 忽略 */ }
    try { await (songloft as any).persistentStorage.set(ENC_KEY_STORAGE, stored); } catch { /* 忽略 */ }
    return stored;
  }
  // 3) 首次：生成并持久化到文件（主）+ persistentStorage（兼容旧路径）
  const gen = generateKeyHex();
  try {
    await (songloft as any).fs.writeFile(ENC_KEY_FILE, gen, { encoding: 'utf8' });
  } catch (e: any) {
    (songloft as any).log?.warn?.('持久化加密密钥到文件失败（本次仍可用，但重启后重新生成会导致旧密文不可解密）：' + ((e && e.message) || e));
  }
  try { await (songloft as any).persistentStorage.set(ENC_KEY_STORAGE, gen); } catch { /* 忽略 */ }
  keyCache = gen;
  return gen;
}

/** 该字符串是否为本插件的加密凭证载荷。 */
export function isEncryptedPayload(s: any): boolean {
  return typeof s === 'string' && s.startsWith(ENC_PREFIX);
}

/**
 * 明文 → 密文载荷串 `ENC1:<ivHex>:<ctHex>`。
 * keyHex 为 64 字符（32 字节）。桥接缺失时直接返回明文（降级）。
 */
export function encryptCredential(plain: string, keyHex: string): string {
  if (!credentialsEncryptionAvailable()) return plain;
  const ptHex = (__go_buffer_from as any)(plain, 'utf8');
  const ivHex = (__go_crypto_random_bytes as any)(AES_IV_BYTES);
  const ctHex = (__go_crypto_aes_encrypt as any)(ptHex, 'cbc', keyHex, ivHex);
  return ENC_PREFIX + ivHex + ':' + ctHex;
}

/**
 * 密文载荷串 → 明文；解密失败返回原串（不崩，交由连接层走 auth 失败降级）。
 * 非加密载荷（旧明文配置）原样返回。
 */
export function decryptCredential(payload: string, keyHex: string): string {
  if (!isEncryptedPayload(payload)) return payload;
  if (!credentialsEncryptionAvailable()) {
    (songloft as any).log?.warn?.('加密桥接不可用，无法解密凭证，原样返回');
    return payload;
  }
  try {
    const body = payload.slice(ENC_PREFIX.length);
    const idx = body.indexOf(':');
    if (idx < 0) return payload;
    const ivHex = body.slice(0, idx);
    const ctHex = body.slice(idx + 1);
    const ptHex = (__go_crypto_aes_decrypt as any)(ctHex, 'cbc', keyHex, ivHex);
    return (__go_buffer_to_string as any)(ptHex, 'utf8');
  } catch (e: any) {
    (songloft as any).log?.warn?.('凭证解密失败（密钥可能已变更）：' + ((e && e.message) || e));
    return payload;
  }
}

// 仅用于单元自检
export const __internal = { sha256Pure, md5Pure, base64Pure };
