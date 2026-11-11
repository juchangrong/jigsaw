import { deriveSeed, pictogramColor, tileColor } from "@jigsaw/core";
import { PuzzleIcon, PuzzleMosaic, PuzzlePictogram, useRendererBackend } from "@jigsaw/react";
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
const BACKENDS = { webgpu: "WebGPU", webgl2: "WebGL2", cpu: "the CPU" } as const;

const LIST_CODE = `import { PuzzleMosaic } from "@/components/puzzle-mosaic";

{agents.map((agent) => (
  <PuzzleMosaic
    key={agent.id}
    seed={agent.id}
    title={agent.name}
  />
))}`;

const pieceCode = (seed: string) => `import { PuzzleIcon } from "@jigsaw/react";

<PuzzleIcon seed=${JSON.stringify(seed)} size={128} />`;

type TileKind = "piece" | "accent" | "tonal" | "solid" | "outline";
const KINDS: TileKind[] = ["accent", "piece", "solid", "tonal", "piece", "outline"];
/** three columns of icons from derived seeds; each column starts at a different kind so rows do not line up */
const WALL = [0, 1, 2].map((col) => KINDS.map((_, i) => ({ seed: deriveSeed("wall", col * 10 + i), kind: KINDS[(i + col * 2) % KINDS.length]! })));

function Tile({ seed, kind }: { seed: string; kind: TileKind }) {
  const family = familyFor(seed);
  return (
    <li>
      {kind === "piece" && <PuzzleIcon seed={seed} size={104} />}
      {kind === "accent" && <PuzzleMosaic seed={seed} size={84} colors={family.colors} variant="accent" />}
      {kind === "tonal" && <PuzzleMosaic seed={seed} size={84} colors={family.colors} />}
      {kind === "solid" && <PuzzlePictogram seed={seed} size={84} color="#fff" background={tileColor(family)} />}
      {kind === "outline" && <PuzzlePictogram seed={seed} size={84} variant="outline" color={pictogramColor(family)} strokeWidth={2} scale={0.8} />}
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
  const backend = useRendererBackend();
  const family = familyFor(seed);
  const blue = BRIGHT[0]!;
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
              Tune a mosaic or a rendered piece <span aria-hidden="true">→</span>
            </a>
            <h1>Puzzle-piece icons, generated from a seed.</h1>
            <p className="lede">
              jigsaw turns any id or name into an icon: a rendered resin piece for app icons and avatars, or a flat SVG mosaic for lists. The same seed always
              draws the same icon, so there is nothing to design and nothing to store.
            </p>
            <div className="actions">
              <a className="button primary" href={`${ROOT}docs/api/#components`}>
                Browse components
              </a>
              <a className="button" href={`${ROOT}docs/`}>
                Read the docs
              </a>
            </div>
            <p className="runs">
              Renders with <span>WebGPU</span>
              <span>WebGL2</span>
              <span>CPU</span>
              <span>SVG</span>
            </p>
          </div>
          <Wall />
        </section>

        <section aria-labelledby="try">
          <Heading
            id="try"
            eyebrow="Try it"
            title="One seed, four forms"
            text="Type a name or an id. Every form below is drawn from it on this page, with the same code the components ship."
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
                <PuzzleIcon seed={seed} size={216} title={`Rendered piece for the seed ${seed}`} />
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
              <Form name="Mosaic" note="Inline SVG, for lists and cards">
                <PuzzleMosaic seed={seed} size={64} colors={family.colors} variant="accent" />
              </Form>
              <Form name="Pictogram" note="Inline SVG, from 24 px">
                <PuzzlePictogram seed={seed} size={64} color={pictogramColor(family)} scale={0.86} />
              </Form>
              <Form name="Outline" note="Inline SVG, beside text">
                <PuzzlePictogram seed={seed} size={64} variant="outline" color="currentColor" strokeWidth={1.6} scale={0.86} />
              </Form>
              <li className="size-row" aria-label={`The seed ${seed} at five sizes`}>
                {SIZES.map((px) => (
                  <span key={px}>
                    <PuzzleIcon seed={seed} size={px} />
                    {px}
                  </span>
                ))}
              </li>
            </ul>
          </div>
          <p className="note" aria-live="polite">
            {backend ? `The rendered pieces on this page are drawn with ${BACKENDS[backend]}.` : " "}
          </p>
        </section>

        <section aria-labelledby="components">
          <Heading
            id="components"
            eyebrow="Components"
            title="Three React components, one seed"
            text="Pick the form by where the icon appears. All three take the same seed and are deterministic."
            link={{ label: "Browse the reference", href: `${ROOT}docs/api/#components` }}
          />
          <ul className="cards">
            <Card
              name="PuzzleIcon"
              text="A piece in one colour with a soft bevel, rendered on a canvas from 32 px to 1024 px."
              href={`${ROOT}docs/api/#puzzleicon`}
            >
              <PuzzleIcon seed="alpha" size={88} />
              <PuzzleIcon seed="team-42" size={88} layout="cluster" pieceCount={3} />
              <PuzzleIcon seed="board" size={88} layout="grid" pieceCount={4} />
            </Card>
            <Card
              name="PuzzleMosaic"
              text="A tile cut into four pieces in the shades of one colour. Inline SVG, made for lists and cards."
              href={`${ROOT}docs/api/#puzzlemosaic`}
            >
              {BRIGHT.slice(0, 4).map((f, i) => (
                <PuzzleMosaic key={f.id} seed={`m${i}`} size={56} colors={f.colors} variant={i % 2 ? "tonal" : "accent"} />
              ))}
            </Card>
            <Card
              name="PuzzlePictogram"
              text="One piece as a flat sign or a line, for toolbars and dense lists at about 24 px."
              href={`${ROOT}docs/api/#puzzlepictogram`}
            >
              <PuzzlePictogram seed="p1" size={48} color={pictogramColor(blue)} />
              <PuzzlePictogram seed="p2" size={56} color="#fff" background={tileColor(BRIGHT[3]!)} />
              <PuzzlePictogram seed="p3" size={48} variant="outline" color="currentColor" strokeWidth={1.6} />
              <PuzzlePictogram seed="p4" size={56} color="#fff" background={tileColor(BRIGHT[1]!)} />
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
              <dd>Geometry, colour and material come from seeded random streams. The same options give the same description on every machine.</dd>
            </div>
            <div>
              <dt>Pieces that fit</dt>
              <dd>Every single piece shares one connector, so icons from different seeds interlock and assemble into a framed puzzle.</dd>
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
          <CodeBlock label="Rendered piece">{pieceCode(seed)}</CodeBlock>
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
