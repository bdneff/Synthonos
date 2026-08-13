/**
 * ADSR unit tests: exponential decay shape, attack that actually reaches
 * 1.0 in the knob time, release to exact zero, and jump-free retriggers and
 * early releases (segments always continue from the current level).
 */

import { describe, it, expect } from "vitest";
import {
  Adsr,
  STAGE_ATTACK,
  STAGE_DECAY,
  STAGE_SUSTAIN,
  STAGE_RELEASE,
  STAGE_IDLE,
} from "../src/dsp/adsr";

const SR = 48000;

function makeEnv(a: number, d: number, s: number, r: number): Adsr {
  const env = new Adsr(SR);
  env.setTimes(a, d, s, r);
  env.noteOn();
  return env;
}

function run(env: Adsr, samples: number): number {
  let level = env.level;
  for (let i = 0; i < samples; i += 1) level = env.tick();
  return level;
}

describe("ADSR attack", () => {
  it("reaches exactly 1.0, in approximately the knob time", () => {
    const attackSec = 0.05;
    const env = makeEnv(attackSec, 0.5, 0.5, 0.2);
    let n = 0;
    while (env.stage === STAGE_ATTACK && n < SR) {
      env.tick();
      n += 1;
    }
    expect(env.level).toBe(1);
    expect(env.stage).toBe(STAGE_DECAY);
    expect(n).toBeGreaterThan(attackSec * SR * 0.6);
    expect(n).toBeLessThan(attackSec * SR * 1.4);
  });

  it("never overshoots 1.0", () => {
    const env = makeEnv(0.001, 0.5, 0.5, 0.2);
    let max = 0;
    for (let i = 0; i < SR / 10; i += 1) max = Math.max(max, env.tick());
    expect(max).toBeLessThanOrEqual(1);
  });
});

describe("ADSR decay", () => {
  it("is exponential: falls fast early, lands near sustain at the knob time", () => {
    const decaySec = 0.5;
    const sustain = 0.2;
    const env = makeEnv(0.001, decaySec, sustain, 0.2);
    // run to end of attack
    while (env.stage === STAGE_ATTACK) env.tick();
    const atHalf = run(env, Math.round((decaySec / 2) * SR));
    // Linear decay would sit at sustain + 0.5 * (1 - sustain) = 0.6 here.
    // Exponential is far below the linear midpoint.
    expect(atHalf).toBeLessThan(sustain + 0.25 * (1 - sustain));
    expect(atHalf).toBeGreaterThan(sustain);
    const atFull = run(env, Math.round((decaySec / 2) * SR));
    expect(Math.abs(atFull - sustain)).toBeLessThan(0.01);
  });

  it("settles onto the sustain level exactly and holds it", () => {
    const env = makeEnv(0.001, 0.05, 0.7, 0.2);
    run(env, SR);
    expect(env.stage).toBe(STAGE_SUSTAIN);
    expect(env.level).toBe(0.7);
    expect(run(env, 1000)).toBe(0.7);
  });
});

describe("ADSR release", () => {
  it("reaches exact zero within 1.5x the knob time, but not immediately", () => {
    const releaseSec = 0.2;
    const env = makeEnv(0.001, 0.5, 0.8, releaseSec);
    run(env, SR / 2);
    env.noteOff();
    expect(env.stage).toBe(STAGE_RELEASE);
    const atHalf = run(env, Math.round(0.5 * releaseSec * SR));
    expect(atHalf).toBeGreaterThan(0); // exponential, not a hard gate
    run(env, Math.round(1.0 * releaseSec * SR));
    expect(env.level).toBe(0);
    expect(env.stage).toBe(STAGE_IDLE);
  });

  it("releases from mid-attack without a jump", () => {
    const env = makeEnv(1.0, 0.5, 0.8, 0.2);
    run(env, Math.round(0.3 * SR)); // partway up a slow attack
    const before = env.level;
    expect(before).toBeGreaterThan(0.05);
    env.noteOff();
    let prev = before;
    let worstStep = 0;
    for (let i = 0; i < 1000; i += 1) {
      const v = env.tick();
      worstStep = Math.max(worstStep, Math.abs(v - prev));
      prev = v;
    }
    expect(worstStep).toBeLessThan(0.01);
  });
});

describe("ADSR retrigger", () => {
  it("restarts the attack from the current level without a jump", () => {
    const env = makeEnv(0.02, 0.5, 0.8, 0.3);
    run(env, SR / 2);
    env.noteOff();
    run(env, Math.round(0.1 * SR)); // partway down the release
    const before = env.level;
    expect(before).toBeGreaterThan(0.01);
    expect(before).toBeLessThan(0.8);
    env.noteOn();
    let prev = before;
    let worstStep = 0;
    let level = before;
    for (let i = 0; i < 5000; i += 1) {
      level = env.tick();
      worstStep = Math.max(worstStep, Math.abs(level - prev));
      prev = level;
    }
    expect(worstStep).toBeLessThan(0.01);
    expect(level).toBeGreaterThan(before); // it went up, not down
  });
});
