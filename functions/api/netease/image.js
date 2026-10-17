const allowed = host => host.endsWith('.music.126.net') || host.endsWith('.music.163.com');

export async function onRequestGet({ request }) {
  let source;
  try { source = new URL(new URL(request.url).searchParams.get('url')); } catch { return new Response('Invalid image URL', { status: 400 }); }
  if (source.protocol !== 'https:' || !allowed(source.hostname)) return new Response('Image host not allowed', { status: 403 });
  const upstream = await fetch(source, { headers: { Referer: 'https://music.163.com/' } });
  if (!upstream.ok) return new Response('Image fetch failed', { status: 502 });
  const headers = new Headers(upstream.headers);
  headers.set('cache-control', 'public, max-age=86400');
  headers.delete('set-cookie');
  return new Response(upstream.body, { status: upstream.status, headers });
}
