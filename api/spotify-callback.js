// One-time setup, step two: Spotify sends you back here and the page shows your refresh token.
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const page = (title, body) => '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title>' +
    '<body style="font:16px/1.55 system-ui,sans-serif;max-width:640px;margin:12vh auto;padding:0 20px;color:#111"><h1 style="font-weight:600;letter-spacing:-.02em">' + title + '</h1>' + body + '</body>';
  if (process.env.SPOTIFY_REFRESH_TOKEN) { res.statusCode = 404; return res.end(page('Already connected', '<p>Spotify is already connected to this site.</p>')) }
  const url = new URL(req.url, 'https://' + req.headers.host), code = url.searchParams.get('code');
  if (!code) { res.statusCode = 400; return res.end(page('Something went wrong', '<p>Spotify didn’t send a code back (' + (url.searchParams.get('error') || 'unknown') + '). Try <a href="/api/spotify-login">connecting again</a>.</p>')) }
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: 'https://' + req.headers.host + '/api/spotify-callback' })
  });
  const j = await r.json();
  if (!j.refresh_token) { res.statusCode = 400; return res.end(page('Something went wrong', '<p>' + (j.error_description || j.error || 'No token came back') + '. Check the Redirect URI in your Spotify app, then <a href="/api/spotify-login">try again</a>.</p>')) }
  res.end(page('Almost there', '<p>Copy this token and add it in Vercel as <b>SPOTIFY_REFRESH_TOKEN</b>, then redeploy.</p>' +
    '<textarea readonly onclick="this.select()" style="width:100%;height:120px;font:13px ui-monospace,monospace;padding:12px;border:1px solid #ccc;border-radius:6px">' + j.refresh_token + '</textarea>' +
    '<p style="color:#666">Keep it private. Once it’s saved, this page switches itself off.</p>'));
};
