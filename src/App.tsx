/**
 * Synthonos shell: three layers on one screen.
 * 1. The text box ("Describe a sound"), always visible at the top.
 * 2. Eight macro knobs in plain words.
 * 3. The full advanced panel, generated from the schema, behind a toggle.
 * Plus scopes, preset browser, and a playable keyboard. Bound to the stub
 * engine bridge until the real engine lands at integration.
 */

import { useCallback, useEffect, useState } from "react";
import { SynthProvider, useSynth } from "./ui/store";
import { DescribeBar } from "./ui/DescribeBar";
import { MacroPanel } from "./ui/MacroPanel";
import { AdvancedPanel } from "./ui/AdvancedPanel";
import { PresetBrowser } from "./ui/PresetBrowser";
import { Keyboard } from "./ui/Keyboard";
import { SpectrumAnalyzer } from "./ui/SpectrumAnalyzer";
import { Oscilloscope } from "./ui/Oscilloscope";
import { Settings } from "./ui/Settings";
import "./ui/styles.css";

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function Shell() {
  const store = useSynth();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Browsers only allow audio to start from a user gesture. The first
  // pointer or key press anywhere starts the engine; the bridge caches
  // everything that happened before, so nothing is lost.
  useEffect(() => {
    const kick = () => {
      void store.bridge.start?.().catch(() => {
        // A failed start leaves the bridge cached; the next gesture retries.
      });
    };
    window.addEventListener("pointerdown", kick, { passive: true });
    window.addEventListener("keydown", kick);
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, [store.bridge]);

  // Ctrl+Z / Ctrl+Shift+Z (or Cmd on Mac). Ctrl+Y also redoes.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (isTextEntryTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (key === "y") {
        e.preventDefault();
        store.redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store]);

  const spectrumSource = useCallback(
    () => store.bridge.getSpectrumData(),
    [store.bridge],
  );
  const scopeSource = useCallback(
    () => store.bridge.getScopeData(),
    [store.bridge],
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 30 30" aria-hidden="true">
            <rect x="0.5" y="0.5" width="29" height="29" rx="7.5" />
            <path d="M5 15 C7.4 8.4 9.8 8.4 12.2 15 C14.6 21.6 17 21.6 19.4 15 L23.5 9.5 L23.5 15 L26 15" />
          </svg>
          <div className="brand-text">
            <div className="brand-name">Synthonos</div>
            <div className="brand-sub">say it, hear it</div>
          </div>
        </div>
        <DescribeBar />
        <div className="header-right">
          <div className="history-buttons">
            <button
              type="button"
              className="button"
              disabled={!store.canUndo}
              onClick={() => store.undo()}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              type="button"
              className="button"
              disabled={!store.canRedo}
              onClick={() => store.redo()}
              title="Redo (Ctrl+Shift+Z)"
            >
              Redo
            </button>
          </div>
          <div
            className="current-preset has-tooltip"
            data-tooltip="The sound you are editing right now."
          >
            {store.presetName}
          </div>
          <Settings />
        </div>
      </header>

      <div className="app-body">
        <PresetBrowser />
        <main className="app-main">
          <MacroPanel />
          <div className="scope-row">
            <SpectrumAnalyzer source={spectrumSource} />
            <Oscilloscope source={scopeSource} />
          </div>
          <section className="advanced-section">
            <button
              type="button"
              className={`advanced-toggle${advancedOpen ? " open" : ""}`}
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
            >
              <span className="advanced-chevron">{advancedOpen ? "▾" : "▸"}</span>
              Advanced
              <span className="advanced-hint">
                {advancedOpen
                  ? "every control, hover any of them for a plain explanation"
                  : "open the full panel"}
              </span>
            </button>
            {advancedOpen ? <AdvancedPanel /> : null}
          </section>
        </main>
      </div>

      <Keyboard />
    </div>
  );
}

export function App() {
  return (
    <SynthProvider>
      <Shell />
    </SynthProvider>
  );
}
