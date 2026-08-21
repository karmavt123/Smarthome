function serialize(value) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serialize);

  if (value && typeof value === 'object') {
    if (typeof value.toNumber === 'function') return value.toNumber();

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serialize(nestedValue)])
    );
  }

  return value;
}

module.exports = serialize;
