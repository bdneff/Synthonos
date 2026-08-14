/**
 * Synthonos shell, in Jupiter panel grammar: one painted-steel face,
 * silkscreen frames, the machine speaking in light (see
 * src/ui/styles.css).
 * 1. Top rail: Michroma wordmark over its rainbow quote, the describe
 *    lane with its rainbow hairline, history keys, settings.
 * 2. The symmetric console: macro Bank A, the instrument cluster
 *    (spectrum over green-phosphor scope, patch LED window, spec
 *    print), macro Bank B.
 * 3. The advanced rack (manifest-generated) behind a toggle rail that
 *    also prints the signal path.
 * 4. The patch bank: presets as named switch caps with category inks.
 * 5. The keys deck under the full-width rainbow band.
 */

import { useCallback, useEffect, useState } from "react";
import { SynthProvider, useSynth } from "./ui/store";
import { DescribeBar } from "./ui/DescribeBar";
import { MacroBank } from "./ui/MacroPanel";
import { AdvancedPanel } from "./ui/AdvancedPanel";
import { PatchBank } from "./ui/PatchBank";
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
    <div className={`app${advancedOpen ? " rack-open" : ""}`}>
      <header className="top-rail">
        <div className="brand">
          <div className="brand-text">
            <div className="brand-name">Synthonos</div>
            {/* The rainbow signature, quoted small: the eight macro
                inks as pinstripes, exactly like the band over the keys. */}
            <div className="brand-stripes" aria-hidden="true" />
            <div className="brand-sub">say it, hear it</div>
          </div>
        </div>
        <i className="rail-divider" aria-hidden="true" />
        <DescribeBar />
        <i className="rail-divider" aria-hidden="true" />
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
          <div className="model-plate">Polyphonic Synthesizer · SYN-01</div>
        </div>
      </header>

      {/* The symmetric console: four macros left, the instrument cluster
          center, four macros right — the flagship's own composition. */}
      <div className="console-row">
        <MacroBank bank="a" />
        <div className="console-center">
          <div className="glass console-glass">
            <SpectrumAnalyzer source={spectrumSource} />
            <i className="glass-divider" aria-hidden="true" />
            <Oscilloscope source={scopeSource} />
          </div>
          <div className="console-readout">
            <span className="silk-label">Sound</span>
            <div
              className="current-preset has-tooltip"
              data-tooltip="The sound you are editing right now."
            >
              {/* Long names scroll across the glass like a real display. */}
              <span className={store.presetName.length > 18 ? "marquee" : ""}>
                {store.presetName}
              </span>
            </div>
          </div>
          {/* The spec line every flagship printed on its panel. */}
          <div className="panel-spec" aria-hidden="true">
            16 voices &middot; wavetable oscillators &middot; state variable
            filter
          </div>
        </div>
        <MacroBank bank="b" />
      </div>

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
            OSCILLATORS&ensp;&#9656;&ensp;MIXER&ensp;&#9656;&ensp;FILTER&ensp;&#9656;&ensp;LOUDNESS&ensp;&#9656;&ensp;EFFECTS&ensp;&#9656;&ensp;OUT
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

      <PatchBank />

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
