import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CardsPage } from "./CardsPage";
import { ErrorBoundary } from "./ErrorBoundary";
import "./styles.css";

/** Two pages, switched by the URL hash: `#/` (playground) and `#/cards`. */
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
  const cards = hash === "#/cards";
  // keyed by page, so going to the other page leaves a failed one behind
  return <ErrorBoundary key={cards ? "cards" : "playground"}>{cards ? <CardsPage /> : <App />}</ErrorBoundary>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
