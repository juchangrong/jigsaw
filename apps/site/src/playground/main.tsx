import { StrictMode } from "react";
import { createRoot, type Root as ReactRoot } from "react-dom/client";
import { App } from "./App";
import { CardsPage } from "./CardsPage";
import { pagePath, type PlaygroundPage } from "./controls";
import { ErrorBoundary } from "./ErrorBoundary";
import { MosaicPage } from "./MosaicPage";
import "./styles.css";

// links made before the pages had paths of their own
const legacy = { "#/piece": "piece", "#/cards": "cards" }[window.location.hash] as PlaygroundPage | undefined;
if (legacy) window.location.replace(pagePath(legacy));

/** Each page is its own HTML entry, which names the page in `data-page`. */
const page = (document.documentElement.dataset.page ?? "mosaic") as PlaygroundPage;
const Root = () => <ErrorBoundary>{page === "cards" ? <CardsPage /> : page === "piece" ? <App /> : <MosaicPage />}</ErrorBoundary>;

// Bun's hot reload runs this module again when it changes; reuse the root it already made
const root = ((import.meta.hot.data as { root?: ReactRoot }).root ??= createRoot(document.getElementById("root")!));
root.render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
