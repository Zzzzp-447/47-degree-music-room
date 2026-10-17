export async function onRequestGet({ request }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!/^\d+$/.test(id || '')) return Response.json({ error: 'Invalid album id' }, { status: 400 });
  const upstream = await fetch(`https://music.163.com/api/album/${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' },
  });
  if (!upstream.ok) return Response.json({ error: 'Album lookup failed' }, { status: 502 });
  return new Response(upstream.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=900' } });
}
