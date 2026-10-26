export function zipShortest(left, right) {
  return left.slice(0, right.length).map((value, index) => [value, right[index]]);
}

export function zipLongest(left, right, fill = null) {
  return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => [
    index < left.length ? left[index] : fill,
    index < right.length ? right[index] : fill,
  ]);
}
