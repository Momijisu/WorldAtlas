// Live-preview Markdown editor for WorldAtlas, built on CodeMirror 6.
// The text stays plain Markdown; formatting is shown as you type and the
// Markdown symbols (##, **, [[ ]] …) are hidden except on the lines the cursor
// is on. Bundled into vendor/live-editor.js by tools/live-editor/build.sh.
import { EditorState, RangeSet } from '@codemirror/state';
import { EditorView, Decoration, ViewPlugin, WidgetType, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxTree, Language, defineLanguageFacet, languageDataProp } from '@codemirror/language';
import { insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown';
import { parser as mdParser, GFM } from '@lezer/markdown';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';

// Markdown (with GitHub extras) built straight from the parser, so the bundle
// doesn't include the HTML/CSS/JS languages @codemirror/lang-markdown pulls in.
const mdData = defineLanguageFacet({ commentTokens: { block: { open: '<!--', close: '-->' } } });
const markdownLang = new Language(mdData, mdParser.configure([GFM, { props: [languageDataProp.add({ Document: mdData })] }]), [], 'markdown');
const markdownKeys = [{ key: 'Enter', run: insertNewlineContinueMarkup }, { key: 'Backspace', run: deleteMarkupBackward }];

class Bullet extends WidgetType {
  toDOM() { const s = document.createElement('span'); s.className = 'cm-bullet'; s.textContent = '•'; return s; }
  eq() { return true; }
}

const hide = Decoration.replace({});
const line = (cls, attributes) => Decoration.line({ class: cls, attributes });
const mark = (cls, attributes) => Decoration.mark({ class: cls, attributes });

const HEADINGS = { ATXHeading1: 'cm-h1', ATXHeading2: 'cm-h2', ATXHeading3: 'cm-h3', ATXHeading4: 'cm-h4', ATXHeading5: 'cm-h5', ATXHeading6: 'cm-h6' };
const WIKI = /\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]/g;
const EXCERPT = /^!\[\[[^\]\n]+\]\][ \t]*$/gm;
const INLINE_SCRIPT = /\{\{([^|{}\n]+)\|([^{}\n]+)\}\}/g;

function build(view, opts) {
  const { state } = view;
  const doc = state.doc;
  const decos = [];
  const add = (from, to, deco) => { if (from <= to) decos.push(deco.range(from, to)); };
  // Lines with the cursor or a selection show their Markdown symbols (only
  // while the editor has focus, so a freshly opened article reads cleanly).
  const active = new Set();
  if (view.hasFocus) for (const r of state.selection.ranges) {
    for (let n = doc.lineAt(r.from).number; n <= doc.lineAt(r.to).number; n++) active.add(n);
  }
  const isActive = (pos) => active.has(doc.lineAt(pos).number);
  const hideMark = (from, to) => { if (!isActive(from)) add(from, to, hide); };

  const code = []; // fenced code blocks, where ![[…]] is just text
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from, to,
      enter(node) {
        const name = node.name;
        if (HEADINGS[name]) add(doc.lineAt(node.from).from, doc.lineAt(node.from).from, line(HEADINGS[name]));
        else if (name === 'HeaderMark') {
          const after = doc.sliceString(node.to, node.to + 1) === ' ' ? 1 : 0;
          if (node.node.parent?.name.startsWith('ATXHeading')) hideMark(node.from, node.to + after);
        } else if (name === 'StrongEmphasis') add(node.from, node.to, mark('cm-strong'));
        else if (name === 'Emphasis') add(node.from, node.to, mark('cm-em'));
        else if (name === 'Strikethrough') add(node.from, node.to, mark('cm-strike'));
        else if (name === 'EmphasisMark' || name === 'StrikethroughMark') hideMark(node.from, node.to);
        else if (name === 'InlineCode') add(node.from, node.to, mark('cm-icode'));
        else if (name === 'CodeMark' && node.node.parent?.name === 'InlineCode') hideMark(node.from, node.to);
        else if (name === 'Blockquote') {
          for (let p = node.from; p <= node.to;) { const l = doc.lineAt(p); add(l.from, l.from, line('cm-quote')); p = l.to + 1; }
        } else if (name === 'QuoteMark') {
          const after = doc.sliceString(node.to, node.to + 1) === ' ' ? 1 : 0;
          hideMark(node.from, node.to + after);
        } else if (name === 'ListMark') {
          const t = doc.sliceString(node.from, node.to);
          if ((t === '-' || t === '*' || t === '+') && !isActive(node.from)) add(node.from, node.to, Decoration.replace({ widget: new Bullet() }));
        } else if (name === 'HorizontalRule') {
          add(doc.lineAt(node.from).from, doc.lineAt(node.from).from, line('cm-hr'));
          hideMark(node.from, node.to);
        } else if (name === 'FencedCode') {
          code.push([node.from, node.to]);
          for (let p = node.from; p <= node.to;) { const l = doc.lineAt(p); add(l.from, l.from, line('cm-codeblock')); p = l.to + 1; }
          return false;
        } else if (name === 'Link' && node.node.getChild('URL')) add(node.from, node.to, mark('cm-mdlink')); // [text](url) only, not the inside of [[wiki links]]
      },
    });
    // [[Wiki links]]: link-coloured (red if missing); brackets hidden off the cursor line.
    const text = doc.sliceString(from, to);
    // ![[Article#Section]] on a line of its own: an excerpt, shown as a quiet "from" line.
    for (const m of text.matchAll(EXCERPT)) {
      const s = from + m.index;
      if (code.some(([f, t]) => s >= f && s <= t)) continue;
      add(s, s, line('cm-excerpt'));
      if (!isActive(s)) add(s, s + 1, hide);
    }
    for (const m of text.matchAll(WIKI)) {
      const s = from + m.index, e = s + m[0].length;
      if (code.some(([f, t]) => s >= f && s <= t)) continue;
      const known = opts.isKnown?.(m[1].trim()) ?? true;
      add(s, e, mark(known ? 'cm-wikilink' : 'cm-wikilink cm-missing'));
      if (!isActive(s)) {
        if (m[2] != null) add(s, s + 2 + m[1].length + 1, hide); // "[[Title|" when a label is shown
        else add(s, s + 2, hide);
        add(e - 2, e, hide);
      }
    }
    // {{Font|text}}: the text in its font; the wrapper hidden off the cursor line.
    for (const m of text.matchAll(INLINE_SCRIPT)) {
      const s = from + m.index, e = s + m[0].length, ts = s + 3 + m[1].length;
      const fam = opts.fontFor?.(m[1].trim());
      add(ts, e - 2, mark(fam ? 'cm-script' : 'cm-script cm-unknown', fam ? { style: `font-family:${fam}` } : undefined));
      if (!isActive(s)) { add(s, ts, hide); add(e - 2, e, hide); }
    }
  }
  // :::Name … ::: blocks (scanned over the whole text, since a block can start above the screen).
  let open = null;
  for (let n = 1; n <= doc.lines; n++) {
    const l = doc.line(n);
    const fence = /^:::[ \t]*(.*)$/.exec(l.text);
    if (fence && !open && fence[1].trim()) {
      const fam = opts.fontFor?.(fence[1].trim());
      open = { fam, hand: opts.isHand?.(fence[1].trim()) };
      add(l.from, l.from, line('cm-fence cm-fence-open'));
    } else if (open && /^:::[ \t]*$/.test(l.text)) {
      add(l.from, l.from, line('cm-fence cm-fence-close'));
      open = null;
    } else if (open) {
      add(l.from, l.from, line(`cm-scriptline${open.hand ? ' cm-hand' : ''}${open.fam ? '' : ' cm-unknown'}`, open.fam ? { style: `font-family:${open.fam}` } : undefined));
    }
  }
  return RangeSet.of(decos, true);
}

const livePreview = (opts) => ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = build(view, opts); }
  update(u) { if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged || u.transactions.some((t) => t.reconfigured)) this.decorations = build(u.view, opts); }
}, { decorations: (v) => v.decorations });

// Suggest article titles inside [[ … ]], and that article's headings after a #.
const wikiCompletions = (titles, headings) => (ctx) => {
  const m = ctx.matchBefore(/\[\[[^\]\n|]*$/);
  if (!m) return null;
  const closed = ctx.state.sliceDoc(ctx.pos, ctx.pos + 2) === ']]';
  const hash = m.text.indexOf('#');
  if (hash >= 0) {
    return {
      from: m.from + hash + 1,
      options: (headings?.(m.text.slice(2, hash).trim()) || []).map((h) => ({ label: h, apply: closed ? h : h + ']]' })),
      validFor: /^[^\]\n|#]*$/,
    };
  }
  return {
    from: m.from + 2,
    options: titles().map((t) => ({ label: t, apply: closed ? t : t + ']]' })),
    validFor: /^[^\]\n|]*$/,
  };
};

// Create the editor in `parent`. Returns a small API around the view.
export function createLiveEditor(parent, opts = {}) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: opts.doc || '',
      extensions: [
        history(),
        keymap.of([...markdownKeys, ...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        markdownLang,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'sentences', 'aria-label': opts.label || 'Article text' }),
        autocompletion({ override: [wikiCompletions(opts.titles || (() => []), opts.headings)], icons: false }),
        livePreview(opts),
        EditorView.updateListener.of((u) => opts.onUpdate?.(u)),
      ],
    }),
  });
  return {
    view,
    getValue: () => view.state.doc.toString(),
    getSelection: () => ({ from: view.state.selection.main.from, to: view.state.selection.main.to }),
    // Replace the text and selection (e.g. after a toolbar command).
    setValue(text, from = 0, to = from) {
      const len = text.length;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: Math.min(from, len), head: Math.min(to, len) }, scrollIntoView: true });
    },
    refresh: () => view.dispatch({}),
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
