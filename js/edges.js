// Header edges: how an article's header image (and a world's cover on its
// overview) meets the page. Chosen per world (it syncs with the world); Fade
// unless a world chooses another. The choice is set as data-edge on the page
// element and drawn in css/features.css.
import * as store from './store.js';

export const EDGES = { fade: 'Fade', torn: 'Torn', mist: 'Mist', cut: 'Hard cut' };
const KEY = 'wa.edge';

// 1.55 called the torn (painted) edge "mist"; its worlds stored heroEdge: 'mist'.
// From 1.56 that is heroEdge: 'torn', and Mist is the cloud edge, heroEdge: 'cloud'.
const fromWorld = (v) => ({ mist: 'torn', cloud: 'mist' })[v] || v;
const toWorld = (v) => (v === 'mist' ? 'cloud' : v);

// Worlds that haven't chosen an edge use Fade.
export const DEFAULT_EDGE = 'fade';

// Before 1.58 each device had a default edge (localStorage wa.edge); it moves
// into the worlds that hadn't chosen their own (js/backgrounds.js moveDeviceDefaults).
export function oldDeviceEdge() {
  try { const v = localStorage.getItem('wa.edge'); return EDGES[v] && v !== DEFAULT_EDGE ? v : null; } catch { return null; }
}

// The world's own choice ('' when it follows the device default).
export const worldEdge = (w) => (EDGES[fromWorld(w?.heroEdge)] ? fromWorld(w.heroEdge) : '');
export const setWorldEdge = (w, v) => { if (v && v !== DEFAULT_EDGE) w.heroEdge = toWorld(v); else delete w.heroEdge; };
export const edgeOf = (wid) => worldEdge(wid && store.world(wid)) || DEFAULT_EDGE;

// Buttons for a .seg picker.
export const edgeSegHTML = (current) => Object.entries(EDGES)
  .map(([k, l]) => `<button type="button" data-edge-opt="${k}" class="${(current || DEFAULT_EDGE) === k ? 'on' : ''}">${l}</button>`).join('');

// A small header preview: the picture (or a stand-in), its edge and a title.
export const edgePreviewHTML = (edge, title = 'Article title') =>
  `<div class="edge-preview" data-edge="${edge}"><div class="edge-img hero-sample"></div><div class="edge-title">${title}</div></div>`;
