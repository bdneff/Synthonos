/**
 * Preset browser: the Init preset (generated from the schema) plus user
 * presets persisted in localStorage. Presets read back from storage are
 * validated with the generated validator; corrupt entries are dropped.
 *
 * Every preset is a starting point, not an endpoint, so the browser
 * carries the describe affordance: load a sound, then say what to change.
 */

import { useCallback, useState } from "react";
import defaultPresetJson from "../generated/default-preset.json";
import { FACTORY_CATEGORIES, FACTORY_PRESETS } from "../presets";
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

export function PresetBrowser() {
  const { params, presetName, loadPreset } = useSynth();
  const [userPresets, setUserPresets] = useState<UserPreset[]>(() =>
    loadUserPresets(window.localStorage),
  );
  const [saveName, setSaveName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const persist = useCallback((next: UserPreset[]) => {
    setUserPresets(next);
    saveUserPresets(window.localStorage, next);
  }, []);

  const handleSave = useCallback(() => {
    const name = saveName.trim() !== "" ? saveName.trim() : suggestCopyName(presetName, userPresets);
    try {
      persist(upsertPreset(userPresets, name, params));
      setSaveName("");
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
      if (!window.confirm(`Delete the preset "${name}"? This cannot be undone.`)) return;
      persist(deletePreset(userPresets, name));
    },
    [userPresets, persist],
  );

  return (
    <aside className="preset-browser panel">
      <div className="panel-title library-title">
        Library
        <span className="library-count">{FACTORY_PRESETS.length + 1 + userPresets.length}</span>
      </div>

      <div className="preset-list">
        <div
          className={`preset-row${presetName === INIT_NAME ? " current" : ""}`}
        >
          <button
            type="button"
            className="preset-name"
            onClick={() => handleLoad(INIT_NAME, INIT_PARAMS)}
            title="A clean starting point: one plain saw wave"
          >
            {INIT_NAME}
          </button>
        </div>

        {FACTORY_CATEGORIES.map((category) => (
          <div key={category} className="preset-group">
            <div className="preset-group-header">{category}</div>
            {FACTORY_PRESETS.filter((p) => p.category === category).map(
              (preset) => (
                <div
                  key={preset.name}
                  className={`preset-row${presetName === preset.name ? " current" : ""}`}
                >
                  <button
                    type="button"
                    className="preset-name"
                    onClick={() =>
                      handleLoad(preset.name, preset.params as PatchParams)
                    }
                  >
                    {preset.name}
                  </button>
                        </div>
              ),
            )}
          </div>
        ))}

        <div className="preset-group-header">Your sounds</div>

        {userPresets.map((preset) => (
          <div
            key={preset.name}
            className={`preset-row${presetName === preset.name ? " current" : ""}`}
          >
            {renaming === preset.name ? (
              <input
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
              <>
                <button
                  type="button"
                  className="preset-name"
                  onClick={() => handleLoad(preset.name, preset.params)}
                >
                  {preset.name}
                </button>
                <span className="preset-actions">
                  <button
                    type="button"
                    className="preset-action"
                    title="Rename this preset"
                    onClick={() => {
                      setRenaming(preset.name);
                      setRenameValue(preset.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="preset-action danger"
                    title="Delete this preset"
                    onClick={() => handleDelete(preset.name)}
                  >
                    Delete
                  </button>
                </span>
              </>
            )}
          </div>
        ))}

        {userPresets.length === 0 ? (
          <div className="preset-empty">Nothing saved yet. Shape a sound, name it below, and it lives here.</div>
        ) : null}
      </div>

      <div className="preset-save">
        <input
          className="preset-save-input"
          placeholder="Name this sound"
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

      {notice !== null ? <div className="preset-notice">{notice}</div> : null}

      <div className="preset-affordance">
        Every preset is a starting point. Load one, then use the box at the
        top to describe what to change.
      </div>
    </aside>
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
