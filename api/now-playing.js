// What Sara is listening to on Spotify right now, or the last song she played.
// Needs three environment variables in Vercel: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN.
// Returns: { isPlaying, title, artist, url, playedAt? }
// pasted keys often carry a stray space, quote or line break: strip them
const env = k => (process.env[k] || '').trim().replace(/^["']|["']$/g, '');

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_URL = 'https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode';
const RECENT_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=1';

let cached = { token: null, until: 0 };   // reused while the serverless instance stays warm

async function accessToken() {
  if (cached.token && Date.now() < cached.until) return cached.token;
  const id = env('SPOTIFY_CLIENT_ID'), secret = env('SPOTIFY_CLIENT_SECRET'), refresh = env('SPOTIFY_REFRESH_TOKEN');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh })
  });
  if (!r.ok) throw new Error('token ' + r.status);
  const j = await r.json();
  cached = { token: j.access_token, until: Date.now() + (j.expires_in - 60) * 1000 };
  return cached.token;
}

function shape(item, isPlaying, playedAt) {
  if (!item) return null;
  const artist = item.artists ? item.artists.map(a => a.name).join(', ') : (item.show && item.show.name) || '';
  return { isPlaying, title: item.name, artist, url: (item.external_urls && item.external_urls.spotify) || 'https://open.spotify.com', playedAt: playedAt || null };
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!env('SPOTIFY_CLIENT_ID') || !env('SPOTIFY_CLIENT_SECRET') || !env('SPOTIFY_REFRESH_TOKEN')) {
    res.statusCode = 503; return res.end(JSON.stringify({ error: 'Spotify is not connected yet' }));
  }
  try {
    const token = await accessToken();
    const auth = { headers: { Authorization: 'Bearer ' + token } };
    let out = null;
    const now = await fetch(NOW_URL, auth);
    if (now.status === 200) {
      const j = await now.json();
      if (j && j.item && j.is_playing) out = shape(j.item, true);
    }
    if (!out) {                                  // nothing playing: show the last song instead
      const rec = await fetch(RECENT_URL, auth);
      if (rec.ok) { const j = await rec.json(); const last = j.items && j.items[0]; if (last) out = shape(last.track, false, last.played_at) }
    }
    // the edge keeps an answer for 20 seconds, so visitors never hit Spotify's rate limits
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=40');
    res.statusCode = out ? 200 : 204;
    return res.end(out ? JSON.stringify(out) : '');
  } catch (e) {
    res.statusCode = 502; return res.end(JSON.stringify({ error: 'Spotify is unavailable right now' }));
  }
};
