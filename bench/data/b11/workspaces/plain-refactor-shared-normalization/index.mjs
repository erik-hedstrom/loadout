export function tagsEqual(left, right) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function includesTag(tags, wanted) {
  return tags.some(tag => tag.trim().toLowerCase() === wanted.trim().toLowerCase());
}
