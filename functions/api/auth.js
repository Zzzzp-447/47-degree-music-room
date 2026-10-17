import { createSession, deleteSession, getUser, hashPassword, json, verifyPassword } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  return json({ user: await getUser(request, env) });
}

export async function onRequestPost({ request, env }) {
  const { action, email: rawEmail, password } = await request.json().catch(() => ({}));
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 6) return json({ error: '请输入有效邮箱和至少 6 位密码。' }, 400);
  if (action === 'register') {
    const existing = await env.DB.prepare('SELECT 1 FROM users WHERE email=?').bind(email).first();
    if (existing) return json({ error: '该邮箱已经注册，请直接登录。' }, 409);
    const id = crypto.randomUUID(), credentials = await hashPassword(password);
    await env.DB.prepare('INSERT INTO users (id,email,password_hash,salt) VALUES (?,?,?,?)').bind(id, email, credentials.hash, credentials.salt).run();
    return json({ user: { id, email } }, 201, { 'Set-Cookie': await createSession(env, id) });
  }
  if (action !== 'login') return json({ error: '不支持的账号操作。' }, 400);
  const user = await env.DB.prepare('SELECT id,email,password_hash,salt FROM users WHERE email=?').bind(email).first();
  if (!user || !await verifyPassword(password, user.salt, user.password_hash)) return json({ error: '邮箱或密码不正确。' }, 401);
  return json({ user: { id: user.id, email: user.email } }, 200, { 'Set-Cookie': await createSession(env, user.id) });
}

export async function onRequestDelete({ request, env }) {
  await deleteSession(request, env);
  return json({ ok: true }, 200, { 'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
}
