const DATE_TYPES = new Set(['year', 'month', 'day']);

export function getDateFieldOrder(locale) {
  const parts = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(2000, 0, 1));
  return parts.filter((part) => DATE_TYPES.has(part.type)).map((part) => part.type);
}

const TIME_RE = /(\d{1,2}):(\d{2})(?:\s?([AaPp][Mm]))?/;
const DATE_NUMS_RE = /(\d{1,4})\D+(\d{1,4})\D+(\d{1,4})/;

export function parseWhatsAppTimestamp(raw, fieldOrder) {
  const commaIndex = raw.indexOf(',');
  if (commaIndex === -1) return null;

  const timeMatch = TIME_RE.exec(raw.slice(0, commaIndex));
  const dateMatch = DATE_NUMS_RE.exec(raw.slice(commaIndex + 1));
  if (!timeMatch || !dateMatch) return null;

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const meridiem = timeMatch[3] ? timeMatch[3].toUpperCase() : null;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (meridiem === 'PM' && hours !== 12) hours += 12;

  const values = {
    [fieldOrder[0]]: Number(dateMatch[1]),
    [fieldOrder[1]]: Number(dateMatch[2]),
    [fieldOrder[2]]: Number(dateMatch[3]),
  };
  if (!values.year || !values.month || !values.day) return null;
  const year = values.year < 100 ? 2000 + values.year : values.year;

  return new Date(year, values.month - 1, values.day, hours, minutes);
}

export function isWithinRange(date, fromDate, toDate) {
  if (!date) return true;
  if (fromDate && date > fromDate) return false;
  if (toDate && date < toDate) return false;
  return true;
}
