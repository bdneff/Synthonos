/**
 * Layer 3: the full parameter surface, generated entirely from the UI
 * manifest. Nothing here is hardcoded per parameter: add a parameter to
 * params.schema.json, run codegen, and it appears in the right group with
 * its tooltip. Knobs for float and int, a segmented selector for enums.
 */

import manifestJson from "../generated/ui-manifest.json";
import { PARAMS } from "../generated/params";
import type { ParamCurve, ParamId } from "../generated/params";
import { Knob } from "./Knob";
import { EnumSelector } from "./EnumSelector";
import { formatParamValue } from "./param-utils";
import { useSynth } from "./store";

interface ManifestControl {
  readonly id: string;
  readonly label: string;
  readonly type: "float" | "int" | "enum";
  readonly values?: readonly string[];
  readonly min: number;
  readonly max: number;
  readonly default: number | string;
  readonly curve: ParamCurve;
  readonly unit: string;
  readonly tooltip: string;
}

interface ManifestGroup {
  readonly name: string;
  readonly controls: readonly ManifestControl[];
}

interface UiManifest {
  readonly groups: readonly ManifestGroup[];
}

const MANIFEST = manifestJson as unknown as UiManifest;

function isParamId(id: string): id is ParamId {
  return Object.prototype.hasOwnProperty.call(PARAMS, id);
}

function ManifestControlView({ control }: { control: ManifestControl }) {
  const store = useSynth();
  if (!isParamId(control.id)) return null;
  const id = control.id;
  const value = store.params[id];

  if (control.type === "enum") {
    const values = control.values ?? [];
    return (
      <EnumSelector
        label={control.label}
        values={values}
        value={typeof value === "string" ? value : String(control.default)}
        onChange={(option) => {
          store.applyEdit({ [id]: option });
        }}
        tooltip={control.tooltip}
      />
    );
  }

  const meta = PARAMS[id];
  const numeric = typeof value === "number" ? value : meta.default;
  return (
    <Knob
      label={control.label}
      spec={{
        min: control.min,
        max: control.max,
        default: typeof control.default === "number" ? control.default : meta.default,
        curve: control.curve,
        integer: control.type === "int",
      }}
      value={numeric}
      format={(v) => formatParamValue(id, v)}
      tooltip={control.tooltip}
      onChange={(v) => store.setParamLive(id, v)}
      onGestureEnd={() => store.commitGesture()}
    />
  );
}

export function AdvancedPanel() {
  return (
    <div className="advanced-panel">
      {MANIFEST.groups.map((group) => (
        <section key={group.name} className="param-group panel">
          <div className="group-title">{group.name}</div>
          <div className="group-controls">
            {group.controls.map((control) => (
              <ManifestControlView key={control.id} control={control} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
