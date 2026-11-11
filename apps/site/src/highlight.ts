const KEYWORDS = "import|from|const|let|await|new|return|interface|export|type|function|async|npx|bun";
// one pass over HTML-escaped code: comments, strings, JSX tag names, then keywords
const TOKEN = new RegExp(
  [
    String.raw`(^|\s)(\/\/[^\n]*)`,
    String.raw`(&quot;(?:(?!&quot;)[^\n])*&quot;|` + "`[^`]*`)",
    String.raw`(&lt;\/?)([A-Z][\w.]*)`,
    String.raw`\b(${KEYWORDS})\b`,
  ].join("|"),
  "gm",
);

/** Wraps the tokens of HTML-escaped code in spans. It only colours; it never changes the text. */
export function highlight(code: string): string {
  return code.replace(
    TOKEN,
    (
      all,
      lead: string | undefined,
      comment: string | undefined,
      str: string | undefined,
      open: string | undefined,
      tag: string | undefined,
      kw: string | undefined,
    ) => {
      if (comment) return `${lead ?? ""}<span class="tok-c">${comment}</span>`;
      if (str) return `<span class="tok-s">${str}</span>`;
      if (tag) return `${open}<span class="tok-t">${tag}</span>`;
      if (kw) return `<span class="tok-k">${kw}</span>`;
      return all;
    },
  );
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ESCAPES[c]!);
const UNESCAPES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"' };
export const unescapeHtml = (html: string) => html.replace(/&(amp|lt|gt|quot);/g, (e) => UNESCAPES[e]!);
