/**
 * Segmented selector for enum parameters (waveforms, filter type, LFO
 * target). One click is one committed gesture. Option names come from the
 * schema; underscores are shown as spaces.
 */

import { humanizeOption } from "./param-utils";

export interface EnumSelectorProps {
  label: string;
  values: readonly string[];
  value: string;
  onChange(value: string): void;
  tooltip?: string;
}

export function EnumSelector({
  label,
  values,
  value,
  onChange,
  tooltip,
}: EnumSelectorProps) {
  return (
    <div
      className={`enum-selector${tooltip ? " has-tooltip" : ""}`}
      data-tooltip={tooltip}
    >
      <div className="enum-label">{label}</div>
      <div className="enum-options" role="radiogroup" aria-label={label}>
        {values.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            className={`enum-option${option === value ? " selected" : ""}`}
            onClick={() => {
              if (option !== value) onChange(option);
            }}
          >
            {humanizeOption(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
