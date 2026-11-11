import { deriveSeed, hashString, pictogramColor } from "@jigsaw/core";
import { PuzzleIcon, PuzzleMosaic, PuzzlePictogram, useRendererBackend } from "@jigsaw/react";
import { StrictMode, useRef, useState, type ReactNode } from "react";
import { BRIGHT, Footer, Header, ROOT, mount } from "./chrome";
import "./site.css";

const SAMPLES = ["Inbox triage", "Release notes", "Standup digest", "Invoice parser", "Design review", "On-call helper"];
const SIZES = [32, 48, 64, 96, 128] as const;
const BACKENDS = { webgpu: "WebGPU", webgl2: "WebGL2", cpu: "the CPU" } as const;
// the pick the installable component makes when no palette is given
const familyFor = (seed: string) => BRIGHT[hashString(`${seed}:palette`) % BRIGHT.length]!;

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

function Code({ children, label }: { children: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div className="code">
      <div>
        <span>{label}</span>
        <button type="button" onClick={copy} aria-live="polite">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre tabIndex={0} aria-label={label}>
        <code>{children}</code>
      </pre>
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

function Landing() {
  const [seed, setSeed] = useState("aurora-01");
  const counter = useRef(0);
  const backend = useRendererBackend();
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
            <h1>A seed in, an icon out.</h1>
            <p className="lede">
              jigsaw turns any id or name into a puzzle-piece icon: a rendered resin piece for app icons and avatars, or a flat SVG mosaic for lists. The same
              seed always draws the same icon, so there is nothing to design and nothing to store.
            </p>
            <div className="actions">
              <a className="button primary" href={`${ROOT}playground/`}>
                Open the playground
              </a>
              <a className="button" href={`${ROOT}docs/`}>
                Read the docs
              </a>
            </div>
          </div>

          <div className="stage">
            <div className="seed-field">
              <label htmlFor="seed">Seed</label>
              <input id="seed" value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} autoComplete="off" />
              <button type="button" onClick={randomize}>
                Randomize
              </button>
            </div>
            <div className="stage-art">
              <PuzzleIcon seed={seed} size={216} title={`Rendered piece for the seed ${seed}`} />
              <ul className="forms">
                <Form name="Mosaic" note="SVG, for lists">
                  <PuzzleMosaic seed={seed} size={56} colors={family.colors} variant="accent" />
                </Form>
                <Form name="Pictogram" note="SVG, from 24 px">
                  <PuzzlePictogram seed={seed} size={56} color={pictogramColor(family)} scale={0.86} />
                </Form>
                <Form name="Outline" note="SVG, beside text">
                  <PuzzlePictogram seed={seed} size={56} variant="outline" color="#62627a" strokeWidth={1.6} scale={0.86} />
                </Form>
              </ul>
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
        </section>

        <section className="band" aria-labelledby="lists">
          <div className="band-copy">
            <h2 id="lists">An icon for every row, from the id you already have</h2>
            <p>
              <code>PuzzleMosaic</code> draws a tile cut into four pieces as inline SVG. It needs no canvas, no GPU and no image files, and the seed also picks
              the colour, so an agent keeps its icon wherever it appears.
            </p>
            <Code label="In a list">{LIST_CODE}</Code>
          </div>
          <ul className="rows" aria-label="Example list">
            {SAMPLES.map((s, i) => (
              <li key={s}>
                <PuzzleMosaic seed={s} size={40} colors={familyFor(s).colors} variant="accent" />
                <span>
                  <strong>{s}</strong>
                  {
                    [
                      "Sorts new mail by urgency",
                      "Drafts the changelog",
                      "Collects yesterday's updates",
                      "Reads totals and due dates",
                      "Checks mockups against tokens",
                      "Answers pages after hours",
                    ][i]
                  }
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="band reverse" aria-labelledby="sizes">
          <div className="band-copy">
            <h2 id="sizes">A piece with real depth, sharp from 32 px to 1024 px</h2>
            <p>
              <code>PuzzleIcon</code> shades the piece from a distance field: a soft bevel, a diffuse gradient and one light. It renders with WebGPU, falls back
              to WebGL2 and then the CPU, and exports the same pixels as PNG or WebP.
            </p>
            <Code label="This seed">{pieceCode(seed)}</Code>
            <p className="note" aria-live="polite">
              {backend ? `These icons are rendered on this page with ${BACKENDS[backend]}.` : " "}
            </p>
          </div>
          <ul className="sizes" aria-label={`The seed ${seed} at five sizes`}>
            {SIZES.map((px) => (
              <li key={px}>
                <PuzzleIcon seed={seed} size={px} />
                <span>{px}</span>
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
          <h2 id="start">Add PuzzleMosaic to a project</h2>
          <p>Run this in a project that has a components.json. The CLI copies one file into your components folder.</p>
          <Code label="Terminal">{`npx shadcn@latest add ${registryUrl}`}</Code>
          <ul className="links">
            <li>
              <a href={`${ROOT}docs/`}>Use jigsaw icons</a>
              Rendering pieces, SVG icons, exporting files.
            </li>
            <li>
              <a href={`${ROOT}docs/api/`}>API reference</a>
              Props, options, the generator and colour sets.
            </li>
            <li>
              <a href={`${ROOT}docs/registry/`}>PuzzleMosaic registry</a>
              Installing, updating and the component's props.
            </li>
          </ul>
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
