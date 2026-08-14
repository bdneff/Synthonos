/**
 * The patch bank: presets as a strip of named switch caps with category
 * selectors, the way an 80s receiver carried its station presets. The
 * Init cap is always first; the loaded cap lights its LED. Saving files
 * the sound under "Your sounds" and jumps the bank there so it appears
 * under your finger.
 *
 * Every preset is a starting point, not an endpoint: load one, then
 * describe what to change.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import defaultPresetJson from "../generated/default-preset.json";
import { FACTORY_CATEGORIES, FACTORY_PRESETS } from "../presets";
import { MatchPanel } from "./MatchPanel";
import { useSynth } from "./store";
import type { PatchParams } from "./store";
import {
  deletePreset,
  loadUserPresets,
  renamePreset,
  saveUserPresets,
  upsertPreset,
} from "./presets";
import type { UserPreset } from "./presets";

const INIT_NAME: string = defaultPresetJson.name;
const INIT_PARAMS = defaultPresetJson.params as unknown as PatchParams;
const YOUR_SOUNDS = "Your sounds";

export function PatchBank() {
  const { params, presetName, loadPreset } = useSynth();
  const [userPresets, setUserPresets] = useState<UserPreset[]>(() =>
    loadUserPresets(window.localStorage),
  );
  const [category, setCategory] = useState<string>(FACTORY_CATEGORIES[0]);
  const [saveName, setSaveName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  // Deleting is a two-step press on the cap itself: first press arms in
  // danger ink, second deletes; it disarms itself after a beat.
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const disarmTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (disarmTimer.current !== null) window.clearTimeout(disarmTimer.current);
    },
    [],
  );

  const persist = useCallback((next: UserPreset[]) => {
    setUserPresets(next);
    saveUserPresets(window.localStorage, next);
  }, []);

  const handleSave = useCallback(() => {
    const name =
      saveName.trim() !== "" ? saveName.trim() : suggestCopyName(presetName, userPresets);
    try {
      persist(upsertPreset(userPresets, name, params));
      setSaveName("");
      setCategory(YOUR_SOUNDS);
      setNotice(`Saved "${name}"`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save preset");
    }
  }, [saveName, presetName, userPresets, params, persist]);

  const handleLoad = useCallback(
    (name: string, presetParams: PatchParams) => {
      const issues = loadPreset(name, presetParams);
      setNotice(
        issues.length === 0
          ? null
          : `Could not load "${name}": ${issues[0].param} ${issues[0].message}`,
      );
    },
    [loadPreset],
  );

  const handleRename = useCallback(
    (oldName: string) => {
      const next = renamePreset(userPresets, oldName, renameValue);
      const changed = next.some((p) => p.name === renameValue.trim());
      if (changed) {
        persist(next);
      } else if (renameValue.trim() !== "" && renameValue.trim() !== oldName) {
        setNotice("That name is already taken");
      }
      setRenaming(null);
      setRenameValue("");
    },
    [userPresets, renameValue, persist],
  );

  const handleDelete = useCallback(
    (name: string) => {
      if (disarmTimer.current !== null) window.clearTimeout(disarmTimer.current);
      if (armedDelete !== name) {
        setArmedDelete(name);
        disarmTimer.current = window.setTimeout(() => {
          disarmTimer.current = null;
          setArmedDelete(null);
        }, 3000);
        return;
      }
      setArmedDelete(null);
      persist(deletePreset(userPresets, name));
    },
    [userPresets, persist, armedDelete],
  );

  const categories: string[] = [...FACTORY_CATEGORIES, YOUR_SOUNDS];
  const shown =
    category === YOUR_SOUNDS
      ? userPresets.map((p) => ({ name: p.name, params: p.params, user: true }))
      : FACTORY_PRESETS.filter((p) => p.category === category).map((p) => ({
          name: p.name,
          params: p.params as PatchParams,
          user: false,
        }));

  return (
    <section className="patch-bank" aria-label="Patch bank">
      <div className="bank-head">
        <span className="silk-title">Patch Bank</span>
        <div className="bank-cats" role="tablist" aria-label="Sound categories">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={category === cat}
              className={`bank-cat${category === cat ? " selected" : ""}`}
              data-cat={cat}
              onClick={() => setCategory(cat)}
            >
              <i className="cat-ink" aria-hidden="true" />
              {cat}
            </button>
          ))}
        </div>
        <i className="silk-line" aria-hidden="true" />
        <span className="silk-fine">
          {FACTORY_PRESETS.length + 1 + userPresets.length} sounds · every one a
          starting point
        </span>
        <button
          type="button"
          className={`button bank-match-toggle${matchOpen ? " open" : ""}`}
          aria-expanded={matchOpen}
          onClick={() => setMatchOpen((open) => !open)}
        >
          Match a sound
        </button>
      </div>

      <div className="bank-row" data-cat={category}>
        <div className="bank-caps">
        <button
          type="button"
          className={`patch-cap init-cap${presetName === INIT_NAME ? " current" : ""}`}
          title="A clean starting point: one plain saw wave"
          onClick={() => handleLoad(INIT_NAME, INIT_PARAMS)}
        >
          <i className="cap-led" aria-hidden="true" />
          {INIT_NAME}
        </button>

        {shown.map((preset) =>
          renaming === preset.name ? (
            <input
              key={preset.name}
              className="preset-rename-input"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename(preset.name);
                if (e.key === "Escape") {
                  setRenaming(null);
                  setRenameValue("");
                }
              }}
              onBlur={() => handleRename(preset.name)}
            />
          ) : (
            <span
              key={preset.name}
              className={`patch-cap-seat${preset.user ? " user" : ""}`}
            >
              <button
                type="button"
                className={`patch-cap${presetName === preset.name ? " current" : ""}`}
                onClick={() => handleLoad(preset.name, preset.params)}
                onDoubleClick={
                  preset.user
                    ? () => {
                        setRenaming(preset.name);
                        setRenameValue(preset.name);
                      }
                    : undefined
                }
                title={
                  preset.user
                    ? "Load this sound. Double-click to rename."
                    : "Load this sound, then describe what to change."
                }
              >
                <i className="cap-led" aria-hidden="true" />
                {preset.name}
              </button>
              {preset.user ? (
                <button
                  type="button"
                  className={`cap-delete${armedDelete === preset.name ? " armed" : ""}`}
                  aria-label={
                    armedDelete === preset.name
                      ? `Press again to delete ${preset.name}`
                      : `Delete ${preset.name}`
                  }
                  title={
                    armedDelete === preset.name
                      ? "Press again to delete. This cannot be undone."
                      : "Delete this preset"
                  }
                  onClick={() => handleDelete(preset.name)}
                >
                  {armedDelete === preset.name ? "Sure?" : "×"}
                </button>
              ) : null}
            </span>
          ),
        )}

        {category === YOUR_SOUNDS && userPresets.length === 0 ? (
          <span className="bank-empty">
            Nothing saved yet. Shape a sound, name it here, and it gets a cap.
          </span>
        ) : null}
        </div>

        <div className="bank-save">
          <input
            className="preset-save-input"
            placeholder="Name this sound"
            autoComplete="off"
            spellCheck={false}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <button type="button" className="button primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>

      {notice !== null ? <div className="preset-notice">{notice}</div> : null}

      {matchOpen ? (
        <div className="match-drawer">
          <MatchPanel />
        </div>
      ) : null}
    </section>
  );
}

function suggestCopyName(base: string, existing: readonly UserPreset[]): string {
  const taken = new Set(existing.map((p) => p.name));
  let candidate = base === "Init" ? "My sound" : `${base} edit`;
  let counter = 2;
  while (taken.has(candidate)) {
    candidate = `${base === "Init" ? "My sound" : `${base} edit`} ${counter}`;
    counter += 1;
  }
  return candidate;
}
