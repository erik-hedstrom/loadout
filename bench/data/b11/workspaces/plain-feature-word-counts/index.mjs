export function words(text) {
  return (text.match(/[A-Za-z]+/g) ?? []).map(word => word.toLowerCase());
}
