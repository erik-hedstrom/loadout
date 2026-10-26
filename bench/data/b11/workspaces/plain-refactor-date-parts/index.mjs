export function formatDay(isoDay) {
  const date = new Date(isoDay + 'T00:00:00Z');
  return String(date.getUTCDate()).padStart(2, '0') + '/' + String(date.getUTCMonth() + 1).padStart(2, '0') + '/' + date.getUTCFullYear();
}
