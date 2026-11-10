import { StrictMode, useEffect, useState } from "react";
import { createRoot, type Root as ReactRoot } from "react-dom/client";
import { App } from "./App";
import { CardsPage } from "./CardsPage";
import { ErrorBoundary } from "./ErrorBoundary";
import { MosaicPage } from "./MosaicPage";
import "./styles.css";

/** Three pages, switched by the URL hash: `#/` (mosaic, the default), `#/piece` (the rendered piece) and `#/cards`. */
function Root() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const page = hash === "#/cards" ? "cards" : hash === "#/piece" ? "piece" : "mosaic";
  // keyed by page, so going to another page leaves a failed one behind
  return <ErrorBoundary key={page}>{page === "cards" ? <CardsPage /> : page === "piece" ? <App /> : <MosaicPage />}</ErrorBoundary>;
}

// Bun's hot reload runs this module again when it changes; reuse the root it already made
const root = ((import.meta.hot.data as { root?: ReactRoot }).root ??= createRoot(document.getElementById("root")!));
root.render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
