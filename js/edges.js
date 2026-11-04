// Header edges: how an article's header image (and a world's cover on its
// overview) meets the page. Each device has a default; a world can choose its
// own, which syncs with the world. The choice is set as data-edge on the page
// element and drawn in css/features.css.
import * as store from './store.js';

export const EDGES = { fade: 'Fade', torn: 'Torn', mist: 'Mist', cut: 'Hard cut' };
const KEY = 'wa.edge';

// 1.55 called the torn (painted) edge "mist"; its worlds stored heroEdge: 'mist'.
// From 1.56 that is heroEdge: 'torn', and Mist is the cloud edge, heroEdge: 'cloud'.
const fromWorld = (v) => ({ mist: 'torn', cloud: 'mist' })[v] || v;
const toWorld = (v) => (v === 'mist' ? 'cloud' : v);

export function deviceEdge() {
  try { const v = localStorage.getItem(KEY); return EDGES[v] ? v : 'fade'; } catch { return 'fade'; }
}
export function setDeviceEdge(v) {
  try { if (v === 'fade') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch { /* storage blocked */ }
}

// The world's own choice ('' when it follows the device default).
export const worldEdge = (w) => (EDGES[fromWorld(w?.heroEdge)] ? fromWorld(w.heroEdge) : '');
export const setWorldEdge = (w, v) => { if (v) w.heroEdge = toWorld(v); else delete w.heroEdge; };
export const edgeOf = (wid) => worldEdge(wid && store.world(wid)) || deviceEdge();

// Buttons for a .seg picker; `withDefault` adds "Device default" (value '').
export const edgeSegHTML = (current, withDefault) =>
  (withDefault ? [['', 'Device default'], ...Object.entries(EDGES)] : Object.entries(EDGES))
    .map(([k, l]) => `<button type="button" data-edge-opt="${k}" class="${current === k ? 'on' : ''}">${l}</button>`).join('');

// A small header preview: the picture (or a stand-in), its edge and a title.
export const edgePreviewHTML = (edge, title = 'Article title') =>
  `<div class="edge-preview" data-edge="${edge}"><div class="edge-img hero-sample"></div><div class="edge-title">${title}</div></div>`;
