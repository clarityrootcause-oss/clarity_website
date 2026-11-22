const MAX_BYTES = 200_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const reply = (error, status) =>
  new Response(JSON.stringify(error ? { error } : { ok: true }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const isValid = (d) =>
  d &&
  typeof d.name === 'string' &&
  typeof d.token === 'string' &&
  EMAIL.test(d.email) &&
  Array.isArray(d.rows) &&
  d.rows.length <= 500 &&
  d.rows.every((r) => Array.isArray(r) && r.length === 3 && r.every((c) => typeof c === 'string'));

async function verifyHuman(token, ip, secret) {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip || '' }),
  });
  return (await res.json()).success === true;
}

export async function onRequestPost({ request, env }) {
  const text = await request.text();
  if (text.length > MAX_BYTES) return reply('Too large', 413);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return reply('Invalid submission', 400);
  }
  if (!isValid(data)) return reply('Invalid submission', 400);

  if (!(await verifyHuman(data.token, request.headers.get('CF-Connecting-IP'), env.TURNSTILE_SECRET)))
    return reply('Verification failed', 403);

  const sheet = await fetch(env.SHEET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      secret: env.SHEET_SECRET,
      name: data.name,
      email: data.email,
      submitted: data.submitted,
      answers: data.rows,
    }),
  });
  if (!sheet.ok || (await sheet.text()) !== 'ok') return reply('Could not save', 502);

  return reply(null, 200);
}
