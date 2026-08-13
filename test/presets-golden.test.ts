/**
 * Golden renders for the factory preset bank: every preset renders mono
 * (L/R average, 0.5 s, 48 kHz) and must match test/golden/presets/<slug>.wav
 * bit-exactly. A refactor that changes the sound of any factory preset fails
 * here until the diff is inspected and the goldens are regenerated on
 * purpose with UPDATE_GOLDEN=1 npm test.
 */

import { describe, it, expect } from "vitest";
import { FACTORY_PRESETS } from "../src/presets";
import {
  compareToPresetGolden,
  presetSlug,
  renderPresetForGolden,
} from "./harness/preset-golden";

describe("factory preset goldens", () => {
  it("preset slugs are unique filesystem names", () => {
    const slugs = FACTORY_PRESETS.map((p) => presetSlug(p.name));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  for (const preset of FACTORY_PRESETS) {
    it(
      `"${preset.name}" matches its golden render`,
      { timeout: 30_000 },
      () => {
        const mono = renderPresetForGolden(preset);
        compareToPresetGolden(presetSlug(preset.name), mono);
      },
    );
  }
});
