import { StrictMode } from "react";
import { createRoot, type Root as ReactRoot } from "react-dom/client";
import { CardsPage } from "./CardsPage";
import { pagePath, type PlaygroundPage } from "./controls";
import { ErrorBoundary } from "./ErrorBoundary";
import { MosaicPage } from "./MosaicPage";
import "./styles.css";

// links made before the pages had paths of their own
if (window.location.hash === "#/cards") window.location.replace(pagePath("cards"));

/** Each page is its own HTML entry, which names the page in `data-page`. */
const page = (document.documentElement.dataset.page ?? "mosaic") as PlaygroundPage;
const Root = () => <ErrorBoundary>{page === "cards" ? <CardsPage /> : <MosaicPage />}</ErrorBoundary>;

// Bun's hot reload runs this module again when it changes; reuse the root it already made
const root = ((import.meta.hot.data as { root?: ReactRoot }).root ??= createRoot(document.getElementById("root")!));
root.render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
