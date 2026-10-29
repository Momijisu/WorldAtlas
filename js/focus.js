// Image focus: which part of a picture stays in view when it's cropped to fit
// (world covers, header banners). Stored as [x, y] percentages next to the
// image id, and applied as background-position / object-position.

export const DEFAULT_POS = [50, 50];
export const BANNER_POS = [50, 35]; // article header images favour the upper part

export const posCSS = (pos, fallback = DEFAULT_POS) => {
  const [x, y] = Array.isArray(pos) && pos.length === 2 ? pos : fallback;
  return `${+x || 0}% ${+y || 0}%`;
};

const clamp = (v) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;

// Make an <img> preview draggable to choose the focus. The preview is cropped
// to `ratio` (width / height, or a function giving it) like the real display;
// `fallback` is where an undragged picture sits there. get()/set() read and
// write the [x, y] value.
export function wireFocus(img, { get, set, ratio, fallback = DEFAULT_POS }) {
  img.classList.add('focus-pick');
  const shape = () => { img.style.aspectRatio = String(typeof ratio === 'function' ? ratio() : ratio); };
  shape();
  if (typeof ratio === 'function') {
    const onResize = () => (img.isConnected ? shape() : removeEventListener('resize', onResize));
    addEventListener('resize', onResize);
  }
  img.draggable = false;
  img.tabIndex = 0;
  img.title = 'Drag to choose which part of the picture shows';
  img.setAttribute('aria-label', 'Image focus. Drag, or use the arrow keys, to move the picture.');
  const show = () => { img.style.objectPosition = posCSS(get(), fallback); };
  show();

  // How far (px) the picture overflows the frame on each axis.
  const overflow = () => {
    const w = img.clientWidth, h = img.clientHeight;
    const nw = img.naturalWidth || w, nh = img.naturalHeight || h;
    const s = Math.max(w / nw, h / nh);
    return [nw * s - w, nh * s - h];
  };

  let drag = null;
  img.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    img.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, pos: [...(get() || fallback)], over: overflow() };
    img.classList.add('dragging');
  });
  img.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [ox, oy] = drag.over;
    // Dragging the picture right reveals more of its left side.
    const x = ox > 1 ? clamp(drag.pos[0] - ((e.clientX - drag.x) / ox) * 100) : 50;
    const y = oy > 1 ? clamp(drag.pos[1] - ((e.clientY - drag.y) / oy) * 100) : 50;
    set([x, y]);
    show();
  });
  const end = () => { drag = null; img.classList.remove('dragging'); };
  img.addEventListener('pointerup', end);
  img.addEventListener('pointercancel', end);
  img.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [5, 0], ArrowRight: [-5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (!d) return;
    e.preventDefault();
    const [x, y] = get() || fallback;
    set([clamp(x + d[0]), clamp(y + d[1])]);
    show();
  });
  return { refresh: () => { shape(); show(); } };
}
