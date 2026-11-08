import assert from 'node:assert/strict';
import test from 'node:test';
import { createConfig } from '../../src/config/index.js';
import {
  createTimeService,
  parseOffsetDateTime,
  validateTimeZone,
} from '../../src/shared/time.js';

test('requires a valid configured IANA timezone', () => {
  assert.throws(() => createConfig(), /HOSPITAL_TIME_ZONE must be configured/);
  assert.throws(() => validateTimeZone('Not/A_Zone'), /valid IANA hospital timezone/);
  assert.equal(createConfig({ hospitalTimeZone: 'Asia/Kolkata' }).hospitalTimeZone, 'Asia/Kolkata');
});

test('converts an offset date-time only when its offset agrees with hospital timezone', () => {
  assert.equal(
    parseOffsetDateTime('2026-11-08T10:00:00-05:00', 'America/New_York'),
    '2026-11-08T15:00:00.000Z',
  );
  assert.throws(
    () => parseOffsetDateTime('2026-11-08T10:00:00-04:00', 'America/New_York'),
    /offset does not match/,
  );
  assert.throws(
    () => parseOffsetDateTime('2026-11-08T10:00:00', 'America/New_York'),
    /explicit UTC offset/,
  );
});

test('rejects daylight-saving gaps and accepts repeated local times with explicit offsets', () => {
  assert.throws(
    () => parseOffsetDateTime('2026-03-08T02:30:00-05:00', 'America/New_York'),
    /offset does not match/,
  );
  assert.equal(
    parseOffsetDateTime('2026-11-01T01:30:00-04:00', 'America/New_York'),
    '2026-11-01T05:30:00.000Z',
  );
  assert.equal(
    parseOffsetDateTime('2026-11-01T01:30:00-05:00', 'America/New_York'),
    '2026-11-01T06:30:00.000Z',
  );
});

test('uses the injected clock and hospital-local date for calendar calculations', () => {
  let instant = new Date('2026-11-08T04:30:00.000Z');
  const time = createTimeService({
    timeZone: 'America/New_York',
    now: () => instant,
  });
  assert.equal(time.hospitalLocalDate(), '2026-11-07');
  assert.equal(time.ageOnDate('2008-11-07'), 18);

  instant = new Date('2026-11-08T04:59:59.000Z');
  assert.equal(time.hospitalLocalDate(), '2026-11-07');
  instant = new Date('2026-11-08T05:00:00.000Z');
  assert.equal(time.hospitalLocalDate(), '2026-11-08');
  assert.equal(time.ageOnDate('2008-11-08'), 18);
});
