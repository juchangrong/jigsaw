# Agent Note: Playground polish pass

Status: implemented

## Problem

A polish pass on the Puzzle Icon Playground found these issues:

- The "Seed" label (4.36:1) and the unselected segmented options (4.0:1) were below the WCAG AA contrast of 4.5:1.
- Every option in a segmented control was a separate tab stop, and arrow keys did nothing, although the controls were marked as radio groups.
- Panel segmented controls had no visible label, and long option sets wrapped onto two lines.
- Options showed API identifiers such as `softResin` and `webgl2`.
- The primary button lost its color on hover.
- The toast was not announced to screen readers.
- Colors were repeated as raw hex values.

There was no product context file for design work.

## Decision

`docs/PRODUCT.md` records the playground's register (product), its users, its personality (precise, calm, crafted), its anti-references and the WCAG 2.2 AA target. It lives in `docs/` because of the documentation placement rule.

The playground changes:

- **Tokens:** shared colors are tokens in `styles.css`: `--surface-2`, `--border-strong`, `--accent-hover`, `--accent-active` and `--on-dark-muted`. `--muted` is darkened to `#62627a`, which is at least 4.5:1 on every surface it appears on.
- **Segmented controls:** a segmented control is one tab stop. Arrow keys, Home and End move the selection, so it behaves like a native radio group.
- **Labels:** panel choices use a `Choice` row, with a visible label above a full-width control whose segments share the width equally.
- **Option names:** options show readable names from one `NAMES` map, for example "Soft resin" and "WebGL2".
- **Buttons:** buttons have hover, active and focus states. Palette buttons report `aria-pressed`, and gallery tiles are labeled "Use seed …".
- **Copy:** the download button names its format, for example "Download PNG". Section headings are sentence case instead of tracked uppercase.
- **Toast:** the toast is a persistent `role="status"` live region. It fades in over 200 ms, appears without motion under `prefers-reduced-motion`, and a new message resets its timer.
- **Touch targets:** on coarse pointers, buttons are at least 44 px tall.

## Alternatives considered

**Keep the label-and-control grid for segmented rows.** This matches the slider rows. It lost because the Preset, Resolution and Backend options do not fit the 192 px left after the label column, so they wrapped onto two lines.

**Lighten the surfaces instead of darkening `--muted`.** It lost because the backgrounds are already near white. Changing them would shift the whole palette to fix a single text color.

## Consequences

Verified in the playground: no text element is below 4.5:1, each of the 7 radio groups has one tab stop and a label, arrow keys move the selection and the focus, the toast is announced, and no choice row wraps. At 375 px wide there is no horizontal scroll and every button is at least 44 px tall. The console has no errors. `pnpm typecheck` passes.

Gaps: the playground has no automated UI tests, so these checks were done by hand in the browser. The badge and backdrop colors remain fixed values because they match export backgrounds and backend identities rather than theme roles.
