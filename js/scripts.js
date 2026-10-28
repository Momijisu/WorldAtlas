// Scripts: passages written in another hand or alphabet.
//
//   :::cursive            a block in handwriting (or :::print, or a world's
//   My dearest Ysolde…    own font by name, e.g. :::Dwarvish Runes)
//   :::
//
//   {{Dwarvish Runes|khazad}}   a few words inside a sentence
//
// Handwriting fonts are bundled. A world can add its own fonts (for runes and
// invented alphabets); they're stored with the world's images and sync.
import * as store from './store.js';
import { esc } from './util.js';

export const HANDS = {
  cursive: { label: 'Handwriting', family: '"Cedarville Cursive", cursive' },
  print: { label: 'Handwriting (print)', family: '"Kalam", cursive' },
};

const norm = (s) => String(s || '').trim().toLowerCase();
export const fontFamily = (f) => `wa-font-${f.id}`;

// The CSS font-family for a script name in this world, or null if unknown.
export function familyFor(name, wid) {
  const n = norm(name);
  if (HANDS[n]) return HANDS[n].family;
  const f = (store.world(wid)?.fonts || []).find((x) => norm(x.name) === n);
  return f ? `"${fontFamily(f)}", serif` : null;
}

// Every script a world can use: [{ name, label, family }].
export function scriptsFor(wid) {
  return [
    ...Object.entries(HANDS).map(([name, h]) => ({ name, label: h.label, family: h.family })),
    ...(store.world(wid)?.fonts || []).map((f) => ({ name: f.name, label: f.name, family: `"${fontFamily(f)}", serif` })),
  ];
}

// Load one of a world's fonts into the page (once). Resolves false if the file
// isn't on this device yet or isn't a font the browser can read.
const loaded = new Set();
export async function loadFont(f) {
  if (loaded.has(f.id)) return true;
  const url = f.file && await store.imageURL(f.file);
  if (!url) return false;
  try {
    document.fonts.add(await new FontFace(fontFamily(f), `url("${url}")`).load());
    loaded.add(f.id);
    return true;
  } catch (e) { console.warn('Font failed to load', f.name, e); return false; }
}
export const loadWorldFonts = (wid) => Promise.all((store.world(wid)?.fonts || []).map(loadFont));

// A font name usable in :::Name and {{Name|…}}.
export const cleanFontName = (s) => String(s || '').replace(/[|{}:\[\]\n]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

// marked extensions. `world()` gives the world being rendered.
export function scriptExtensions(world) {
  const attrs = (name, cls) => {
    const fam = familyFor(name, world());
    const hand = HANDS[norm(name)];
    return `class="script ${cls}${hand ? ' hand' : ''}${fam ? '' : ' unknown'}" data-script="${esc(name)}"${fam ? ` style="font-family:${esc(fam)}"` : ` title="No font called “${esc(name)}” in this world"`}`;
  };
  return [{
    name: 'scriptBlock',
    level: 'block',
    start: (src) => src.match(/^:::/m)?.index,
    tokenizer(src) {
      const m = /^:::[ \t]*([^\n:][^\n]*)\n([\s\S]*?)\n:::[ \t]*(?:\n+|$)/.exec(src);
      if (!m) return undefined;
      const token = { type: 'scriptBlock', raw: m[0], name: m[1].trim(), tokens: [] };
      this.lexer.blockTokens(m[2], token.tokens);
      return token;
    },
    renderer(t) { return `<div ${attrs(t.name, 'script-block')}>${this.parser.parse(t.tokens)}</div>\n`; },
  }, {
    name: 'scriptInline',
    level: 'inline',
    start: (src) => src.indexOf('{{'),
    tokenizer(src) {
      const m = /^\{\{([^|{}\n]+)\|([^{}\n]+)\}\}/.exec(src);
      if (!m) return undefined;
      return { type: 'scriptInline', raw: m[0], name: m[1].trim(), tokens: this.lexer.inlineTokens(m[2]) };
    },
    renderer(t) { return `<span ${attrs(t.name, 'script-inline')}>${this.parser.parseInline(t.tokens)}</span>`; },
  }];
}
