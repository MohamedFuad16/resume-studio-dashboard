// Google OAuth 2.0 (read-only Gmail) via raw fetch — no googleapis dependency.
// Credentials come from env (created in Google Cloud Console → APIs & Services →
// Credentials → OAuth client, type "Web application"):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI
// The redirect URI must EXACTLY match one registered on the OAuth client
// (e.g. http://localhost:5005/api/integrations/gmail/callback for local dev).
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

// Read-only mail access + the address, so the UI can show which account is linked.
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

const clientId = () => process.env.GOOGLE_CLIENT_ID || '';
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET || '';
const redirectUri = () => process.env.GOOGLE_OAUTH_REDIRECT_URI || '';

export function oauthConfigured() {
  return Boolean(clientId() && clientSecret() && redirectUri());
}

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    // offline + consent so Google returns a refresh_token (needed for 24/7 sync).
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Google token error: ${json.error || res.status} ${json.error_description || ''}`.trim());
    err.googleError = json.error;
    throw err;
  }
  return json;
}

// Authorization code → { access_token, refresh_token, expires_in, scope, ... }.
export function exchangeCode(code) {
  return tokenRequest({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
  });
}

// Refresh token → a fresh short-lived access token (no new refresh token).
export function refreshAccessToken(refreshToken) {
  return tokenRequest({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
}

export async function revokeToken(token) {
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch { /* best-effort; disconnect deletes local state regardless */ }
}

// Fetch the linked account's email address with a valid access token.
export async function fetchEmail(accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json().catch(() => ({}));
    return json.email || '';
  } catch {
    return '';
  }
}
