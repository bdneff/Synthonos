/**
 * Synthonos shell, in deck grammar: layered slate panels seamed by 1px
 * lines, color as information throughout (see src/ui/styles.css).
 * 1. Top rail: brand mark (the tri-band bars), the describe lane with
 *    its spectrum hairline, the loaded sound readout, history keys.
 * 2. The display strip: tri-band spectrum and white-phosphor waveform.
 * 3. Body: the crate (library + match) on the left, the eight hot-cue
 *    macros center, the advanced rack (manifest-generated) behind a
 *    toggle rail that also prints the signal path.
 * 4. The keys deck across the bottom.
 * Bound to the stub engine bridge until the real engine lands.
 */

import { useCallback, useEffect, useState } from "react";
import { SynthProvider, useSynth } from "./ui/store";
import { DescribeBar } from "./ui/DescribeBar";
import { MacroPanel } from "./ui/MacroPanel";
import { AdvancedPanel } from "./ui/AdvancedPanel";
import { PresetBrowser } from "./ui/PresetBrowser";
import { MatchPanel } from "./ui/MatchPanel";
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
      <header className="top-rail">
        <div className="brand">
          {/* The mark quotes law 1: frequency is color, low to high. */}
          <svg className="brand-mark" viewBox="0 0 28 28" aria-hidden="true">
            <rect x="2" y="11" width="3.5" height="6" rx="1.2" fill="var(--low)" />
            <rect x="8" y="7.5" width="3.5" height="13" rx="1.2" fill="var(--m-thickness)" />
            <rect x="14" y="4" width="3.5" height="20" rx="1.2" fill="var(--mid)" />
            <rect x="20" y="9" width="3.5" height="10" rx="1.2" fill="var(--high)" />
          </svg>
          <div className="brand-text">
            <div className="brand-name">Synthonos</div>
            <div className="brand-sub">say it, hear it</div>
          </div>
        </div>
        <i className="rail-divider" aria-hidden="true" />
        <DescribeBar />
        <i className="rail-divider" aria-hidden="true" />
        <div className="sound-block">
          <span className="silk-label">Sound</span>
          <div
            className="current-preset has-tooltip"
            data-tooltip="The sound you are editing right now."
          >
            {store.presetName}
          </div>
        </div>
        <div className="header-right">
          <div className="header-right-row">
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
            <Settings />
          </div>
          <div className="model-plate">SYNTHONOS · SYN-01</div>
        </div>
      </header>

      <div className="glass-deck">
        <div className="glass">
          <SpectrumAnalyzer source={spectrumSource} />
          <i className="glass-divider" aria-hidden="true" />
          <Oscilloscope source={scopeSource} />
        </div>
      </div>

      <div className="app-body">
        <div className="left-column">
          <PresetBrowser />
          <MatchPanel />
        </div>
        <i className="body-divider" aria-hidden="true" />
        <main className="app-main">
          <MacroPanel />
          <section className={`advanced-section${advancedOpen ? " open" : ""}`}>
            <button
              type="button"
              className={`advanced-toggle${advancedOpen ? " open" : ""}`}
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
            >
              <svg
                className="advanced-chevron"
                viewBox="0 0 10 10"
                aria-hidden="true"
              >
                <path
                  d="M3 1.5 L7.5 5 L3 8.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="advanced-word">Advanced</span>
              <span className="flow-legend" aria-hidden="true">
                OSC A/B&ensp;&#9656;&ensp;MIXER&ensp;&#9656;&ensp;FILTER&ensp;&#9656;&ensp;AMP&ensp;&#9656;&ensp;FX&ensp;&#9656;&ensp;OUT
              </span>
              <i className="silk-line" aria-hidden="true" />
              <span className="advanced-hint">
                {advancedOpen
                  ? "hover any control for a plain explanation"
                  : "open the full rack"}
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
