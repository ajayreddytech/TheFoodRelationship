const MINOR_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "per", "the", "to", "vs", "with"]);

/**
 * Title Case for UI labels: capitalises the first letter of each significant word.
 * Minor words stay lowercase mid-title, and leading punctuation such as "(" is skipped.
 * Use it for display labels only; never for stored data such as meal bucket keys.
 */
export function toTitleCase(s: string): string {
  return s
    .split(" ")
    .map((w, i) => {
      if (!w) return w;
      if (i > 0 && MINOR_WORDS.has(w.toLowerCase())) return w.toLowerCase();
      return w.replace(/^([^\p{L}]*)(\p{L})/u, (_, lead: string, c: string) => lead + c.toUpperCase());
    })
    .join(" ");
}
