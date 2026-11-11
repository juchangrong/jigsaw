import { PuzzleMosaic } from "@jigsaw/react";
import type { ReactNode } from "react";
import { BRIGHT, familyFor } from "./chrome";

const family = BRIGHT[0]!;
const AGENTS = ["Inbox triage", "Release notes", "Standup digest", "Invoice parser", "Design review", "On-call helper"];

/** The live side of the code blocks that the docs mark with `<!-- preview: id -->`. Each draws what its code block shows. */
export const EXAMPLES: Record<string, ReactNode> = {
  mosaic: (
    <>
      <PuzzleMosaic seed="alpha" size={40} colors={family.colors} variant="accent" />
      <PuzzleMosaic seed="alpha" size={40} colors={family.colors} />
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
  "puzzle-mosaic": (
    <>
      <PuzzleMosaic seed="alpha" size={64} colors={family.colors} variant="accent" />
      <PuzzleMosaic seed="alpha" size={64} colors={family.colors} />
      <PuzzleMosaic seed="alpha" size={64} colors={family.colors} variant="accent" gap={0} />
      <PuzzleMosaic seed="alpha" size={64} colors={family.colors} shape="round" />
    </>
  ),
};
