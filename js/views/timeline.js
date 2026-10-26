// Timeline: a chronicle (vertical, grouped by era) and a span chart
// (horizontal bars for lifespans, reigns, wars…), both on the world's calendar.
import * as store from '../store.js';
import { TYPES } from '../store.js';
import { plain } from '../markdown.js';
import {
  calendarOf, articleStart, articleEnd, articleDateText, dayNumber, yearLength, eraFor, formatYear,
} from '../calendar.js';
import { $, $$, esc } from '../util.js';
import { view, state, setTitle, pageHead, icon, typeIcon, worldCrumb, sep } from '../ui.js';

export function viewTimeline(wid) {
  const w = store.world(wid);
  const cal = calendarOf(w);
  const ylen = yearLength(cal);
  setTitle('Timeline');
  const dated = store.articlesOf(wid).filter((a) => articleStart(a))
    .map((a) => {
      const s = dayNumber(cal, articleStart(a));
      const endD = articleEnd(a);
      let e = endD ? dayNumber(cal, endD) + (endD.m == null ? ylen - 1 : endD.d == null ? cal.months[endD.m].days - 1 : 0) : null;
      if (e != null && e < s) e = null;
      return { a, s, e, open: e == null && a.type === 'character' && cal.currentYear != null && cal.currentYear >= articleStart(a).y };
    })
    .sort((x, y) => x.s - y.s || (x.e ?? x.s) - (y.e ?? y.s) || x.a.title.localeCompare(y.a.title));
  const types = [...new Set(dated.map((d) => d.a.type))];
  const tags = [...new Set(dated.flatMap((d) => d.a.tags || []))].sort();
  const f = { mode: localStorage.getItem('wa.tlMode') || 'chronicle', types: new Set(), tag: '', text: '' };

  view.innerHTML = `<section class="page${f.mode === 'spans' ? ' wide' : ''}" id="tlPage">
    ${pageHead({
      eyebrow: `${worldCrumb(wid)} ${sep} Chronicle`,
      title: 'Timeline',
      actions: `<div class="seg" id="mode"><button data-m="chronicle">${icon('list-bullets')} Chronicle</button><button data-m="spans">${icon('chart-bar-horizontal')} Spans</button></div>
        <a class="btn primary" href="#/w/${wid}/new/event">${icon('plus')} New event</a>`,
    })}
    ${dated.length ? `
      <div class="toolbar">
        <input type="search" id="tlText" placeholder="Filter events…">
        ${tags.length ? `<select id="tlTag"><option value="">All tags</option>${tags.map((t) => `<option>${esc(t)}</option>`).join('')}</select>` : ''}
      </div>
      ${types.length > 1 ? `<div class="chips" id="tlTypes">${types.map((t) => `<button class="chip" data-t="${t}">${icon(TYPES[t]?.icon)} ${TYPES[t]?.plural}</button>`).join('')}</div>` : ''}
      <div id="tlOut"></div>`
    : `<div class="empty-state small"><p>Nothing is dated yet. Open any article’s editor and set a date under <b>Chronology</b> — births, foundings, battles, reigns — and it will take its place here.</p></div>`}
  </section>`;
  const modeSeg = $('#mode');
  const syncMode = () => {
    for (const b of modeSeg.children) b.classList.toggle('on', b.dataset.m === f.mode);
    $('#tlPage').classList.toggle('wide', f.mode === 'spans');
  };
  modeSeg.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    f.mode = b.dataset.m;
    localStorage.setItem('wa.tlMode', f.mode);
    syncMode(); draw();
  };
  syncMode();
  if (!dated.length) return;

  $('#tlText').oninput = (e) => { f.text = e.target.value.trim().toLowerCase(); draw(); };
  $('#tlTag')?.addEventListener('change', (e) => { f.tag = e.target.value; draw(); });
  $('#tlTypes')?.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    f.types.has(c.dataset.t) ? f.types.delete(c.dataset.t) : f.types.add(c.dataset.t);
    c.classList.toggle('on');
    draw();
  });

  const visible = () => dated.filter(({ a }) =>
    (!f.types.size || f.types.has(a.type)) && (!f.tag || (a.tags || []).includes(f.tag)) &&
    (!f.text || a.title.toLowerCase().includes(f.text) || (a.summary || '').toLowerCase().includes(f.text)));

  function draw() {
    state.cleanup?.();
    state.cleanup = null;
    const items = visible();
    if (!items.length) { $('#tlOut').innerHTML = '<div class="empty-state small"><p>No events match these filters.</p></div>'; return; }
    if (f.mode === 'spans') drawSpans(items); else drawChronicle(items);
  }

  function duration(it) {
    if (it.e == null) return '';
    const years = Math.floor((it.e - it.s + 1) / ylen);
    return years >= 1 ? `${years} year${years === 1 ? '' : 's'}` : `${it.e - it.s + 1} days`;
  }

  function drawChronicle(items) {
    let html = '<ol class="chronicle">';
    let lastEra = undefined;
    for (const it of items) {
      const y = articleStart(it.a).y;
      const era = eraFor(cal, y);
      if (era !== lastEra && cal.eras.length) {
        html += `<li class="era-mark"><span>${esc(era ? era.name : 'Before recorded eras')}</span></li>`;
        lastEra = era;
      }
      html += `<li class="chron-item">
        <div class="chron-date">${esc(articleDateText(cal, it.a))}${duration(it) ? `<small>${duration(it)}</small>` : ''}</div>
        <div class="chron-node">${typeIcon(it.a.type)}</div>
        <a class="chron-card" href="#/w/${wid}/a/${it.a.id}">
          <span class="chron-title">${esc(it.a.title)}</span>
          ${it.a.summary ? `<span class="chron-sum">${esc(plain(it.a.summary, 220))}</span>` : ''}
        </a>
      </li>`;
    }
    html += '</ol>';
    if (cal.currentYear != null) html += `<p class="muted small center">The present day: ${esc(formatYear(cal, cal.currentYear))}</p>`;
    $('#tlOut').innerHTML = html;
  }

  function drawSpans(items) {
    const nowDay = cal.currentYear != null ? dayNumber(cal, { y: cal.currentYear, m: cal.months.length - 1, d: cal.months.at(-1).days }) : null;
    const ends = items.map((it) => it.e ?? (it.open ? nowDay : it.s));
    let min = Math.min(...items.map((it) => it.s));
    let max = Math.max(...ends, nowDay ?? -Infinity);
    const pad = Math.max(ylen, (max - min) * 0.04);
    min -= pad; max += pad;
    $('#tlOut').innerHTML = `<div class="spans">
      <div class="spans-tools"><button class="icon-btn" data-z="out" title="Zoom out">${icon('magnifying-glass-minus')}</button><button class="icon-btn" data-z="in" title="Zoom in">${icon('magnifying-glass-plus')}</button><button class="icon-btn" data-z="fit" title="Fit">${icon('corners-out')}</button></div>
      <div class="spans-scroll"><div class="spans-inner"></div></div></div>`;
    const scroll = $('.spans-scroll');
    const inner = $('.spans-inner');
    const LABEL = Math.min(220, Math.max(130, scroll.clientWidth * 0.3));
    let pxPerDay = Math.max(1e-6, (scroll.clientWidth - LABEL - 24) / (max - min));
    const render = () => {
      const width = (max - min) * pxPerDay;
      const x = (d) => (d - min) * pxPerDay;
      // axis ticks in years at a readable spacing
      const yearsSpan = (max - min) / ylen;
      const pxPerYear = ylen * pxPerDay;
      const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
      const step = nice.find((n) => n * pxPerYear >= 90) || Math.ceil(yearsSpan / 5);
      const firstY = Math.ceil(min / ylen / step) * step;
      let ticks = '';
      for (let y = firstY; y * ylen <= max; y += step) {
        ticks += `<div class="tick" style="left:${x(y * ylen)}px"><span>${esc(formatYear(cal, y))}</span></div>`;
      }
      inner.style.width = LABEL + width + 24 + 'px';
      inner.style.setProperty('--label', LABEL + 'px');
      inner.innerHTML = `<div class="spans-axis">${ticks}</div>
        ${nowDay != null ? `<div class="now-line" style="left:${LABEL + x(nowDay)}px"><span>Now</span></div>` : ''}
        ${items.map((it) => {
          const end = it.e ?? (it.open ? nowDay : null);
          const left = x(it.s);
          const bar = end != null
            ? `<a class="bar${it.open ? ' open' : ''}" href="#/w/${wid}/a/${it.a.id}" style="left:${left}px;width:${Math.max(3, x(end + 1) - left)}px" title="${esc(articleDateText(cal, it.a))}"></a>`
            : `<a class="point" href="#/w/${wid}/a/${it.a.id}" style="left:${left}px" title="${esc(articleDateText(cal, it.a))}"></a>`;
          return `<div class="span-row type-${it.a.type}">
            <a class="span-label" href="#/w/${wid}/a/${it.a.id}">${typeIcon(it.a.type)}<span>${esc(it.a.title)}</span></a>
            <div class="span-track">${bar}</div>
          </div>`;
        }).join('')}`;
    };
    render();
    const zoom = (k) => {
      const center = (scroll.scrollLeft + (scroll.clientWidth - LABEL) / 2) / pxPerDay;
      pxPerDay = k === 'fit' ? Math.max(1e-6, (scroll.clientWidth - LABEL - 24) / (max - min)) : pxPerDay * (k === 'in' ? 1.6 : 1 / 1.6);
      render();
      scroll.scrollLeft = k === 'fit' ? 0 : center * pxPerDay - (scroll.clientWidth - LABEL) / 2;
    };
    $$('[data-z]').forEach((b) => { b.onclick = () => zoom(b.dataset.z); });
  }

  draw();
}
