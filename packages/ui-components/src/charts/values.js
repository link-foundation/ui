/**
 * Plain value helpers shared by the chart model, the scales and the
 * renderers: numbers, dates and their text. Pure and deterministic: dates
 * are read and written in UTC, never in the local time zone.
 */

/** Whether `text` is a number written the way `String(number)` writes it. */
export function isCanonicalNumber(text) {
  if (typeof text !== 'string' || text.trim() !== text || text === '') {
    return false;
  }
  const number = Number(text);
  return Number.isFinite(number) && String(number) === text;
}

/** A finite number of a LiNo atom (`12`, `-3.5`, `1e3`), or `null`. */
export function toNumber(text) {
  if (typeof text === 'number') {
    return Number.isFinite(text) ? text : null;
  }
  if (typeof text !== 'string' || text.trim() === '') {
    return null;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

const DIGITS = new Set('0123456789');
const isDigits = (text, length) =>
  text.length === length && [...text].every((c) => DIGITS.has(c));

/**
 * The UTC time of a plain date: a year (`YYYY`), a month (`YYYY-MM`) or a
 * day (`YYYY-MM-DD`); `null` for anything else, an impossible day included.
 */
function parseDate(value) {
  const [year, month = '01', day = '01', ...extra] = value.split('-');
  if (
    extra.length > 0 ||
    !isDigits(year, 4) ||
    !isDigits(month, 2) ||
    !isDigits(day, 2)
  ) {
    return null;
  }
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const date = new Date(time);
  const exact =
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);
  return exact ? time : null;
}

/**
 * The UTC time of a temporal value: a plain date (`YYYY`, `YYYY-MM`,
 * `YYYY-MM-DD`) or an ISO 8601 date-time with a zone (`...T12:00Z`). A
 * number is a time in milliseconds. Returns `null` when it is not a date.
 * @param {string|number} value
 * @returns {number|null}
 */
export function parseTemporal(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const date = parseDate(value);
  if (date !== null) {
    return date;
  }
  // A date-time needs an explicit zone, so the result never depends on the
  // time zone of the machine.
  const zoned =
    value.includes('T') && (value.endsWith('Z') || hasOffset(value));
  const time = zoned ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : null;
}

/** Whether an ISO date-time ends with `+hh:mm` or `-hh:mm`. */
function hasOffset(value) {
  const tail = value.slice(-6);
  return (
    (tail[0] === '+' || tail[0] === '-') &&
    isDigits(tail.slice(1, 3), 2) &&
    tail[3] === ':' &&
    isDigits(tail.slice(4), 2)
  );
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * A short English label of a UTC time, as precise as the value needs:
 * `Jan 2026` (the first of a month), `Jan 31, 2026` or `Jan 31, 2026 12:30`.
 * @param {number} time
 */
export function formatTime(time) {
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = MONTHS[date.getUTCMonth()];
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  if (hours !== 0 || minutes !== 0) {
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${month} ${day}, ${year} ${hh}:${mm}`;
  }
  return day === 1 ? `${month} ${year}` : `${month} ${day}, ${year}`;
}

/**
 * A number for people: at most `digits` fraction digits, no trailing
 * zeros, a minus sign for negatives, a thin grouping of thousands.
 * Deterministic (no `Intl`, whose output depends on the runtime's data).
 * @param {number} value
 * @param {number} [digits]
 */
export function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  const fixed = Math.abs(value).toFixed(digits);
  const [whole, fraction = ''] = fixed.split('.');
  const trimmed = fraction.replace(/0+$/u, '');
  const groups = [];
  for (let end = whole.length; end > 0; end -= 3) {
    groups.unshift(whole.slice(Math.max(0, end - 3), end));
  }
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return `${sign}${groups.join(',')}${trimmed === '' ? '' : `.${trimmed}`}`;
}
