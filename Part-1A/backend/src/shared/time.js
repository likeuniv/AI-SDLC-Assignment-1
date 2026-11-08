const OFFSET_DATE_TIME = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?<fraction>\.\d{1,9})?(?<offset>Z|[+-]\d{2}:\d{2})$/;

export function validateTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
  } catch (error) {
    throw new TypeError('A valid IANA hospital timezone is required.', { cause: error });
  }
  return timeZone;
}

function getLocalParts(instant, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    millisecond: instant.getUTCMilliseconds(),
  };
}

function offsetMinutes(offset) {
  if (offset === 'Z') {
    return 0;
  }
  const sign = offset[0] === '+' ? 1 : -1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4, 6));
  if (hours > 23 || minutes > 59) {
    return Number.NaN;
  }
  return sign * (hours * 60 + minutes);
}

function wallTimeMatches(parts, expected) {
  return ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond']
    .every((key) => parts[key] === expected[key]);
}

export function parseOffsetDateTime(value, timeZone) {
  validateTimeZone(timeZone);
  const match = typeof value === 'string' ? OFFSET_DATE_TIME.exec(value) : null;
  if (!match) {
    throw new TypeError('Date-time must be ISO 8601 and include an explicit UTC offset.');
  }

  const fields = match.groups;
  const expected = {
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    second: Number(fields.second),
    millisecond: Number((fields.fraction ?? '.0').slice(1).padEnd(3, '0').slice(0, 3)),
  };
  const calendarCheck = new Date(Date.UTC(expected.year, expected.month - 1, expected.day));
  if (
    calendarCheck.getUTCFullYear() !== expected.year
    || calendarCheck.getUTCMonth() + 1 !== expected.month
    || calendarCheck.getUTCDate() !== expected.day
    || expected.hour > 23
    || expected.minute > 59
    || expected.second > 59
  ) {
    throw new TypeError('Date-time contains an invalid calendar date or clock time.');
  }

  const timestamp = Date.parse(value);
  const suppliedOffset = offsetMinutes(fields.offset);
  if (!Number.isFinite(timestamp) || !Number.isFinite(suppliedOffset)) {
    throw new TypeError('Date-time contains an invalid UTC offset.');
  }

  const instant = new Date(timestamp);
  const local = getLocalParts(instant, timeZone);
  if (!wallTimeMatches(local, expected)) {
    throw new TypeError('Date-time offset does not match the configured hospital timezone.');
  }

  const zoneOffset = (
    Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, local.millisecond)
    - timestamp
  ) / 60000;
  if (zoneOffset !== suppliedOffset) {
    throw new TypeError('Date-time offset does not match the configured hospital timezone.');
  }

  return instant.toISOString();
}

export function createTimeService({ timeZone, now = () => new Date() }) {
  validateTimeZone(timeZone);
  return Object.freeze({
    now() {
      const current = new Date(now());
      if (Number.isNaN(current.getTime())) {
        throw new TypeError('The configured clock returned an invalid instant.');
      }
      return current;
    },
    toUtc(value) {
      return parseOffsetDateTime(value, timeZone);
    },
    hospitalLocalDate(instant = now()) {
      const current = new Date(instant);
      if (Number.isNaN(current.getTime())) {
        throw new TypeError('A valid instant is required.');
      }
      const { year, month, day } = getLocalParts(current, timeZone);
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    },
    ageOnDate(dateOfBirth, localDate = this.hospitalLocalDate()) {
      const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
      const today = new Date(`${localDate}T00:00:00.000Z`);
      if (
        Number.isNaN(birth.getTime())
        || Number.isNaN(today.getTime())
        || birth.toISOString().slice(0, 10) !== dateOfBirth
      ) {
        throw new TypeError('Valid calendar dates are required.');
      }
      let age = today.getUTCFullYear() - birth.getUTCFullYear();
      if (
        today.getUTCMonth() < birth.getUTCMonth()
        || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())
      ) {
        age -= 1;
      }
      return age;
    },
  });
}
