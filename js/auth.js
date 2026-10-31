// Microsoft sign-in using the OAuth 2.0 authorization-code flow with PKCE,
// which is what Microsoft recommends for single-page apps. No secrets are
// involved; the app registration must list this page as an "SPA" redirect URI.
import { CLIENT_ID, AUTHORITY } from './config.js';

const SCOPES = 'openid profile offline_access User.Read Files.ReadWrite.AppFolder';
const TOKENS_KEY = 'wa.tokens';
const PENDING_KEY = 'wa.auth.pending';

// The ID in config.js wins. Only a copy of the app without one lets each
// device enter its own (Settings → Microsoft app registration).
export const builtInClientId = !!CLIENT_ID;
if (builtInClientId) localStorage.removeItem('wa.clientId');
export const clientId = () => CLIENT_ID || localStorage.getItem('wa.clientId') || '';
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
  // Reconnecting a known account skips the account picker (Microsoft signs
  // straight back in if it can); a first connection lets you choose.
  if (tokens?.account?.username) q.set('login_hint', tokens.account.username);
  if (silent) q.set('prompt', 'none');
  else if (!tokens?.account) q.set('prompt', 'select_account');
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

// Microsoft limits browser-app sign-in sessions to 24 hours. Before that runs
// out we renew in the background, in a hidden frame with prompt=none: if the
// browser still has a Microsoft session it answers at once and nothing is
// shown. The frame comes back to this app's page, whose first script (in
// index.html) hands the result to us and stops. Browsers that block
// third-party sign-in cookies can't do this; they show Reconnect instead.
const RENEW_AFTER = 20 * 3600e3;
let renewing = null, lastFailedAt = 0;

export const needsRenewal = () => !!(tokens?.account && clientId()
  && (!tokens.refresh_token || Date.now() - (tokens.session_at || 0) > RENEW_AFTER));

// Resolves true if the session was renewed.
export function renewSilently() {
  if (!tokens?.account || !clientId() || !navigator.onLine || Date.now() - lastFailedAt < 10 * 60e3) return Promise.resolve(false);
  renewing ??= frameSignIn().then((ok) => { if (!ok) lastFailedAt = Date.now(); return ok; }).finally(() => { renewing = null; });
  return renewing;
}

async function frameSignIn() {
  const verifier = randomString(48);
  const state = randomString(16);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const q = new URLSearchParams({
    client_id: clientId(), response_type: 'code', redirect_uri: redirectUri(), scope: SCOPES,
    code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'none',
  });
  if (tokens.account.username) q.set('login_hint', tokens.account.username);
  const search = await new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.setAttribute('aria-hidden', 'true');
    const finish = (v) => { clearTimeout(timer); removeEventListener('message', onMessage); frame.remove(); resolve(v); };
    const onMessage = (e) => {
      if (e.origin === location.origin && e.source === frame.contentWindow && typeof e.data?.waAuth === 'string') finish(e.data.waAuth);
    };
    const timer = setTimeout(() => finish(null), 20000); // e.g. Microsoft wanted to show a page
    addEventListener('message', onMessage);
    frame.src = endpoint('authorize') + '?' + q;
    document.body.appendChild(frame);
  });
  const p = new URLSearchParams(search || '');
  if (!p.get('code') || p.get('state') !== state) return false;
  try {
    await tokenRequest({ grant_type: 'authorization_code', code: p.get('code'), code_verifier: verifier });
    store({ ...tokens, session_at: Date.now() });
    return true;
  } catch { return false; }
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
      const bin = atob(json.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
      const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
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

// OneDrive asked us to slow down (429/503) and the wait it wants is long.
export class Throttled extends Error {
  constructor(seconds) { super('OneDrive is busy. Syncing again shortly.'); this.seconds = seconds; }
}

// Run a request with OneDrive's retry rules. Throttling (429/503): wait as long
// as it asks (Retry-After) if that's short, up to twice; otherwise throw
// Throttled. A passing server error (500/502/504) or a dropped connection:
// try once more after a moment.
export async function patient(request) {
  for (let attempt = 0, blips = 0; ; attempt++) {
    let res;
    try { res = await request(); } catch (e) {
      if (e instanceof ReauthRequired || blips++ || !navigator.onLine) throw e;
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if ([500, 502, 504].includes(res.status) && !blips++) { await new Promise((r) => setTimeout(r, 2000)); continue; }
    if (res.status !== 429 && res.status !== 503) return res;
    const wait = Math.max(1, +res.headers.get('Retry-After') || 10);
    if (attempt >= 2 || wait > 20) throw new Throttled(wait);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

// fetch() against Microsoft Graph with the bearer token, retrying once on 401,
// with OneDrive's retry rules (patient).
export function graph(path, opts = {}) {
  const url = path.startsWith('http') ? path : 'https://graph.microsoft.com/v1.0' + path;
  const go = async (force) => fetch(url, { ...opts, headers: { ...opts.headers, Authorization: 'Bearer ' + (await accessToken(force)) } });
  return patient(async () => {
    let res = await go(false);
    if (res.status === 401) res = await go(true);
    if (res.status === 401) throw new ReauthRequired('Your Microsoft sign-in has expired. Reconnect to keep syncing.');
    return res;
  });
}
