export function flatten(values) {
  const result = [];
  const stack = [...values].reverse();
  while (stack.length) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index--) stack.push(value[index]);
    } else result.push(value);
  }
  return result;
}
