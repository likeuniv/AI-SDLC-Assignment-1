export function createFixedClock(anchor) {
  const instant = new Date(anchor);
  if (!Number.isFinite(instant.getTime())) {
    throw new TypeError('A valid benchmark clock anchor is required.');
  }
  const fixedTime = instant.getTime();
  return () => new Date(fixedTime);
}

export function formatHospitalOffsetDateTime(value, timeZone) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) {
    throw new TypeError('A valid instant is required.');
  }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant).map(({ type, value: part }) => [type, part]));
  const localUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMinutes = Math.round((localUtc - instant.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}
