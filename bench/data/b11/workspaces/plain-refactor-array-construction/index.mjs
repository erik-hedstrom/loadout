export function sequence(start, count, step = 1) {
  const result = [];
  for (let index = 0; index < count; index++) result.push(start + index * step);
  return result;
}
