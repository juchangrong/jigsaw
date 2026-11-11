import { COLOR_SETS, deriveSeed, tintColor } from "@jigsaw/core";
import { PuzzleMosaic } from "@jigsaw/react";
import { StrictMode, useRef, useState, type ReactNode } from "react";
import { BRIGHT, CodeBlock, Footer, Header, ROOT, familyFor, mount } from "./chrome";
import "./site.css";

const SAMPLES = ["Inbox triage", "Release notes", "Standup digest", "Invoice parser", "Design review", "On-call helper"];
const TASKS = [
  "Sorts new mail by urgency",
  "Drafts the changelog",
  "Collects yesterday's updates",
  "Reads totals and due dates",
  "Checks mockups against tokens",
  "Answers pages after hours",
];
const SIZES = [24, 32, 48, 64, 96] as const;

const LIST_CODE = `import { PuzzleMosaic } from "@/components/puzzle-mosaic";

{agents.map((agent) => (
  <PuzzleMosaic
    key={agent.id}
    seed={agent.id}
    title={agent.name}
  />
))}`;

const useCode = (seed: string) => `import { PuzzleMosaic } from "@/components/puzzle-mosaic";

<PuzzleMosaic seed=${JSON.stringify(seed)} size={40} />`;

type TileKind = "accent" | "tonal" | "padded";
const KINDS: TileKind[] = ["accent", "tonal", "padded", "accent", "accent", "tonal"];
/** three columns of icons from derived seeds; each column starts at a different kind so rows do not line up */
const WALL = [0, 1, 2].map((col) => KINDS.map((_, i) => ({ seed: deriveSeed("wall", col * 10 + i), kind: KINDS[(i + col * 2) % KINDS.length]! })));

function Tile({ seed, kind }: { seed: string; kind: TileKind }) {
  const family = familyFor(seed);
  return (
    <li>
      {kind === "padded" ? (
        <span className="padded" style={{ background: tintColor(family) }}>
          <PuzzleMosaic seed={seed} size={62} colors={family.colors} variant="accent" edge={false} />
        </span>
      ) : (
        <PuzzleMosaic seed={seed} size={84} colors={family.colors} variant={kind} />
      )}
    </li>
  );
}

/** A decorative wall of icons that drifts upward and downward. Each column is listed twice so the loop has no seam. */
function Wall() {
  return (
    <div className="wall" aria-hidden="true">
      {WALL.map((column, c) => (
        <ul key={c}>
          {[...column, ...column].map((t, i) => (
            <Tile key={i} {...t} />
          ))}
        </ul>
      ))}
    </div>
  );
}

function Form({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <li>
      {children}
      <span>
        <strong>{name}</strong>
        {note}
      </span>
    </li>
  );
}

function Card({ name, text, href, children }: { name: string; text: string; href: string; children: ReactNode }) {
  return (
    <li className="card">
      <div className="stagebox" aria-hidden="true">
        {children}
      </div>
      <h3>
        <a href={href}>{name}</a>
      </h3>
      <p>{text}</p>
    </li>
  );
}

function Heading({ id, eyebrow, title, text, link }: { id: string; eyebrow: string; title: string; text: string; link?: { label: string; href: string } }) {
  return (
    <div className="heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <div>
        <p>{text}</p>
        {link && (
          <a className="more" href={link.href}>
            {link.label} <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
    </div>
  );
}

function Landing() {
  const [seed, setSeed] = useState("aurora-01");
  const counter = useRef(0);
  const family = familyFor(seed);
  const randomize = () => {
    counter.current++;
    setSeed((s) => deriveSeed(`${s}|${Date.now()}`, counter.current));
  };
  const registryUrl = new URL(`${ROOT}r/puzzle-mosaic.json`, window.location.href).href;

  return (
    <div className="site">
      <Header />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <a className="pill" href={`${ROOT}playground/`}>
              <strong>Playground</strong>
              Tune a mosaic and try it in a list <span aria-hidden="true">→</span>
            </a>
            <h1>Puzzle-piece icons, generated from a seed.</h1>
            <p className="lede">
              jigsaw turns any id or name into an icon: a tile cut into four interlocking puzzle pieces, in the shades of one colour. The same seed always draws
              the same icon, so there is nothing to design and nothing to store.
            </p>
            <div className="actions">
              <a className="button primary" href={`${ROOT}docs/api/#puzzlemosaic`}>
                See the component
              </a>
              <a className="button" href={`${ROOT}docs/`}>
                Read the docs
              </a>
            </div>
            <p className="runs">
              Ships as <span>Inline SVG</span>
              <span>One React file</span>
              <span>No dependencies</span>
            </p>
          </div>
          <Wall />
        </section>

        <section aria-labelledby="try">
          <Heading
            id="try"
            eyebrow="Try it"
            title="One seed, one icon"
            text="Type a name or an id. Every icon below is drawn from it on this page, with the same code the component ships."
            link={{ label: "Open the playground", href: `${ROOT}playground/` }}
          />
          <div className="stage">
            <div className="stage-main">
              <div className="seed-field">
                <label htmlFor="seed">Seed</label>
                <input id="seed" value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} autoComplete="off" />
                <button type="button" onClick={randomize}>
                  Randomize
                </button>
              </div>
              <div className="stage-art">
                <PuzzleMosaic seed={seed} size={200} colors={family.colors} variant="accent" title={`Mosaic for the seed ${seed}`} />
              </div>
              <div className="samples">
                <span id="samples-label">Try a name</span>
                <ul aria-labelledby="samples-label">
                  {SAMPLES.map((s) => (
                    <li key={s}>
                      <button type="button" aria-pressed={s === seed} onClick={() => setSeed(s)}>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <ul className="forms">
              <Form name="Accent" note="One deep piece on light ones">
                <PuzzleMosaic seed={seed} size={64} colors={family.colors} variant="accent" />
              </Form>
              <Form name="Tonal" note="One shade per piece">
                <PuzzleMosaic seed={seed} size={64} colors={family.colors} />
              </Form>
              <Form name="Joined" note="No cuts between the pieces">
                <PuzzleMosaic seed={seed} size={64} colors={family.colors} variant="accent" gap={0} />
              </Form>
              <li className="size-row" aria-label={`The seed ${seed} at five sizes`}>
                {SIZES.map((px) => (
                  <span key={px}>
                    <PuzzleMosaic seed={seed} size={px} colors={family.colors} variant="accent" />
                    {px}
                  </span>
                ))}
              </li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="components">
          <Heading
            id="components"
            eyebrow="Component"
            title="One component, a few looks"
            text="PuzzleMosaic takes a seed and four shades of one colour. Its props choose the look."
            link={{ label: "Browse the reference", href: `${ROOT}docs/api/#puzzlemosaic` }}
          />
          <ul className="cards">
            <Card name="Accent" text="One deep piece stands out on three light ones. The default look in lists." href={`${ROOT}docs/api/#puzzlemosaic`}>
              {BRIGHT.slice(0, 4).map((f, i) => (
                <PuzzleMosaic key={f.id} seed={`a${i}`} size={56} colors={f.colors} variant="accent" />
              ))}
            </Card>
            <Card name="Tonal" text="Each piece takes its own shade, deep to light, for a fuller tile." href={`${ROOT}docs/api/#puzzlemosaic`}>
              {BRIGHT.slice(0, 4).map((f, i) => (
                <PuzzleMosaic key={f.id} seed={`t${i}`} size={56} colors={f.colors} />
              ))}
            </Card>
            <Card name="Colour sets" text="Nine sets of colour families, from restrained metals to bright hues." href={`${ROOT}docs/api/#colour-sets`}>
              {["studio", "aluminum", "candy", "ink"].map((id, i) => (
                <PuzzleMosaic key={id} seed={`c${i}`} size={56} colors={COLOR_SETS.find((c) => c.id === id)!.families[i]!.colors} variant="accent" />
              ))}
            </Card>
          </ul>
        </section>

        <section className="band" aria-labelledby="lists">
          <div className="band-copy">
            <p className="eyebrow">In a list</p>
            <h2 id="lists">An icon for every row, from the id you already have</h2>
            <p>
              <code>PuzzleMosaic</code> needs no canvas, no GPU and no image files, and the seed also picks the colour, so an agent keeps its icon wherever it
              appears.
            </p>
            <CodeBlock label="PuzzleMosaic in a list">{LIST_CODE}</CodeBlock>
          </div>
          <ul className="rows" aria-label="Example list">
            {SAMPLES.map((s, i) => (
              <li key={s}>
                <PuzzleMosaic seed={s} size={40} colors={familyFor(s).colors} variant="accent" />
                <span>
                  <strong>{s}</strong>
                  {TASKS[i]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="facts" aria-label="Properties">
          <dl>
            <div>
              <dt>Deterministic</dt>
              <dd>The design and the colour come from the seed through seeded random streams. The same seed gives the same markup on every machine.</dd>
            </div>
            <div>
              <dt>Plain SVG</dt>
              <dd>No canvas, no GPU and no image files. The markup is complete when rendered on a server, and the cuts are transparent on any background.</dd>
            </div>
            <div>
              <dt>Yours to edit</dt>
              <dd>PuzzleMosaic installs as one source file with the shadcn CLI. It depends only on React, and nothing is added to your packages.</dd>
            </div>
          </dl>
        </section>

        <section className="start" aria-labelledby="start">
          <Heading
            id="start"
            eyebrow="Install"
            title="Add PuzzleMosaic to a project"
            text="Run this in a project that has a components.json. The CLI copies one file into your components folder."
            link={{ label: "Installation guide", href: `${ROOT}docs/registry/` }}
          />
          <CodeBlock label="Install command">{`npx shadcn@latest add ${registryUrl}`}</CodeBlock>
          <CodeBlock label="Use it">{useCode(seed)}</CodeBlock>
        </section>
      </main>
      <Footer />
    </div>
  );
}

mount(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
