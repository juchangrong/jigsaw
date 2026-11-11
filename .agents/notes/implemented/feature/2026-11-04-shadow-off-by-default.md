# Agent Note: Drop shadow off by default

Status: implemented

## Problem

Every icon rendered a soft drop shadow around the piece, and the playground showed an "Ambient shadow" checkbox with opacity and blur sliders. The user does not want the shadow around the piece, and does not want those controls in the playground.

## Decision

`DEFAULT_SHADOW.enabled` in `packages/core/src/material/presets.ts` is `false`, so icons render without a shadow unless a caller passes `shadow: { enabled: true }`. The shadow pass, its options and its other defaults (opacity 0.12, blur 0.04, offset 0.01 / 0.025) are unchanged.

The playground no longer has the shadow checkbox and sliders, and its state no longer carries shadow fields. The library API still accepts `shadow`, so `<PuzzleIcon shadow={{ enabled: true }} />` still works.

Default output changes, so `PRESET_VERSION` is `1.1.0` and `tests/golden/signatures.json` is re-baselined. The test that checks shadow alpha on a transparent background now enables the shadow explicitly. `README.md` and `docs/design.md` describe the shadow as off by default.

## Alternatives considered

**Remove the shadow entirely.** This deletes the shadow pass from the WGSL, GLSL and CPU backends, the `shadow` option and its tests. It lost because turning the default off already removes the shadow from every icon and the playground. Deleting the code is a larger change and also takes the option away from any caller that wants it.

**Only hide the playground controls.** It lost because the default was on, so the shadow would still render with no way to turn it off in the playground.

## Consequences

Icons render without a shadow by default, in the playground and through the API. Descriptions now report `presetVersion` `1.1.0`, so images cached under `1.0.0` are not reused. `pnpm typecheck` and all 105 tests pass on the new baseline.

Gap: the golden file was rewritten from the CPU renderer. That confirms the new output is stable, not that it looks right. The browser check covers how it looks.

## Superseded

The code this note describes was removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md). The note is kept as history.
