// Custom calendars. A world's calendar defines its months (with lengths),
// weekdays, eras and moons. Dates are { y, m, d } with m a 0-based month index;
// m and d are optional, so "the year 1042" and "Frostmoot 1042" are valid dates.

export const PRESETS = {
  standard: {
    label: 'Earth-like (12 months, 7-day week)',
    months: [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]],
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  },
  even: {
    label: 'Even (12 × 30 days, 10-day week)',
    months: [['Deepwinter', 30], ['Thawing', 30], ['Seedtime', 30], ['Greening', 30], ['Highsun', 30], ['Midsummer', 30], ['Goldfall', 30], ['Harvest', 30], ['Leaffall', 30], ['Mistmoot', 30], ['Frostmoot', 30], ['Longnight', 30]],
    weekdays: ['Firstday', 'Seconday', 'Thirdday', 'Fourthday', 'Fifthday', 'Sixthday', 'Seventhday', 'Eighthday', 'Ninthday', 'Restday'],
  },
};

export function presetCalendar(key = 'standard') {
  const p = PRESETS[key];
  return {
    months: p.months.map(([name, days]) => ({ name, days })),
    weekdays: [...p.weekdays],
    eras: [], moons: [], epochWeekday: 0, currentYear: null,
  };
}

// Normalized calendar for a world (falls back to a default; migrates the old `era` suffix).
export function calendarOf(world) {
  const c = world?.calendar || presetCalendar('standard');
  const months = (c.months || []).filter((m) => m.name && m.days > 0);
  return {
    months: months.length ? months : presetCalendar().months,
    weekdays: (c.weekdays || []).filter(Boolean).length ? c.weekdays.filter(Boolean) : ['Day'],
    eras: (c.eras?.length ? c.eras : world?.era ? [{ name: world.era, abbr: world.era, start: null }] : [])
      .map((e) => ({ ...e, start: e.start === '' || e.start == null ? -Infinity : +e.start }))
      .sort((a, b) => a.start - b.start),
    moons: (c.moons || []).filter((m) => m.name && m.cycle > 0),
    epochWeekday: +c.epochWeekday || 0,
    currentYear: c.currentYear === '' || c.currentYear == null ? null : +c.currentYear,
  };
}

export const yearLength = (cal) => cal.months.reduce((s, m) => s + +m.days, 0);

const monthOffset = (cal, m) => cal.months.slice(0, m).reduce((s, x) => s + +x.days, 0);

// Absolute day number (day 0 = first day of year 0). Missing month/day count as the first.
export function dayNumber(cal, { y, m, d }) {
  return y * yearLength(cal) + monthOffset(cal, m ?? 0) + ((d ?? 1) - 1);
}

const mod = (a, n) => ((a % n) + n) % n;
export const weekdayOf = (cal, n) => mod(n + cal.epochWeekday, cal.weekdays.length);

// 0 = new, 0.5 = full.
export const moonPhase = (moon, n) => mod(n - (+moon.offset || 0), +moon.cycle) / +moon.cycle;

export function eraFor(cal, y) {
  let found = null;
  for (const e of cal.eras) if (y >= e.start) found = e;
  return found;
}

export function formatYear(cal, y) {
  if (y == null || isNaN(y)) return '';
  const era = eraFor(cal, y);
  if (!era) return String(y);
  const shown = era.restart && isFinite(era.start) ? y - era.start + 1 : y;
  return `${shown} ${era.abbr || era.name}`;
}

export function formatDate(cal, { y, m, d }) {
  if (y == null) return '';
  const month = m != null && cal.months[m] ? cal.months[m].name : null;
  return [month && d ? d : null, month, formatYear(cal, y)].filter((x) => x != null).join(' ');
}

export const articleStart = (a) => (a.start == null ? null : { y: +a.start, m: a.startM ?? null, d: a.startD ?? null });
export const articleEnd = (a) => (a.end == null ? null : { y: +a.end, m: a.endM ?? null, d: a.endD ?? null });

export function articleDateText(cal, a) {
  if (a.dateLabel) return a.dateLabel;
  const s = articleStart(a);
  if (!s) return '';
  const e = articleEnd(a);
  const same = e && e.y === s.y && e.m === s.m && e.d === s.d;
  return formatDate(cal, s) + (e && !same ? ' – ' + formatDate(cal, e) : '');
}

export const sortKey = (cal, a) => {
  const s = articleStart(a);
  return s ? dayNumber(cal, s) : Infinity;
};

// Small SVG showing a moon phase (0..1).
export function moonGlyph(phase, color = 'currentColor', size = 14) {
  const r = 6;
  const lit = phase <= 0.5 ? phase * 2 : (1 - phase) * 2; // 0 new → 1 full → 0 new
  const waxing = phase < 0.5;
  const rx = Math.abs(1 - 2 * lit) * r;
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = lit > 0.5 ? (waxing ? 1 : 0) : (waxing ? 0 : 1);
  if (!/^#[0-9a-f]{3,8}$/i.test(color)) color = '#c4a46a';
  const path = `M7 1 A${r} ${r} 0 0 ${sweepOuter} 7 13 A${rx} ${r} 0 0 ${sweepInner} 7 1Z`;
  return `<svg class="moon" width="${size}" height="${size}" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="${r}" fill="none" stroke="${color}" stroke-width="1" opacity=".55"/>${lit > 0.02 ? `<path d="${path}" fill="${color}"/>` : ''}</svg>`;
}
