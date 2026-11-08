const configuredTimeZone = import.meta.env.VITE_HOSPITAL_TIME_ZONE;
const fallbackTimeZone = 'UTC';
let hospitalTimeZone = configuredTimeZone || fallbackTimeZone;
let timeZoneConfigured = false;

if (configuredTimeZone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: hospitalTimeZone });
    timeZoneConfigured = true;
  } catch {
    hospitalTimeZone = fallbackTimeZone;
  }
}

export const isHospitalTimeZoneConfigured = timeZoneConfigured;
export const HOSPITAL_TIME_ZONE = hospitalTimeZone;

export function formatHospitalTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'Time unavailable';
  }
  return new Intl.DateTimeFormat(undefined, {
    timeZone: HOSPITAL_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}
