function normalizeTag(tag) {
  return tag.trim().toLowerCase();
}

export function tagsEqual(left, right) {
  return normalizeTag(left) === normalizeTag(right);
}

export function includesTag(tags, wanted) {
  const normalized = normalizeTag(wanted);
  return tags.some(tag => normalizeTag(tag) === normalized);
}
