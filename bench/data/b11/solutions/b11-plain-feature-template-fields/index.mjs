export function hasField(fields, name) {
  return Object.hasOwn(fields, name);
}

export function fillTemplate(template, fields) {
  return template.replace(/{([A-Za-z_][A-Za-z0-9_]*)}/g, (token, name) =>
    hasField(fields, name) ? String(fields[name]) : token);
}
