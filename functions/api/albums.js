import { getUser, json } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);if (!user) return json({ error: '请先登录。' }, 401);
  const { results } = await env.DB.prepare('SELECT data FROM user_albums WHERE user_id=? ORDER BY created_at DESC').bind(user.id).all();
  return json(results.map(row => JSON.parse(row.data)));
}

export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);if (!user) return json({ error: '请先登录。' }, 401);
  const { album } = await request.json().catch(() => ({}));if (!album?.id) return json({ error: '唱片数据无效。' }, 400);
  await env.DB.prepare(`INSERT INTO user_albums (user_id,album_id,data,created_at) VALUES (?,?,?,?)
    ON CONFLICT(user_id,album_id) DO UPDATE SET data=excluded.data,created_at=excluded.created_at`).bind(user.id, String(album.id), JSON.stringify(album), Date.now()).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const user = await getUser(request, env);if (!user) return json({ error: '请先登录。' }, 401);
  const { id } = await request.json().catch(() => ({}));if (!id) return json({ error: '缺少唱片编号。' }, 400);
  await env.DB.prepare('DELETE FROM user_albums WHERE user_id=? AND album_id=?').bind(user.id, String(id)).run();
  return json({ ok: true });
}
