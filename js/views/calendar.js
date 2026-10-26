// World calendar: month and year views of dated articles, plus the calendar editor
// (months, weekdays, eras, moons).
import * as store from '../store.js';
import {
  calendarOf, presetCalendar, PRESETS, dayNumber, weekdayOf, moonPhase, moonGlyph, formatYear, formatDate,
  articleStart, articleEnd, yearLength, eraFor,
} from '../calendar.js';
import { $, $$, esc, toast, confirmDialog, modal } from '../util.js';
import { view, state, setTitle, pageHead, icon, typeIcon, worldCrumb, sep } from '../ui.js';

export function viewCalendar(wid, q) {
  const w = store.world(wid);
  const cal = calendarOf(w);
  const dated = store.articlesOf(wid).filter((a) => articleStart(a));
  const fallbackYear = cal.currentYear ?? (dated.length ? Math.max(...dated.map((a) => articleStart(a).y)) : 1);
  let y = q.has('y') ? +q.get('y') : fallbackYear;
  let m = q.has('m') ? Math.min(+q.get('m'), cal.months.length - 1) : 0;
  let mode = q.get('view') === 'year' ? 'year' : 'month';
  setTitle('Calendar');

  view.innerHTML = `<section class="page wide">
    ${pageHead({
      eyebrow: `${worldCrumb(wid)} ${sep} Chronicle`,
      title: 'Calendar',
      actions: `<div class="seg" id="calMode"><button data-v="month">Month</button><button data-v="year">Year</button></div>
        <a class="btn" href="#/w/${wid}/calendar/edit">${icon('gear-six')} Configure</a>`,
    })}
    <div class="cal-nav">
      <button class="icon-btn" id="prev" title="Previous">${icon('caret-left')}</button>
      <h2 id="calTitle"></h2>
      <button class="icon-btn" id="next" title="Next">${icon('caret-right')}</button>
      <span class="spacer"></span>
      <label class="inline cal-jump">Year <input type="number" id="jumpYear" step="1"></label>
      ${cal.currentYear != null ? `<button class="btn small" id="today">Present day</button>` : ''}
    </div>
    <div id="calOut"></div>
    ${cal.moons.length ? `<div class="moon-legend">${cal.moons.map((mo) => `<span>${moonGlyph(0.5, mo.color || 'currentColor')} ${esc(mo.name)} <small>${mo.cycle}-day cycle</small></span>`).join('')}</div>` : ''}
  </section>`;

  const go = () => history.replaceState(null, '', `#/w/${wid}/calendar?y=${y}&m=${m}${mode === 'year' ? '&view=year' : ''}`);
  const step = (dir) => {
    if (mode === 'year') y += dir;
    else { m += dir; if (m < 0) { m = cal.months.length - 1; y--; } if (m >= cal.months.length) { m = 0; y++; } }
    draw();
  };
  $('#prev').onclick = () => step(-1);
  $('#next').onclick = () => step(1);
  $('#jumpYear').onchange = (e) => { if (e.target.value !== '') { y = Math.round(+e.target.value); draw(); } };
  $('#today')?.addEventListener('click', () => { y = cal.currentYear; m = 0; draw(); });
  $('#calMode').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) { mode = b.dataset.v; draw(); }
  };

  // Articles by precision for quick lookup.
  const onDay = new Map(), onMonth = new Map(), onYear = new Map();
  const push = (map, key, val) => { if (!map.has(key)) map.set(key, []); map.get(key).push(val); };
  for (const a of dated) {
    for (const [d, ends] of [[articleStart(a), false], [articleEnd(a), true]]) {
      if (!d || (ends && sameDate(d, articleStart(a)))) continue;
      if (d.m != null && d.d != null) push(onDay, dayNumber(cal, d), { a, ends });
      else if (d.m != null) push(onMonth, `${d.y}:${d.m}`, { a, ends });
      else push(onYear, d.y, { a, ends });
    }
  }

  function draw() {
    go();
    for (const b of $('#calMode').children) b.classList.toggle('on', b.dataset.v === mode);
    $('#jumpYear').value = y;
    const era = eraFor(cal, y);
    $('#calTitle').innerHTML = mode === 'year'
      ? esc(formatYear(cal, y)) + (era ? ` <small>${esc(era.name)}</small>` : '')
      : `${esc(cal.months[m].name)} <small>${esc(formatYear(cal, y))}</small>`;
    $('#calOut').innerHTML = mode === 'year' ? yearView() : monthView();
    $$('.cal-day[data-day]').forEach((cell) => cell.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const [cy, cm, cd] = cell.dataset.day.split(':').map(Number);
      const add = `#/w/${wid}/new/event?y=${cy}&m=${cm}&d=${cd}`;
      const evs = onDay.get(dayNumber(cal, { y: cy, m: cm, d: cd })) || [];
      // On small screens the event markers are too small to tap, so list the day's events.
      if (evs.length && matchMedia('(max-width: 700px)').matches) {
        modal(formatDate(cal, { y: cy, m: cm, d: cd }), `<div class="cal-list">${evs.map(chip).join('')}</div>
          <div class="actions" style="margin-top:1rem"><a class="btn primary" href="${add}" data-go>${icon('plus')} Add event</a></div>`,
        { onMount: (el, close) => $$('a', el).forEach((a) => a.addEventListener('click', () => close())) });
        return;
      }
      location.hash = add;
    }));
    $$('[data-month]').forEach((el) => el.addEventListener('click', () => { m = +el.dataset.month; mode = 'month'; draw(); }));
  }

  const chip = ({ a, ends }) => `<a class="cal-ev type-${a.type}" href="#/w/${wid}/a/${a.id}" title="${esc(a.title)}">${typeIcon(a.type)}<span>${ends ? 'Ends: ' : ''}${esc(a.title)}</span></a>`;

  function monthView() {
    const first = dayNumber(cal, { y, m, d: 1 });
    const lead = weekdayOf(cal, first);
    const days = +cal.months[m].days;
    const n = cal.weekdays.length;
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<div class="cal-day blank"></div>';
    for (let d = 1; d <= days; d++) {
      const dn = first + d - 1;
      const evs = onDay.get(dn) || [];
      cells += `<div class="cal-day${evs.length ? ' has-ev' : ''}" data-day="${y}:${m}:${d}" title="Add an event on ${esc(formatDate(cal, { y, m, d }))}">
        <div class="cal-dn"><span>${d}</span><span class="cal-moons">${cal.moons.map((mo) => {
          const ph = moonPhase(mo, dn);
          const notable = ph < 1 / mo.cycle || Math.abs(ph - 0.5) < 0.5 / mo.cycle;
          return notable || cal.moons.length === 1 ? `<span title="${esc(mo.name)}">${moonGlyph(ph, mo.color || 'currentColor', 13)}</span>` : '';
        }).join('')}</span></div>
        ${evs.map(chip).join('')}
      </div>`;
    }
    const monthEvs = onMonth.get(`${y}:${m}`) || [];
    const yearEvs = onYear.get(y) || [];
    return `<div class="cal-grid" style="--cols:${n}">
        ${cal.weekdays.map((wd) => `<div class="cal-wd" title="${esc(wd)}"><span class="full">${esc(wd)}</span><span class="short">${esc(wd.slice(0, 2))}</span></div>`).join('')}
        ${cells}
      </div>
      ${monthEvs.length || yearEvs.length ? `<div class="cal-extra">
        ${monthEvs.length ? `<div><div class="field-label">During ${esc(cal.months[m].name)}</div><div class="cal-list">${monthEvs.map(chip).join('')}</div></div>` : ''}
        ${yearEvs.length ? `<div><div class="field-label">During ${esc(formatYear(cal, y))}</div><div class="cal-list">${yearEvs.map(chip).join('')}</div></div>` : ''}
      </div>` : ''}
      <p class="muted small">Tap a day to record an event on it. ${cal.months.length} months · ${yearLength(cal)} days a year.</p>`;
  }

  function yearView() {
    const yearEvs = onYear.get(y) || [];
    return `<div class="cal-year">${cal.months.map((mo, mi) => {
      const first = dayNumber(cal, { y, m: mi, d: 1 });
      const lead = weekdayOf(cal, first);
      let cells = '';
      for (let i = 0; i < lead; i++) cells += '<span></span>';
      for (let d = 1; d <= mo.days; d++) cells += `<span class="${onDay.has(first + d - 1) ? 'ev' : ''}">${d}</span>`;
      const count = [...Array(+mo.days).keys()].reduce((s, i) => s + (onDay.get(first + i)?.length || 0), 0) + (onMonth.get(`${y}:${mi}`)?.length || 0);
      return `<button class="mini-month" data-month="${mi}">
        <span class="mini-name">${esc(mo.name)}${count ? ` <small>${count}</small>` : ''}</span>
        <span class="mini-grid" style="--cols:${cal.weekdays.length}">${cells}</span>
      </button>`;
    }).join('')}</div>
    ${yearEvs.length ? `<div class="cal-extra"><div><div class="field-label">During ${esc(formatYear(cal, y))}</div><div class="cal-list">${yearEvs.map(chip).join('')}</div></div></div>` : ''}`;
  }

  draw();
}

const sameDate = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;

// ---------------------------------------------------------------- editor

export function viewCalendarEdit(wid) {
  const w = store.world(wid);
  const base = calendarOf(w);
  const c = structuredClone(w.calendar || {
    ...presetCalendar('standard'),
    eras: base.eras.map((e) => ({ ...e, start: isFinite(e.start) ? e.start : '' })),
  });
  c.eras = (c.eras || []).map((e) => ({ ...e, start: e.start === -Infinity || e.start == null ? '' : e.start }));
  c.moons ||= [];
  let dirty = false;
  state.guard = () => !dirty || confirm('Discard calendar changes?');
  setTitle('Calendar settings');

  view.innerHTML = `<form class="page narrow cal-edit" id="cf">
    ${pageHead({
      sticky: true,
      eyebrow: `${worldCrumb(wid)} ${sep} <a href="#/w/${wid}/calendar">Calendar</a> ${sep} Settings`,
      title: 'Calendar settings',
      actions: `<a class="btn quiet" href="#/w/${wid}/calendar">Cancel</a><button class="btn primary">${icon('check')} Save</button>`,
    })}
    <div class="panel">
      <h2>Start from a preset</h2>
      <div class="toolbar" style="margin:0">
        <select id="preset">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join('')}</select>
        <button type="button" class="btn" id="applyPreset">Apply</button>
      </div>
      <p class="muted small">Replaces the months and weekdays below. Eras and moons are kept.</p>
    </div>
    <div class="panel">
      <h2>Months</h2>
      <div id="months"></div>
      <button type="button" class="btn small" id="addMonth">${icon('plus')} Add month</button>
      <p class="muted small" id="yearLen"></p>
    </div>
    <div class="panel">
      <h2>Weekdays</h2>
      <label>One per line<textarea id="weekdays" rows="7"></textarea></label>
      <label>The first day of year 0 falls on <select id="epoch"></select></label>
    </div>
    <div class="panel">
      <h2>Eras</h2>
      <p class="muted small">An era applies from its start year onwards, until the next era begins. Its abbreviation follows the year, e.g. “1042 AE”. Tick <i>Count from 1</i> to number years from the start of the era.</p>
      <div id="eras"></div>
      <button type="button" class="btn small" id="addEra">${icon('plus')} Add era</button>
    </div>
    <div class="panel">
      <h2>Moons</h2>
      <p class="muted small">Phases appear on the calendar. Offset shifts which day the moon is new.</p>
      <div id="moons"></div>
      <button type="button" class="btn small" id="addMoon">${icon('plus')} Add moon</button>
    </div>
    <div class="panel">
      <h2>The present day</h2>
      <label>Current year <small>used for “Present day” and for open-ended lifespans on the timeline</small><input type="number" id="curYear" step="1" value="${c.currentYear ?? ''}"></label>
      <div class="date-preview" id="sample"></div>
    </div>
  </form>`;

  const f = $('#cf');
  f.addEventListener('input', () => { dirty = true; refresh(); });
  f.addEventListener('change', () => { dirty = true; refresh(); });

  const rowList = (el, items, tpl, onRemove) => {
    el.innerHTML = items.map((it, i) => `<div class="cal-row" data-i="${i}">${tpl(it, i)}
      <button type="button" class="icon-btn" data-rm="${i}" title="Remove">${icon('x')}</button></div>`).join('');
    $$('[data-rm]', el).forEach((b) => { b.onclick = () => { onRemove(+b.dataset.rm); dirty = true; drawAll(); }; });
  };

  function readAll() {
    c.months = $$('#months .cal-row').map((r) => ({ name: $('.n', r).value.trim(), days: Math.max(1, Math.round(+$('.d', r).value || 1)) }));
    c.weekdays = $('#weekdays').value.split('\n').map((s) => s.trim()).filter(Boolean);
    c.epochWeekday = $('#epoch').options.length ? +$('#epoch').value : +c.epochWeekday || 0;
    c.eras = $$('#eras .cal-row').map((r) => ({ name: $('.n', r).value.trim(), abbr: $('.a', r).value.trim(), start: $('.s', r).value === '' ? '' : Math.round(+$('.s', r).value), restart: $('.r', r).checked }));
    c.moons = $$('#moons .cal-row').map((r) => ({ name: $('.n', r).value.trim(), cycle: Math.max(1, +$('.c', r).value || 1), offset: +$('.o', r).value || 0, color: $('.col', r).value }));
    c.currentYear = $('#curYear').value === '' ? null : Math.round(+$('#curYear').value);
  }

  function drawAll() {
    rowList($('#months'), c.months, (mo, i) => `<span class="cal-idx">${i + 1}</span>
      <input class="n" value="${esc(mo.name)}" placeholder="Month name" aria-label="Month name">
      <input class="d" type="number" min="1" value="${mo.days}" aria-label="Days" title="Days">
      <span class="muted small">days</span>`, (i) => c.months.splice(i, 1));
    $('#weekdays').value = (c.weekdays || []).join('\n');
    rowList($('#eras'), c.eras, (e) => `
      <input class="n" value="${esc(e.name || '')}" placeholder="Era name" aria-label="Era name">
      <input class="a" value="${esc(e.abbr || '')}" placeholder="Abbr." aria-label="Abbreviation" style="max-width:6rem">
      <input class="s" type="number" value="${e.start ?? ''}" placeholder="Start year" aria-label="Start year" style="max-width:7.5rem">
      <label class="check"><input type="checkbox" class="r" ${e.restart ? 'checked' : ''}> Count from 1</label>`, (i) => c.eras.splice(i, 1));
    rowList($('#moons'), c.moons, (mo) => `
      <input class="n" value="${esc(mo.name || '')}" placeholder="Moon name" aria-label="Moon name">
      <input class="c" type="number" min="1" step="any" value="${mo.cycle ?? 29.5}" title="Cycle length (days)" aria-label="Cycle days" style="max-width:6rem">
      <input class="o" type="number" step="any" value="${mo.offset ?? 0}" title="Offset (days)" aria-label="Offset" style="max-width:5rem">
      <input class="col" type="color" value="${mo.color || '#c4a46a'}" aria-label="Colour">`, (i) => c.moons.splice(i, 1));
    refresh();
  }

  function refresh() {
    readAll();
    const cal = calendarOf({ calendar: c });
    const epoch = $('#epoch');
    const prev = c.epochWeekday;
    epoch.innerHTML = cal.weekdays.map((d, i) => `<option value="${i}" ${i === prev ? 'selected' : ''}>${esc(d)}</option>`).join('');
    $('#yearLen').textContent = `${cal.months.length} months · ${yearLength(cal)} days in a year.`;
    const sy = c.currentYear ?? 1000;
    $('#sample').textContent = 'e.g. ' + formatDate(cal, { y: sy, m: Math.min(2, cal.months.length - 1), d: 12 });
  }

  $('#addMonth').onclick = () => { readAll(); c.months.push({ name: '', days: 30 }); dirty = true; drawAll(); $$('#months .n').at(-1).focus(); };
  $('#addEra').onclick = () => { readAll(); c.eras.push({ name: '', abbr: '', start: '', restart: false }); dirty = true; drawAll(); $$('#eras .n').at(-1).focus(); };
  $('#addMoon').onclick = () => { readAll(); c.moons.push({ name: '', cycle: 29.5, offset: 0, color: '#c4a46a' }); dirty = true; drawAll(); $$('#moons .n').at(-1).focus(); };
  $('#applyPreset').onclick = async () => {
    if (!(await confirmDialog('Replace the months and weekdays with this preset?', 'Replace'))) return;
    readAll();
    const p = presetCalendar($('#preset').value);
    c.months = p.months; c.weekdays = p.weekdays; c.epochWeekday = 0;
    dirty = true;
    drawAll();
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    readAll();
    if (c.months.some((mo) => !mo.name)) return toast('Every month needs a name');
    if (!c.weekdays.length) return toast('Add at least one weekday');
    c.eras = c.eras.filter((er) => er.name);
    c.moons = c.moons.filter((mo) => mo.name);
    const next = { ...w, calendar: c };
    delete next.era; // superseded by calendar eras
    await store.save('worlds', next);
    dirty = false;
    state.guard = null;
    toast('Calendar saved');
    location.hash = `#/w/${wid}/calendar`;
  };

  drawAll();
}
