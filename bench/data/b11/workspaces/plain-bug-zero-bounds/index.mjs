export function clamp(value, min, max) {
  return Math.min(max || Infinity, Math.max(min || -Infinity, value));
}
