// A Supabase direct endpoint can be IPv6-only. On Vercel, optionally route
// that same database through the project's explicitly configured pooler.
export function databaseUrl(raw: string | undefined, poolerHost: string | undefined) {
  if (!raw || !poolerHost || raw.startsWith('file:')) return raw;
  if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(poolerHost)) {
    throw new Error('Invalid database pooler configuration');
  }
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) return raw;
  const match = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
  if (!match) return raw;
  url.hostname = poolerHost;
  url.port = '6543';
  url.username = `${decodeURIComponent(url.username)}.${match[1]}`;
  url.searchParams.set('pgbouncer', 'true');
  if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
  url.searchParams.set('sslmode', 'require');
  return url.toString();
}
