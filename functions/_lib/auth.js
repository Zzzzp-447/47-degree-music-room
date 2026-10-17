const encoder = new TextEncoder();
const bytesToHex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
const hexToBytes = hex => new Uint8Array(hex.match(/../g).map(byte => parseInt(byte, 16)));

async function digest(value) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { salt: bytesToHex(salt), hash: bytesToHex(new Uint8Array(bits)) };
}

export async function verifyPassword(password, salt, expected) {
  const { hash } = await hashPassword(password, hexToBytes(salt));
  let mismatch = hash.length ^ expected.length;
  for (let index = 0; index < Math.min(hash.length, expected.length); index++) mismatch |= hash.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export async function createSession(env, userId) {
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(token), userId, Date.now() + 30 * 86400000).run();
  return `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

export async function getUser(request, env) {
  const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)session=([a-f0-9]+)/)?.[1];
  if (!token) return null;
  return env.DB.prepare('SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').bind(await digest(token), Date.now()).first();
}

export async function deleteSession(request, env) {
  const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)session=([a-f0-9]+)/)?.[1];
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
}

export const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers });
