import { createHash } from 'node:crypto';

const DATE_VALUE = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME_VALUE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/;
const RECURRENCES = new Set(['daily', 'weekly', 'monthly', 'yearly']);

const dateValue = (year, month, day) => `${year}-${month}-${day}`;
const timeValue = (hour, minute) => `${hour}:${minute}`;
const localParts = date => ({
  date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
});
const shiftDate = (value, days) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const decodeText = value => String(value || '').replace(/\\([nN,;\\])/g, (_match, escaped) => escaped.toLowerCase() === 'n' ? '\n' : escaped);
const encodeText = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

const splitHeader = value => {
  const parts = []; let current = ''; let quoted = false;
  for (const character of value) {
    if (character === '"') quoted = !quoted;
    if (character === ';' && !quoted) { parts.push(current); current = ''; }
    else current += character;
  }
  parts.push(current);
  return parts;
};

const parseContentLine = line => {
  const separator = line.indexOf(':');
  if (separator < 1) return null;
  const [namePart, ...parameterParts] = splitHeader(line.slice(0, separator));
  const params = {};
  for (const parameter of parameterParts) {
    const equals = parameter.indexOf('=');
    if (equals < 1) continue;
    const name = parameter.slice(0, equals).toUpperCase();
    let value = parameter.slice(equals + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\(["\\])/g, '$1');
    params[name] = value;
  }
  return { name: namePart.toUpperCase(), params, value: line.slice(separator + 1) };
};

const unfoldLines = source => {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n'); const unfolded = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1);
    else unfolded.push(line);
  }
  return unfolded;
};

const zonedWallClock = (parts, timeZone) => {
  try {
    const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    let instant = target;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const displayed = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
      const displayedUtc = Date.UTC(displayed.year, displayed.month - 1, displayed.day, displayed.hour, displayed.minute, displayed.second);
      instant -= displayedUtc - target;
    }
    return new Date(instant);
  } catch { return null; }
};

const parseDateProperty = property => {
  if (!property) return null;
  const raw = property.value.trim();
  const dateMatch = raw.match(DATE_VALUE);
  if (property.params.VALUE?.toUpperCase() === 'DATE' || dateMatch) {
    if (!dateMatch) return null;
    return { allDay: true, date: dateValue(dateMatch[1], dateMatch[2], dateMatch[3]), time: '' };
  }
  const match = raw.match(DATE_TIME_VALUE);
  if (!match) return null;
  const values = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] || 0) };
  if (match[7]) return { allDay: false, ...localParts(new Date(Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second))) };
  if (property.params.TZID) {
    const zoned = zonedWallClock(values, property.params.TZID);
    if (zoned) return { allDay: false, ...localParts(zoned) };
  }
  return { allDay: false, date: dateValue(match[1], match[2], match[3]), time: timeValue(match[4], match[5]) };
};

const reminderMinutes = value => {
  const match = String(value || '').trim().match(/^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return 0;
  return Number(match[1] || 0) * 10080 + Number(match[2] || 0) * 1440 + Number(match[3] || 0) * 60 + Number(match[4] || 0) + Math.ceil(Number(match[5] || 0) / 60);
};

const parseEvent = (lines, sourceName) => {
  const properties = lines.map(parseContentLine).filter(Boolean);
  const all = name => properties.filter(property => property.name === name);
  const first = name => all(name)[0];
  const start = parseDateProperty(first('DTSTART'));
  const rawEnd = parseDateProperty(first('DTEND'));
  const title = decodeText(first('SUMMARY')?.value).trim();
  if (!start || !title) return null;
  const end = rawEnd || start;
  const allDay = start.allDay;
  const endDate = allDay && rawEnd ? shiftDate(end.date, -1) : end.date;
  const rule = String(first('RRULE')?.value || '').match(/(?:^|;)FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(?:;|$)/i)?.[1]?.toLowerCase() || 'none';
  const attendeeNames = all('ATTENDEE').map(property => decodeText(property.params.CN || '')).filter(Boolean);
  const color = first('COLOR')?.value || first('X-APPLE-CALENDAR-COLOR')?.value || first('X-HOUSEOS-COLOR')?.value || '#0a84ff';
  const seed = `${title}\n${start.date}\n${start.time}\n${decodeText(first('LOCATION')?.value)}`;
  const uid = String(first('UID')?.value || `generated-${createHash('sha256').update(seed).digest('hex').slice(0, 24)}@houseos-import`).trim().slice(0, 255);
  return {
    title,
    description: decodeText(first('DESCRIPTION')?.value),
    startDate: start.date,
    startTime: allDay ? '' : start.time,
    endDate: endDate < start.date ? start.date : endDate,
    endTime: allDay ? '' : end.time,
    allDay,
    location: decodeText(first('LOCATION')?.value),
    participants: [...new Set(attendeeNames)],
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#0a84ff',
    recurrence: RECURRENCES.has(rule) ? rule : 'none',
    reminderMinutes: reminderMinutes(first('TRIGGER')?.value),
    icalUid: uid,
    icalSource: String(sourceName || 'iCal-Import').trim().slice(0, 120),
    cancelled: String(first('STATUS')?.value || '').toUpperCase() === 'CANCELLED',
  };
};

export function parseICalendar(source, { sourceName = 'iCal-Import', maxEvents = 2000 } = {}) {
  const lines = unfoldLines(source);
  if (!lines.some(line => line.trim().toUpperCase() === 'BEGIN:VCALENDAR')) throw new Error('Die Datei ist kein gültiger iCal-Kalender.');
  const events = []; let current = null;
  for (const line of lines) {
    const marker = line.trim().toUpperCase();
    if (marker === 'BEGIN:VEVENT') { current = []; continue; }
    if (marker === 'END:VEVENT' && current) {
      const event = parseEvent(current, sourceName);
      if (event) events.push(event);
      current = null;
      if (events.length > maxEvents) throw new Error(`Die iCal-Datei enthält mehr als ${maxEvents} Termine.`);
      continue;
    }
    if (current) current.push(line);
  }
  if (!events.length) throw new Error('Die iCal-Datei enthält keine lesbaren Termine.');
  return events;
}

const compactDate = value => String(value || '').replaceAll('-', '');
const utcDateTime = (dateValueInput, timeValueInput) => {
  const time = /^\d{2}:\d{2}$/.test(String(timeValueInput || '')) ? timeValueInput : '00:00';
  const date = new Date(`${dateValueInput}T${time}:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
};
const alarmDuration = minutes => {
  if (minutes % 10080 === 0) return `-P${minutes / 10080}W`;
  if (minutes % 1440 === 0) return `-P${minutes / 1440}D`;
  if (minutes % 60 === 0) return `-PT${minutes / 60}H`;
  return `-PT${minutes}M`;
};
const quoteParameter = value => `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const foldLine = line => {
  const folded = []; let current = ''; let bytes = 0;
  for (const character of line) {
    const characterBytes = Buffer.byteLength(character);
    if (current && bytes + characterBytes > 75) { folded.push(current); current = ` ${character}`; bytes = 1 + characterBytes; }
    else { current += character; bytes += characterBytes; }
  }
  folded.push(current);
  return folded.join('\r\n');
};

export function buildICalendar(events, { calendarName = 'HouseOS Familienkalender' } = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HouseOS//Familienkalender//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${encodeText(calendarName)}`,
  ];
  for (const event of events) {
    if (!event?.title || !event?.startDate) continue;
    const uid = String(event.icalUid || `houseos-${event.id}@houseos.local`).replace(/[\r\n]/g, '');
    lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`);
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(event.startDate)}`);
      lines.push(`DTEND;VALUE=DATE:${compactDate(shiftDate(event.endDate || event.startDate, 1))}`);
    } else {
      lines.push(`DTSTART:${utcDateTime(event.startDate, event.startTime)}`);
      lines.push(`DTEND:${utcDateTime(event.endDate || event.startDate, event.endTime || event.startTime)}`);
    }
    lines.push(`SUMMARY:${encodeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${encodeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${encodeText(event.location)}`);
    if (/^#[0-9a-f]{6}$/i.test(String(event.color || ''))) lines.push(`COLOR:${event.color}`, `X-HOUSEOS-COLOR:${event.color}`);
    for (const participant of Array.isArray(event.participants) ? event.participants : []) lines.push(`ATTENDEE;CN=${quoteParameter(participant)}:urn:houseos:member:${encodeURIComponent(participant)}`);
    if (RECURRENCES.has(event.recurrence)) lines.push(`RRULE:FREQ=${event.recurrence.toUpperCase()}`);
    const reminder = Math.max(0, Number(event.reminderMinutes) || 0);
    if (reminder) lines.push('BEGIN:VALARM', `TRIGGER:${alarmDuration(reminder)}`, 'ACTION:DISPLAY', `DESCRIPTION:${encodeText(event.title)}`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
