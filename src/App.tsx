// Phase 0 shell. The real interface (text box, macro knobs, advanced panel)
// lands in Phase 1 on feature/ui-shell. Nothing here may import from src/dsp
// except through the worklet boundary that Phase 1 introduces.
export function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Synthonos</h1>
      <p>Describe a sound. (Coming in Phase 1.)</p>
    </main>
  );
}
