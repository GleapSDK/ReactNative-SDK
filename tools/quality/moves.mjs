// What a change took out of its files. Code found here again is moved, not new: a split without behaviour change
// must not be punished for code that only changed its address.
export const normalizeItem = (text) =>
  text
    .replace(/^export\s+(default\s+)?/, '')
    .replace(/^(public|private|protected)\s+/, '')
    .replace(/^(static\s+)?(async\s+)?/, '')
    .replace(/\s+/g, ' ')
    .trim();

const add = (counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1);

const take = (counts, key) => {
  const left = counts.get(key) ?? 0;
  if (left <= 0) return false;
  counts.set(key, left - 1);
  return true;
};

const countsWithout = ({ items, removed }) => {
  const kept = new Map();
  for (const item of removed) add(kept, normalizeItem(item));
  const gone = new Map();
  for (const item of items) if (!take(kept, normalizeItem(item))) add(gone, normalizeItem(item));
  return gone;
};

const mergeInto = (target, counts) => {
  for (const [key, count] of counts) target.set(key, (target.get(key) ?? 0) + count);
};

const keepLarger = (map, { key, fact }) => {
  const current = map.get(key);
  if (!current || current.lines < fact.lines) map.set(key, fact);
};

export const buildMovePool = (analyzed) => {
  const counters = new Map();
  const lines = new Map();
  const byName = new Map();
  const byHash = new Map();
  for (const { beforeFacts, afterFacts } of analyzed) {
    if (!beforeFacts) continue;
    for (const [rule, items] of Object.entries(beforeFacts.counters)) {
      const texts = items.map(({ text }) => text);
      const stays = (afterFacts?.counters[rule] ?? []).map(({ text }) => text);
      if (!counters.has(rule)) counters.set(rule, new Map());
      mergeInto(counters.get(rule), countsWithout({ items: texts, removed: stays }));
    }
    mergeInto(lines, countsWithout({ items: beforeFacts.codeLineTexts, removed: afterFacts?.codeLineTexts ?? [] }));
    for (const fact of beforeFacts.functions.values()) {
      if (afterFacts?.functions.has(fact.key)) continue;
      keepLarger(byName, { key: fact.baseName, fact });
      keepLarger(byHash, { key: fact.bodyHash, fact });
    }
  }
  const removedLines = new Set(lines.keys());
  return {
    takeCounter: ({ rule, text }) => take(counters.get(rule) ?? new Map(), normalizeItem(text)),
    hasLine: (text) => removedLines.has(normalizeItem(text)),
    takeLines: (texts) => texts.filter((text) => take(lines, normalizeItem(text))).length,
    findFunction: (fact) => byHash.get(fact.bodyHash) ?? byName.get(fact.baseName) ?? null,
  };
};
