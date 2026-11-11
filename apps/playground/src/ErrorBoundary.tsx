import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearStored } from "./storage";

/**
 * Catches an error thrown while a page renders and shows a way out instead of
 * a blank screen. A failed icon render is not a render error; `<PuzzleIcon>`
 * reports those through `onError`.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page failed to render", error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="error-page" role="alert">
        <h1>This page couldn't be shown</h1>
        <p className="muted">Something failed while drawing it. Your saved picks and settings are untouched.</p>
        <pre>{error.message || error.name}</pre>
        <div className="toolbar">
          <button type="button" className="primary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button
            type="button"
            title="Use this if the page fails again after trying"
            onClick={() => {
              clearStored();
              this.setState({ error: null });
            }}
          >
            Clear saved picks and settings, then retry
          </button>
        </div>
      </main>
    );
  }
}
