// Microsoft sign-in using the OAuth 2.0 authorization-code flow with PKCE,
// which is what Microsoft recommends for single-page apps. No secrets are
// involved; the app registration must list this page as an "SPA" redirect URI.
import { CLIENT_ID, AUTHORITY } from './config.js';

const SCOPES = 'openid profile offline_access User.Read Files.ReadWrite.AppFolder';
const TOKENS_KEY = 'wa.tokens';
const PENDING_KEY = 'wa.auth.pending';

export const clientId = () => localStorage.getItem('wa.clientId') || CLIENT_ID;
export const setClientId = (id) => (id ? localStorage.setItem('wa.clientId', id.trim()) : localStorage.removeItem('wa.clientId'));
export const redirectUri = () => location.origin + location.pathname;
const endpoint = (p) => `https://login.microsoftonline.com/${AUTHORITY}/oauth2/v2.0/${p}`;

let tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null');
const store = (t) => { tokens = t; t ? localStorage.setItem(TOKENS_KEY, JSON.stringify(t)) : localStorage.removeItem(TOKENS_KEY); };

export const isSignedIn = () => !!tokens?.refresh_token;
export const account = () => tokens?.account || null;

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export async function signIn({ silent = false } = {}) {
  if (!clientId()) throw new Error('Add your Azure app client ID in Settings first.');
  const verifier = randomString(48);
  const state = randomString(16);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  localStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, hash: location.hash, silent }));
  const q = new URLSearchParams({
    client_id: clientId(), response_type: 'code', redirect_uri: redirectUri(), scope: SCOPES,
    code_challenge: challenge, code_challenge_method: 'S256', state,
  });
  if (silent) {
    q.set('prompt', 'none');
    if (tokens?.account?.username) q.set('login_hint', tokens.account.username);
  } else {
    q.set('prompt', 'select_account');
  }
  location.assign(endpoint('authorize') + '?' + q);
}

export function signOut() { store(null); }

// Call once at startup. Completes a sign-in if we were just redirected back.
// Returns { returnHash } on success, throws on an auth error, null otherwise.
export async function handleRedirect() {
  const p = new URLSearchParams(location.search);
  if (!p.has('code') && !p.has('error')) return null;
  const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
  localStorage.removeItem(PENDING_KEY);
  history.replaceState(null, '', redirectUri() + (pending?.hash || ''));
  if (p.has('error')) {
    if (pending?.silent) { store({ ...tokens, refresh_token: null, access_token: null }); return null; }
    throw new Error(p.get('error_description') || p.get('error'));
  }
  if (!pending || pending.state !== p.get('state')) throw new Error('Sign-in state mismatch, please try again.');
  await tokenRequest({ grant_type: 'authorization_code', code: p.get('code'), code_verifier: pending.verifier });
  store({ ...tokens, session_at: Date.now() });
  return { returnHash: pending.hash, silent: pending.silent };
}

// Microsoft limits browser-app sign-in sessions to 24 hours. Near the end of
// that window (or after it lapsed) we bounce through the Microsoft login page
// with prompt=none at app launch: if the browser still has a Microsoft session
// this returns straight away without asking anything. Returns true if redirecting.
export async function renewSessionIfNeeded() {
  if (!tokens?.account || !clientId() || !navigator.onLine) return false;
  const expiring = !tokens.refresh_token || Date.now() - (tokens.session_at || 0) > 22 * 3600e3;
  const lastTry = +localStorage.getItem('wa.silentAt') || 0;
  if (!expiring || Date.now() - lastTry < 10 * 60e3) return false;
  localStorage.setItem('wa.silentAt', Date.now());
  await signIn({ silent: true });
  return true;
}

async function tokenRequest(params) {
  const res = await fetch(endpoint('token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), redirect_uri: redirectUri(), scope: SCOPES, ...params }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error_description || json.error || 'Token request failed');
    err.code = json.error;
    throw err;
  }
  let acct = tokens?.account || null;
  if (json.id_token) {
    try {
      const claims = JSON.parse(atob(json.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      acct = { name: claims.name, username: claims.preferred_username || claims.email };
    } catch { /* keep previous */ }
  }
  store({
    session_at: tokens?.session_at,
    access_token: json.access_token,
    refresh_token: json.refresh_token || tokens?.refresh_token,
    expires_at: Date.now() + (json.expires_in - 120) * 1000,
    account: acct,
  });
}

export class ReauthRequired extends Error {}

let refreshing = null;
export async function accessToken(force = false) {
  if (!tokens?.refresh_token) throw new ReauthRequired('Not signed in');
  if (!force && tokens.access_token && Date.now() < tokens.expires_at) return tokens.access_token;
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })
    .catch((e) => {
      // invalid_grant = refresh token expired/revoked; the user must sign in again.
      if (e.code === 'invalid_grant' || e.code === 'interaction_required') {
        store({ ...tokens, access_token: null, refresh_token: null });
        throw new ReauthRequired('Your OneDrive session expired. Reconnect to keep syncing.');
      }
      throw e;
    })
    .finally(() => { refreshing = null; });
  await refreshing;
  return tokens.access_token;
}

// fetch() against Microsoft Graph with the bearer token, retrying once on 401.
export async function graph(path, opts = {}) {
  const url = path.startsWith('http') ? path : 'https://graph.microsoft.com/v1.0' + path;
  const go = async (force) => fetch(url, { ...opts, headers: { ...opts.headers, Authorization: 'Bearer ' + (await accessToken(force)) } });
  let res = await go(false);
  if (res.status === 401) res = await go(true);
  return res;
}
