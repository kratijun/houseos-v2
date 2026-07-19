import test from 'node:test';
import assert from 'node:assert/strict';
import { buildICalendar, parseICalendar } from './ical.js';

test('importiert ganztägige, wiederkehrende und gefaltete iCal-Termine', () => {
  const source = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:ferien-2026@example.test',
    'DTSTART;VALUE=DATE:20260720',
    'DTEND;VALUE=DATE:20260723',
    'SUMMARY:Familienurlaub',
    'DESCRIPTION:Erste Zeile\\nEine lange Beschrei',
    ' bung',
    'LOCATION:Wien\\, Österreich',
    'RRULE:FREQ=YEARLY',
    'ATTENDEE;CN="Oliver Kratochwill":mailto:oliver@example.test',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const [event] = parseICalendar(source, { sourceName: 'Familie.ics' });
  assert.equal(event.title, 'Familienurlaub');
  assert.equal(event.startDate, '2026-07-20');
  assert.equal(event.endDate, '2026-07-22');
  assert.equal(event.allDay, true);
  assert.equal(event.description, 'Erste Zeile\nEine lange Beschreibung');
  assert.equal(event.location, 'Wien, Österreich');
  assert.equal(event.recurrence, 'yearly');
  assert.equal(event.reminderMinutes, 1440);
  assert.deepEqual(event.participants, ['Oliver Kratochwill']);
  assert.equal(event.icalUid, 'ferien-2026@example.test');
  assert.equal(event.icalSource, 'Familie.ics');
});

test('exportiert einen kompatiblen Kalender und lässt sich wieder einlesen', () => {
  const sourceEvents = [{
    id: 42,
    title: 'Geburtstag, Familie & Freunde',
    description: 'Kuchen mitbringen; bitte pünktlich.\nGeschenk nicht vergessen.',
    startDate: '2026-08-02',
    startTime: '',
    endDate: '2026-08-02',
    endTime: '',
    allDay: true,
    location: 'Zu Hause',
    participants: ['Oliver', 'Mia'],
    color: '#af52de',
    recurrence: 'yearly',
    reminderMinutes: 10080,
  }, {
    id: 43,
    title: 'Zahnarzt',
    description: '',
    startDate: '2026-08-03',
    startTime: '09:30',
    endDate: '2026-08-03',
    endTime: '10:15',
    allDay: false,
    location: 'Praxis',
    participants: ['Mia'],
    color: '#0a84ff',
    recurrence: 'none',
    reminderMinutes: 30,
  }];

  const calendar = buildICalendar(sourceEvents);
  assert.match(calendar, /UID:houseos-42@houseos\.local/);
  assert.match(calendar, /DTEND;VALUE=DATE:20260803/);
  assert.ok(calendar.split('\r\n').every(line => Buffer.byteLength(line) <= 75));

  const [event, timedEvent] = parseICalendar(calendar, { sourceName: 'HouseOS' });
  assert.equal(event.title, sourceEvents[0].title);
  assert.equal(event.description, sourceEvents[0].description);
  assert.equal(event.endDate, '2026-08-02');
  assert.equal(event.recurrence, 'yearly');
  assert.equal(event.reminderMinutes, 10080);
  assert.deepEqual(event.participants, ['Oliver', 'Mia']);
  assert.equal(timedEvent.title, 'Zahnarzt');
  assert.equal(timedEvent.startDate, '2026-08-03');
  assert.equal(timedEvent.startTime, '09:30');
  assert.equal(timedEvent.endTime, '10:15');
  assert.equal(timedEvent.reminderMinutes, 30);
});

test('weist Dateien ohne lesbare Kalendertermine zurück', () => {
  assert.throws(() => parseICalendar('BEGIN:VCALENDAR\r\nEND:VCALENDAR'), /keine lesbaren Termine/);
  assert.throws(() => parseICalendar('kein Kalender'), /kein gültiger iCal-Kalender/);
});
