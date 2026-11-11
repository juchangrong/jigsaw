import { StrictMode, useEffect } from "react";
import { Footer, Header, ROOT, mount } from "./chrome";
import { docHtml } from "./markdown" with { type: "macro" };
import "./site.css";

const DOCS = {
  usage: { title: "Use jigsaw icons", path: "docs/", html: docHtml("usage") },
  api: { title: "API reference", path: "docs/api/", html: docHtml("api") },
  registry: { title: "PuzzleMosaic registry", path: "docs/registry/", html: docHtml("registry") },
} as const;
type DocId = keyof typeof DOCS;

const id = (document.documentElement.dataset.doc ?? "usage") as DocId;
const doc = DOCS[id];
const sections = [...doc.html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map((m) => ({ id: m[1]!, text: m[2]!.replace(/<[^>]+>/g, "") }));

/** Points links between the Markdown files at their pages here; a link to any other repository file becomes plain text. */
function relink(html: string): string {
  return html.replace(/<a href="([^"#:]+)(#[^"]*)?">(.*?)<\/a>/g, (_, file: string, hash = "", text: string) => {
    const target = (Object.keys(DOCS) as DocId[]).find((d) => `${d}.md` === file);
    return target ? `<a href="${ROOT}${DOCS[target].path}${hash}">${text}</a>` : text;
  });
}
const html = relink(doc.html);

function DocsPage() {
  useEffect(() => {
    // the text arrives after the browser looked for the anchor
    if (window.location.hash) document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
  }, []);
  return (
    <div className="site">
      <Header current="docs" />
      <div className="docs">
        <nav className="docs-nav" aria-label="Documentation">
          <ul>
            {(Object.keys(DOCS) as DocId[]).map((d) => (
              <li key={d}>
                <a href={`${ROOT}${DOCS[d].path}`} aria-current={d === id ? "page" : undefined}>
                  {DOCS[d].title}
                </a>
                {d === id && (
                  <ul>
                    {sections.map((s) => (
                      <li key={s.id}>
                        <a href={`#${s.id}`}>{s.text}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <main className="prose" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <Footer />
    </div>
  );
}

mount(
  <StrictMode>
    <DocsPage />
  </StrictMode>,
);
