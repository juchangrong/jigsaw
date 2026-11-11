import { StrictMode, useEffect, type ReactNode } from "react";
import { CodeBlock, Example, Footer, Header, ROOT, mount } from "./chrome";
import { EXAMPLES } from "./examples";
import { docHtml } from "./markdown" with { type: "macro" };
import "./site.css";

const DOCS = {
  usage: { title: "Use jigsaw icons", path: "docs/", html: docHtml("usage") },
  registry: { title: "Install PuzzleMosaic", path: "docs/registry/", html: docHtml("registry") },
  api: { title: "API reference", path: "docs/api/", html: docHtml("api") },
} as const;
type DocId = keyof typeof DOCS;

const NAV: { group: string; items: { label: string; href: string; doc?: DocId }[] }[] = [
  {
    group: "Getting started",
    items: [
      { label: DOCS.usage.title, href: DOCS.usage.path, doc: "usage" },
      { label: DOCS.registry.title, href: DOCS.registry.path, doc: "registry" },
    ],
  },
  {
    group: "Reference",
    items: [
      { label: DOCS.api.title, href: DOCS.api.path, doc: "api" },
      { label: "PuzzleMosaic", href: "docs/api/#puzzlemosaic" },
      { label: "PuzzlePetals", href: "docs/api/#puzzlepetals" },
      { label: "SVG functions", href: "docs/api/#svg-functions" },
      { label: "Colour sets", href: "docs/api/#colour-sets" },
    ],
  },
  {
    group: "Tools",
    items: [
      { label: "Playground", href: "playground/" },
      { label: "Card list demo", href: "playground/cards/" },
    ],
  },
];

const id = (document.documentElement.dataset.doc ?? "usage") as DocId;
const doc = DOCS[id];

/** Points links between the Markdown files at their pages here; a link to any other repository file becomes plain text. */
function relink(html: string): string {
  return html.replace(/<a href="([^"#:]+)(#[^"]*)?">(.*?)<\/a>/g, (_, file: string, hash = "", text: string) => {
    const target = (Object.keys(DOCS) as DocId[]).find((d) => `${d}.md` === file);
    return target ? `<a href="${ROOT}${DOCS[target].path}${hash}">${text}</a>` : text;
  });
}

// the page header shows the title and the opening paragraph, so they leave the body
const head = /^\s*<h1[^>]*>(.*?)<\/h1>\s*<p>(.*?)<\/p>/s.exec(doc.html);
// a wrapper scrolls a wide table sideways, so the table keeps its column layout
const body = relink(head ? doc.html.slice(head[0].length) : doc.html)
  .replaceAll("<table>", '<div class="table"><table>')
  .replaceAll("</table>", "</table></div>");
const lede = head ? relink(`<p>${head[2]}</p>`) : "";
const sections = [...body.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map((m) => ({ id: m[1]!, text: m[2]!.replace(/<[^>]+>/g, "") }));

/** The body as React nodes: prose stays HTML, each code block becomes a `CodeBlock`, and a marked one gets its live example. */
function parts(html: string): ReactNode[] {
  const out: ReactNode[] = [];
  const block = /(?:<!-- preview: ([\w-]+) -->\s*)?<pre><code(?: class="language-\w+")?>([\s\S]*?)<\/code><\/pre>/g;
  let at = 0;
  for (const m of html.matchAll(block)) {
    if (m.index > at) out.push(<div key={at} dangerouslySetInnerHTML={{ __html: html.slice(at, m.index) }} />);
    const code = <CodeBlock html={m[2]} />;
    const preview = m[1] ? EXAMPLES[m[1]] : undefined;
    out.push(preview ? <Example key={`c${m.index}`} preview={preview} code={code} /> : <div key={`c${m.index}`}>{code}</div>);
    at = m.index + m[0].length;
  }
  if (at < html.length) out.push(<div key={at} dangerouslySetInnerHTML={{ __html: html.slice(at) }} />);
  return out;
}
const content = parts(body);

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
          {NAV.map((g) => (
            <section key={g.group}>
              <h2>{g.group}</h2>
              <ul>
                {g.items.map((item) => (
                  <li key={item.href}>
                    <a href={`${ROOT}${item.href}`} aria-current={item.doc === id ? "page" : undefined}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <main className="doc">
          <header className="doc-head">
            <p className="crumbs">
              <a href={`${ROOT}docs/`}>Docs</a>
              <span aria-hidden="true">/</span>
              {doc.title}
            </p>
            <div>
              <h1>{head ? head[1] : doc.title}</h1>
              <div className="doc-lede" dangerouslySetInnerHTML={{ __html: lede }} />
            </div>
          </header>
          <div className="prose">{content}</div>
        </main>
        <nav className="toc" aria-label="On this page">
          <h2>On this page</h2>
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.text}</a>
              </li>
            ))}
          </ul>
        </nav>
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
