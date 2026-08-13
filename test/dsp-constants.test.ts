/**
 * src/dsp may not import src/generated, so the engine mirrors the schema's
 * enum orders in src/dsp/constants.ts. This test pins the mirror to the
 * generated metadata: if the schema reorders or renames an enum, this fails
 * before the engine can misinterpret an index.
 */

import { describe, it, expect } from "vitest";
import { PARAMS } from "../src/generated/params";
import {
  OSC_WAVEFORM_VALUES,
  FILTER_TYPE_VALUES,
  LFO_WAVEFORM_VALUES,
  LFO_TARGET_VALUES,
  WAVE_SINE,
  WAVE_TRIANGLE,
  WAVE_SAW,
  WAVE_SQUARE,
  FILTER_LOWPASS,
  FILTER_HIGHPASS,
  FILTER_BANDPASS,
  LFO_WAVE_SINE,
  LFO_WAVE_TRIANGLE,
  LFO_WAVE_SAW,
  LFO_WAVE_SQUARE,
  LFO_WAVE_SAMPLE_HOLD,
  LFO_TARGET_NONE,
  LFO_TARGET_CUTOFF,
  LFO_TARGET_PITCH,
  LFO_TARGET_AMP,
  LFO_TARGET_PAN,
  FILTER_SLOPE_VALUES,
  FILTER_SLOPE_12,
  FILTER_SLOPE_24,
  LFO_RETRIGGER_VALUES,
  LFO_RETRIGGER_FREE,
  LFO_RETRIGGER_NOTE,
  DELAY_MAX_SEC,
  MAX_UNISON,
  MAX_VOICES,
} from "../src/dsp/constants";

describe("dsp constants mirror the generated schema metadata", () => {
  it("osc waveform order matches, for both oscillators", () => {
    expect(OSC_WAVEFORM_VALUES).toEqual([...(PARAMS.osc1_waveform.values ?? [])]);
    expect(OSC_WAVEFORM_VALUES).toEqual([...(PARAMS.osc2_waveform.values ?? [])]);
  });

  it("filter type order matches", () => {
    expect(FILTER_TYPE_VALUES).toEqual([...(PARAMS.filter_type.values ?? [])]);
  });

  it("lfo waveform order matches", () => {
    expect(LFO_WAVEFORM_VALUES).toEqual([...(PARAMS.lfo_waveform.values ?? [])]);
  });

  it("lfo target order matches", () => {
    expect(LFO_TARGET_VALUES).toEqual([...(PARAMS.lfo_target.values ?? [])]);
  });

  it("index constants agree with the mirrored arrays", () => {
    expect(WAVE_SINE).toBe(OSC_WAVEFORM_VALUES.indexOf("sine"));
    expect(WAVE_TRIANGLE).toBe(OSC_WAVEFORM_VALUES.indexOf("triangle"));
    expect(WAVE_SAW).toBe(OSC_WAVEFORM_VALUES.indexOf("saw"));
    expect(WAVE_SQUARE).toBe(OSC_WAVEFORM_VALUES.indexOf("square"));
    expect(FILTER_LOWPASS).toBe(FILTER_TYPE_VALUES.indexOf("lowpass"));
    expect(FILTER_HIGHPASS).toBe(FILTER_TYPE_VALUES.indexOf("highpass"));
    expect(FILTER_BANDPASS).toBe(FILTER_TYPE_VALUES.indexOf("bandpass"));
    expect(LFO_WAVE_SINE).toBe(LFO_WAVEFORM_VALUES.indexOf("sine"));
    expect(LFO_WAVE_TRIANGLE).toBe(LFO_WAVEFORM_VALUES.indexOf("triangle"));
    expect(LFO_WAVE_SAW).toBe(LFO_WAVEFORM_VALUES.indexOf("saw"));
    expect(LFO_WAVE_SQUARE).toBe(LFO_WAVEFORM_VALUES.indexOf("square"));
    expect(LFO_WAVE_SAMPLE_HOLD).toBe(LFO_WAVEFORM_VALUES.indexOf("sample_hold"));
    expect(LFO_TARGET_NONE).toBe(LFO_TARGET_VALUES.indexOf("none"));
    expect(LFO_TARGET_CUTOFF).toBe(LFO_TARGET_VALUES.indexOf("cutoff"));
    expect(LFO_TARGET_PITCH).toBe(LFO_TARGET_VALUES.indexOf("pitch"));
    expect(LFO_TARGET_AMP).toBe(LFO_TARGET_VALUES.indexOf("amp"));
    expect(LFO_TARGET_PAN).toBe(LFO_TARGET_VALUES.indexOf("pan"));
  });

  it("filter slope order matches", () => {
    expect(FILTER_SLOPE_VALUES).toEqual([...(PARAMS.filter_slope.values ?? [])]);
    expect(FILTER_SLOPE_12).toBe(FILTER_SLOPE_VALUES.indexOf("12"));
    expect(FILTER_SLOPE_24).toBe(FILTER_SLOPE_VALUES.indexOf("24"));
  });

  it("lfo retrigger order matches", () => {
    expect(LFO_RETRIGGER_VALUES).toEqual([...(PARAMS.lfo_retrigger.values ?? [])]);
    expect(LFO_RETRIGGER_FREE).toBe(LFO_RETRIGGER_VALUES.indexOf("free"));
    expect(LFO_RETRIGGER_NOTE).toBe(LFO_RETRIGGER_VALUES.indexOf("note"));
  });

  it("delay line sizing covers the schema's delay_time range", () => {
    expect(DELAY_MAX_SEC).toBe(PARAMS.delay_time.max);
  });

  it("engine sizing agrees with the schema's unison range", () => {
    expect(MAX_UNISON).toBe(PARAMS.osc1_unison_voices.max);
    expect(MAX_UNISON).toBe(PARAMS.osc2_unison_voices.max);
    expect(MAX_VOICES).toBe(16);
  });
});
