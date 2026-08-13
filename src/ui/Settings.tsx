/**
 * Settings popover: the Anthropic API key for the describe bar, and an
 * optional model override. Bring your own key; it is stored locally and
 * sent only to the Anthropic API from this machine.
 */

import { useState } from "react";
import { DEFAULT_MODEL, loadNlSettings, saveNlSettings } from "../nl/client";

export function Settings() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => loadNlSettings()?.apiKey ?? "");
  const [model, setModel] = useState(() => loadNlSettings()?.model ?? "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    saveNlSettings({ apiKey, model: model || undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="settings">
      <button
        type="button"
        className="button"
        aria-expanded={open}
        title="Settings"
        onClick={() => setOpen((v) => !v)}
      >
        Settings
      </button>
      {open ? (
        <div className="settings-panel" role="dialog" aria-label="Settings">
          <label className="settings-field">
            <span>Anthropic API key</span>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>Model</span>
            <input
              type="text"
              placeholder={DEFAULT_MODEL}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className="settings-note">
            Powers the describe bar. Your key is stored on this machine and
            sent only to the Anthropic API. Leave the key empty and save to
            remove it.
          </p>
          <div className="settings-actions">
            <button type="button" className="button primary" onClick={save}>
              {saved ? "Saved" : "Save"}
            </button>
            <button type="button" className="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
