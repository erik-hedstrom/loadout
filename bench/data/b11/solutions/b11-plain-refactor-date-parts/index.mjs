export function formatDay(isoDay) {
  const [year, month, day] = isoDay.split('-');
  return day + '/' + month + '/' + year;
}
