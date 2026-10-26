export function zipShortest(left, right) {
  return left.slice(0, right.length).map((value, index) => [value, right[index]]);
}
