export async function onRequestGet({ request }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!/^\d+$/.test(id || '')) return new Response('Invalid song id', { status: 400 });
  const upstream = await fetch(`https://music.163.com/song/media/outer/url?id=${id}.mp3`, {
    redirect: 'follow',
    headers: { Range: request.headers.get('Range') || 'bytes=0-', Referer: 'https://music.163.com/' },
  });
  if (!upstream.ok && upstream.status !== 206) return new Response('Audio fetch failed', { status: 502 });
  const headers = new Headers(upstream.headers);
  headers.set('accept-ranges', 'bytes');
  headers.delete('set-cookie');
  return new Response(upstream.body, { status: upstream.status, headers });
}
