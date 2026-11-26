// A test page for player share links (design: encrypted share link, "option C").
// Not linked from anywhere: open #/lab/share. With OneDrive connected, it
// encrypts a tiny file in the browser, puts it in the app's OneDrive folder,
// asks OneDrive for a view-only "anyone with the link" link, then tries each way a
// player's browser could fetch that file without signing in, and decrypts what
// comes back. #/lab/share?t=…#k=… repeats the fetches on another device or in a
// private window. Nothing here is used by the rest of the app.
import * as auth from '../auth.js';
import { view, setTitle, icon } from '../ui.js';
import { $, esc, toast } from '../util.js';

const ROOT = '/me/drive/special/approot';
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const shareToken = (url) => 'u!' + b64url(new TextEncoder().encode(url));

async function encrypt(text) {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return { body: out, key: b64url(new Uint8Array(await crypto.subtle.exportKey('raw', key))) };
}
async function decrypt(bytes, k) {
  const key = await crypto.subtle.importKey('raw', unb64url(k), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12)));
}

// Each way a player (no sign-in) might download the file behind a share link.
const ANON_WAYS = [
  ['OneDrive API: shares/…/root/content', (t) => fetch(`https://api.onedrive.com/v1.0/shares/${t}/root/content`, { credentials: 'omit' })],
  ['OneDrive API: item details, then its download URL', async (t) => {
    const r = await fetch(`https://api.onedrive.com/v1.0/shares/${t}/root`, { credentials: 'omit' });
    if (!r.ok) return r;
    const url = (await r.json())['@content.downloadUrl'];
    return url ? fetch(url, { credentials: 'omit' }) : r;
  }],
  ['Microsoft Graph: shares/…/driveItem/content', (t) => fetch(`https://graph.microsoft.com/v1.0/shares/${t}/driveItem/content`, { credentials: 'omit' })],
  // What OneDrive's own web pages do; undocumented, so only to learn from, never to ship on.
  ['Undocumented "badger" token route (information only)', async (t) => {
    const tr = await fetch('https://api-badgerp.svc.ms/v1.0/token', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appId: '5cbed6ac-a083-4e14-b191-b4ba07653de2' }) });
    if (!tr.ok) return tr;
    const badger = (await tr.json()).token;
    const r = await fetch(`https://my.microsoftpersonalcontent.com/_api/v2.0/shares/${t}/driveitem?$select=@content.downloadUrl`, { credentials: 'omit', headers: { Authorization: 'Badger ' + badger, Prefer: 'autoredeem' } });
    if (!r.ok) return r;
    const url = (await r.json())['@content.downloadUrl'];
    return url ? fetch(url, { credentials: 'omit' }) : r;
  }],
];

export function viewShareTest(q) {
  setTitle('Share link test');
  const remote = q?.get('t')?.split('#')[0]; // the key follows a second #, never sent anywhere
  view.innerHTML = `<section class="page lab">
    <div class="page-head"><div><div class="eyebrow">Lab</div><h1>Share link test</h1></div></div>
    <p class="muted" style="max-width:720px">${remote
      ? 'Checks whether this browser can download and decrypt a player share file without signing in.'
      : 'Checks whether WorldAtlas can share an encrypted file with players through your OneDrive. It puts a small test file (nonsense text, encrypted) in your WorldAtlas OneDrive folder, makes a view-only link to it, and tries to download it the ways a player’s browser could, without signing in. <b>Clean up</b> deletes the file and its link.'}</p>
    <div class="actions left"><button class="btn primary" id="run">${icon('arrow-right')} Run the test</button>
      <button class="btn" id="copy" hidden>${icon('stack')} Copy results</button>
      <button class="btn danger" id="clean" hidden>${icon('trash')} Clean up</button></div>
    <ol class="lab-log" id="log"></ol>
    <div id="elsewhere"></div>
  </section>`;
  const log = $('#log');
  const lines = [];
  const say = (ok, what, detail = '') => {
    lines.push(`${ok === true ? '✓' : ok === false ? '✗' : '·'} ${what}${detail ? ' — ' + detail : ''}`);
    log.insertAdjacentHTML('beforeend', `<li class="${ok === true ? 'ok' : ok === false ? 'bad' : ''}"><b>${ok === true ? '✓' : ok === false ? '✗' : '·'} ${esc(what)}</b>${detail ? `<div class="small muted">${esc(detail)}</div>` : ''}</li>`);
  };
  const why = async (res) => { try { const j = await res.clone().json(); return `${res.status} ${j.error?.code || ''} ${j.error?.message || ''}`.trim(); } catch { return String(res.status); } };
  let item = null;

  const tryWays = async (token, key, expect) => {
    let any = false;
    for (const [name, way] of ANON_WAYS) {
      try {
        const res = await way(token);
        if (!res.ok) { say(false, name, await why(res)); continue; }
        const text = await decrypt(new Uint8Array(await res.arrayBuffer()), key);
        const good = !expect || text === expect;
        any ||= good;
        say(good, name, good ? 'downloaded and decrypted' : 'downloaded, but the contents didn’t match');
      } catch (e) {
        say(false, name, e instanceof TypeError ? 'blocked by the browser (no CORS permission) or the network' : e.message);
      }
    }
    return any;
  };

  $('#run').onclick = async () => {
    $('#run').disabled = true;
    log.innerHTML = ''; lines.length = 0;
    say(null, `WorldAtlas ${self.WA_VERSION}, ${navigator.userAgent}`);
    if (remote) {
      const key = location.hash.split('#k=')[1];
      if (!key) { say(false, 'No key in this link'); $('#run').disabled = false; return; }
      const any = await tryWays(remote, key);
      say(any, any ? 'A player could open a shared world here' : 'A player couldn’t open a shared world here');
      $('#copy').hidden = false; $('#run').disabled = false;
      return;
    }
    if (!auth.account()) { say(false, 'Connect OneDrive first', 'Settings → Sync → OneDrive'); $('#run').disabled = false; return; }
    const secret = 'WorldAtlas share test ' + crypto.randomUUID();
    const { body, key } = await encrypt(secret);
    say(true, 'Encrypted a test file in this browser', `${body.length} bytes, AES-GCM 256`);
    try {
      let res = await auth.graph(`${ROOT}:/share-test/test-${Date.now()}.bin:/content`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body });
      if (!res.ok) { say(false, 'Upload to your WorldAtlas folder', await why(res)); return; }
      item = await res.json();
      say(true, 'Uploaded to Apps/WorldAtlas/share-test');
      $('#clean').hidden = false;
      res = await auth.graph(`/me/drive/items/${item.id}/createLink`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'view', scope: 'anonymous' }) });
      if (!res.ok) { say(false, 'Create an “anyone with the link” view link (with the app-folder-only permission)', await why(res)); return; }
      const link = (await res.json()).link?.webUrl;
      say(true, 'Created an “anyone with the link” view link', link);
      const token = shareToken(link);
      res = await auth.graph(`/shares/${token}/driveItem/content`);
      say(res.ok, 'Signed in as you: download through the link', res.ok ? 'works (as expected for the owner)' : await why(res));
      const any = await tryWays(token, key, secret);
      say(any, any ? 'Players could download it here without signing in' : 'No way worked here without signing in');
      const there = `${location.origin}${location.pathname}#/lab/share?t=${token}#k=${key}`;
      $('#elsewhere').innerHTML = `<div class="panel" style="margin-top:1rem"><b>Try it as a player:</b> open this link on another device (a phone), or in a private window where you’re not signed in to Microsoft, and press <b>Run the test</b> there. Clean up here afterwards.
        <div class="toolbar" style="margin-top:.5rem"><input readonly value="${esc(there)}" style="flex:1"><button class="btn small" id="copyThere">${icon('stack')} Copy</button></div></div>`;
      $('#copyThere').onclick = () => navigator.clipboard.writeText(there).then(() => toast('Link copied'));
    } catch (e) {
      say(false, 'Stopped', e.message);
    } finally {
      $('#copy').hidden = false; $('#run').disabled = false;
    }
  };
  $('#copy').onclick = () => navigator.clipboard.writeText(lines.join('\n')).then(() => toast('Results copied'), () => toast('Couldn’t copy'));
  $('#clean').onclick = async () => {
    if (!item) return;
    const res = await auth.graph(`/me/drive/items/${item.id}`, { method: 'DELETE' });
    say(res.ok || res.status === 404, 'Deleted the test file and its link', res.ok ? '' : await why(res));
    item = null; $('#clean').hidden = true; $('#elsewhere').innerHTML = '';
  };
}
