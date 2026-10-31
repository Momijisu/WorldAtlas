// A fake OneDrive (Microsoft Graph) for the sync tests: the app-folder
// endpoints WorldAtlas uses, with eTags (If-Match / If-None-Match), folder
// listing, move/rename, delete, sign-in tokens, and an optional throttle that
// answers 429 with Retry-After. Real OneDrive refuses folder creation by POST
// to the app root, so this does too.
module.exports = function fakeDrive() {
  const files = new Map(); let n = 0; const log = []; const extraFolders = new Set(); const throttle = { left: 0, after: 1 };
  const cors = { 'access-control-allow-origin': '*' };
  const parent = (p) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
  const folderExists = (p) => extraFolders.has(p) || [...files.keys()].some((k) => k.startsWith(p + '/'));
  const meta = (p) => { const f = files.get(p); if (f) return { id: 'i:' + p, name: p.split('/').pop(), eTag: f.eTag, file: { mimeType: f.type }, parentReference: { path: '/drive/special/approot:/' + parent(p) }, '@microsoft.graph.downloadUrl': 'https://dl.example/' + encodeURIComponent(p) };
    if (folderExists(p)) return { id: 'f:' + p, name: p.split('/').pop(), folder: {} }; return null; };
  const move = (from, to) => { for (const k of [...files.keys()]) if (k === from || k.startsWith(from + '/')) { files.set(to + k.slice(from.length), files.get(k)); files.delete(k); }
    for (const f of [...extraFolders]) if (f === from || f.startsWith(from + '/')) { extraFolders.delete(f); extraFolders.add(to + f.slice(from.length)); } };
  async function graph(route) {
    const req = route.request(); const u = new URL(req.url()); const m = req.method();
    if (u.hostname === 'login.microsoftonline.com') return route.fulfill({ headers: cors, json: { access_token: 'AT', refresh_token: 'RT2', expires_in: 3600 } });
    if (u.hostname === 'dl.example') { const f = files.get(decodeURIComponent(u.pathname.slice(1))); return f ? route.fulfill({ body: f.body, headers: cors }) : route.fulfill({ status: 404, headers: cors }); }
    const path = decodeURIComponent(u.pathname);
    if (path.endsWith('/approot/children') && m === 'POST') return route.fulfill({ status: 400, headers: cors, json: { error: { message: 'Invalid request' } } }); // as real OneDrive does
    if (throttle.left > 0 && !path.includes('dl.example')) { throttle.left--; log.push('429'); return route.fulfill({ status: 429, headers: { ...cors, 'Retry-After': String(throttle.after), 'access-control-expose-headers': 'Retry-After' }, json: { error: { message: 'throttled' } } }); }
    if (path.endsWith('/approot/children') && m === 'GET') { const kids = new Set(); for (const k of [...files.keys(), ...extraFolders]) kids.add(k.split('/')[0]);
      return route.fulfill({ headers: cors, json: { value: [...kids].map((name) => ({ name })) } }); }
    const mm = path.match(/approot:\/(.+?)(:\/content|:\/children)?$/); const p = mm[1]; const h = req.headers();
    log.push(m + ' ' + p + (mm[2] || ''));
    if (mm[2] === ':/children') { const kids = new Set(); for (const k of [...files.keys(), ...extraFolders]) if (k.startsWith(p + '/')) { const rest = k.slice(p.length + 1); if (rest.includes('/')) kids.add(rest.split('/')[0]); }
      return route.fulfill({ headers: cors, json: { value: [...kids].map((name) => ({ name, folder: {} })) } }); }
    if (m === 'GET') { const it = meta(p); return it ? route.fulfill({ headers: cors, json: it }) : route.fulfill({ status: 404, headers: cors, json: { error: { message: 'nf' } } }); }
    if (m === 'PUT') { const f = files.get(p);
      if (h['if-match'] && (!f || f.eTag !== h['if-match'])) return route.fulfill({ status: 412, headers: cors, json: { error: { message: 'pre' } } });
      if (h['if-none-match'] && f) return route.fulfill({ status: 412, headers: cors, json: { error: { message: 'pre' } } });
      const nf = { body: req.postDataBuffer(), eTag: 'e' + (++n), type: h['content-type'] }; files.set(p, nf); return route.fulfill({ headers: cors, json: { eTag: nf.eTag } }); }
    if (m === 'PATCH') { if (!meta(p)) return route.fulfill({ status: 404, headers: cors, json: { error: { message: 'nf' } } });
      const body = JSON.parse(req.postData()); const dir = body.parentReference?.id ? body.parentReference.id.slice(2) : parent(p);
      const to = (dir ? dir + '/' : '') + (body.name || p.split('/').pop()); if (meta(to)) return route.fulfill({ status: 409, headers: cors, json: { error: { message: 'exists' } } });
      move(p, to); return route.fulfill({ headers: cors, json: meta(to) }); }
    if (m === 'DELETE') { for (const k of [...files.keys()]) if (k === p || k.startsWith(p + '/')) files.delete(k); extraFolders.delete(p); return route.fulfill({ status: 204, headers: cors }); }
    return route.fallback();
  }
  // Everything in all world folders, combined like the old atlas.json.
  const all = () => { const out = { worlds: [], articles: [], maps: [] };
    for (const [k, f] of files) if (/^Worlds\/[^/]+\/world\.json$/.test(k)) { const j = JSON.parse(f.body.toString()); for (const s of Object.keys(out)) out[s].push(...(j[s] || [])); }
    return out; };
  const history = () => [...files].filter(([k]) => /^Worlds\/[^/]+\/history\.json$/.test(k)).flatMap(([, f]) => JSON.parse(f.body.toString()).history || []);
  return { files, log, graph, all, history, throttle, bump: () => ++n };
};
