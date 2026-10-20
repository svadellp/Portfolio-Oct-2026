// One-time setup: open /api/spotify-login on the live site, approve, and copy the refresh token it shows.
// Switches itself off once SPOTIFY_REFRESH_TOKEN is set in Vercel.
// pasted keys often carry a stray space, quote or line break: strip them
const env = k => (process.env[k] || '').trim().replace(/^["']|["']$/g, '');
module.exports = (req, res) => {
  if (env('SPOTIFY_REFRESH_TOKEN')) { res.statusCode = 404; return res.end('Spotify is already connected.') }
  if (!env('SPOTIFY_CLIENT_ID')) { res.statusCode = 500; return res.end('Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Vercel first, then redeploy.') }
  const redirect = 'https://' + req.headers.host + '/api/spotify-callback';
  const q = new URLSearchParams({
    response_type: 'code', client_id: env('SPOTIFY_CLIENT_ID'), redirect_uri: redirect,
    scope: 'user-read-currently-playing user-read-recently-played'
  });
  res.statusCode = 302; res.setHeader('Location', 'https://accounts.spotify.com/authorize?' + q); res.end();
};
