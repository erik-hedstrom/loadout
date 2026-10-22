export function sequence(start, count, step = 1) {
  return Array.from({ length: count }, (_, index) => start + index * step);
}
