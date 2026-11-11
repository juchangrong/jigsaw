import { pictogramColor, tileColor } from "@jigsaw/core";
import { PuzzleIcon, PuzzleMosaic, PuzzlePictogram } from "@jigsaw/react";
import type { ReactNode } from "react";
import { BRIGHT, familyFor } from "./chrome";

const family = BRIGHT[0]!;
const AGENTS = ["Inbox triage", "Release notes", "Standup digest", "Invoice parser", "Design review", "On-call helper"];

/** The live side of the code blocks that the docs mark with `<!-- preview: id -->`. Each draws what its code block shows. */
export const EXAMPLES: Record<string, ReactNode> = {
  piece: (
    <>
      <PuzzleIcon seed="alpha" size={128} />
      <PuzzleIcon seed="team-42" size={64} layout="cluster" pieceCount={3} palette="dusk" />
      <PuzzleIcon
        seed="board"
        size={256}
        layout="grid"
        pieceCount={9}
        material={{ preset: "matteAcrylic" }}
        background="#FFFFFF"
        style={{ borderRadius: 12 }}
      />
    </>
  ),
  svg: (
    <>
      <PuzzleMosaic seed="alpha" size={40} colors={family.colors} variant="accent" />
      <PuzzleMosaic seed="alpha" size={40} colors={family.colors} />
      <PuzzlePictogram seed="alpha" size={24} color={pictogramColor(family)} />
      <PuzzlePictogram seed="alpha" size={40} color="#fff" background={tileColor(family)} />
      <PuzzlePictogram seed="alpha" size={24} variant="outline" color="#7A7A8C" />
    </>
  ),
  list: (
    <>
      {AGENTS.map((a) => (
        <PuzzleMosaic key={a} seed={a} size={40} colors={familyFor(a).colors} variant="accent" title={a} />
      ))}
    </>
  ),
  registry: (
    <>
      {AGENTS.slice(0, 4).map((a) => (
        <PuzzleMosaic key={a} seed={a} size={40} colors={familyFor(a).colors} variant="accent" title={a} />
      ))}
    </>
  ),
  "puzzle-icon": (
    <>
      <PuzzleIcon seed="alpha" size={96} />
      <PuzzleIcon seed="alpha" size={96} material={{ preset: "matteAcrylic", texture: "paper" }} />
      <PuzzleIcon seed="alpha" size={96} layout="cluster" pieceCount={3} />
      <PuzzleIcon seed="alpha" size={96} layout="grid" pieceCount={4} />
    </>
  ),
  "puzzle-mosaic": (
    <>
      <PuzzleMosaic seed="alpha" size={64} colors={family.colors} variant="accent" />
      <PuzzleMosaic seed="alpha" size={64} colors={family.colors} />
      <PuzzleMosaic seed="alpha" size={64} colors={family.colors} variant="accent" gap={0} />
      <PuzzleMosaic seed="alpha" size={64} colors={family.colors} shape="round" />
    </>
  ),
  "puzzle-pictogram": (
    <>
      <PuzzlePictogram seed="alpha" size={64} color={pictogramColor(family)} />
      <PuzzlePictogram seed="alpha" size={64} color="#fff" background={tileColor(family)} />
      <PuzzlePictogram seed="alpha" size={64} variant="outline" color="#7A7A8C" strokeWidth={1.6} />
    </>
  ),
};
