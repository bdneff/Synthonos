---
name: Synthonos
description: Natural-language virtual analog synth in DJ deck grammar, where color is information
colors:
  deck-page: "#101215"
  deck-panel: "#16181d"
  deck-raised: "#1c1f25"
  deck-control: "#23272e"
  deck-hover: "#2b3038"
  screen: "#0a0c0f"
  well: "#0d0f13"
  seam: "#272b32"
  seam-strong: "#343a44"
  text: "#e9ecef"
  text-dim: "#a3abb5"
  text-faint: "#838d99"
  band-low: "#ff5c6e"
  band-mid: "#57d074"
  band-high: "#4fa8ff"
  cue-brightness: "#ffd24d"
  cue-thickness: "#ff8b47"
  cue-movement: "#57d074"
  cue-attack: "#3fd0d8"
  cue-space: "#5ba8ff"
  cue-grit: "#ff5566"
  cue-width: "#8f8aff"
  cue-character: "#e668b8"
  action-green: "#57d074"
  action-ink: "#0c1710"
  focus-blue: "#7ab8ff"
  danger: "#ff5c6e"
  neutral-chip: "#8b94a0"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "0.22em"
  headline:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.18em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.16em"
  data:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "10.5px"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "5px"
  lg: "6px"
  xl: "8px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
components:
  button-secondary:
    backgroundColor: "{colors.deck-control}"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.md}"
    padding: "5px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.deck-hover}"
    textColor: "{colors.text}"
  button-primary:
    backgroundColor: "{colors.action-green}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.md}"
    padding: "5px 12px"
  input-inset:
    backgroundColor: "{colors.well}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "6px 9px"
---

# Design System: Synthonos

## Overview

**Creative North Star: "The Performance Deck"**

Synthonos wears the visual grammar of DJ performance software — Serato,
Traktor, Rekordbox — the screens working musicians trust in a dark booth.
The interface is built from layered slate decks separated by 1px seams on a
darker ground: no cards floating on shadows, no skeuomorphic hardware, no
engraving. Depth comes from tonal layering (page → panel → raised → control),
and the two real screens (the display strip and the crate well) sit *darker*
than the chassis, the way a powered display reads darker than the plastic
around it.

The system's one governing idea: **color is information, never decoration.**
Three laws implement it. Law 1 — frequency is color: low red, mid green,
high blue; the spectrum trace carries it because its x-axis genuinely is
frequency, and the brand mark and describe signature quote it. Law 2 — every
macro owns a hot-cue hue that lives in its knob arc, name strip, and glow.
Law 3 — engine sections in the advanced rack carry function color at group
level, so a beginner can say "the green knobs moved."

**Key Characteristics:**
- Layered slate decks, seamed, flat; tonal depth, not shadow depth
- Every hue on screen carries a meaning (band, macro, section, action)
- Real instrumentation: dB/Hz/ms-DIV scales printed on working canvas displays
- Condensed uppercase rails for structure, mono for data, Barlow for speech
- The machine's own actions glow: an AI-turned knob burns its hue

## Colors

A dark multi-hue functional palette: neutral slate carries the chassis while
eight cue hues, three band colors, and one action green do the talking.

### Primary
- **Band Low / Red** (#ff5c6e): bass region of the spectrum, Oscillator B's
  deck identity, Basses category, danger and delete.
- **Band Mid / Green** (#57d074): mid region, Movement macro, LFO group,
  Keys and Bells category, and the commit-action green of Save and Match.
- **Band High / Blue** (#4fa8ff): high region, Oscillator A's deck identity,
  Leads category, and the played-key highlight on the piano.

### Secondary
- **The eight cue hues** (Brightness #ffd24d, Thickness #ff8b47, Movement
  #57d074, Attack #3fd0d8, Space #5ba8ff, Grit #ff5566, Width #8f8aff,
  Character #e668b8): one per macro, applied to the knob arc, the name
  strip, and the machine-glow. Also reused as rack group colors (Filter
  takes Brightness's yellow, envelopes take Attack's cyan, FX take Width's
  violet) and library category chips, so the same hue means the same idea
  everywhere it appears.

### Neutral
- **Deck Page** (#101215): the ground everything sits on.
- **Deck Panel** (#16181d): every zone's chassis panel.
- **Deck Raised** (#1c1f25) and **Deck Control** (#23272e): rows, toggles,
  buttons; **Deck Hover** (#2b3038) one step lighter on hover.
- **Screen** (#0a0c0f) and **Well** (#0d0f13): the display strip, describe
  slot, crate list, and inputs — recessed, darker than the chassis.
- **Seam** (#272b32) / **Seam Strong** (#343a44): the 1px lines that build
  every boundary; there are no other borders.
- **Text** (#e9ecef), **Text Dim** (#a3abb5), **Text Faint** (#838d99):
  three ink levels; faint is fine print only and stays ≥4.5:1 on its panel.

### Named Rules
**The Meaning Rule.** No hue appears without a meaning. Before using a
color, name what it encodes (band, macro, section, category, action,
focus); if there is no answer, use a slate neutral.
**The Spectrum Signature Rule.** The full tri-band gradient (red → orange →
yellow → green → cyan → blue) appears only where the whole spectrum is at
stake: the brand bars, the describe lane's hairline, and the Shape button.
It is the product's signature and is never used as generic decoration.

## Typography

**Display Font:** Barlow Condensed (with Barlow, system-ui fallback)
**Body Font:** Barlow (system-ui fallback)
**Label/Mono Font:** Spline Sans Mono (ui-monospace fallback), variable 400–600

**Character:** An industrial DIN-flavored grotesk family for everything the
user reads, condensed and letterspaced for machine rails, with a precise
narrow mono for everything the machine measures. No serifs anywhere.

### Hierarchy
- **Display** (600, 17px, 0.22em tracking, uppercase): the wordmark only.
- **Headline / rail titles** (600, 10–11px, 0.15–0.18em, uppercase,
  condensed): section rails (LIBRARY, PERFORMANCE, KEYS), always with their
  function chip and a seam line running to the panel edge.
- **Body** (400–500, 12.5–13px): preset names, hints, tooltips, responses.
- **Label** (600, 9–10px, 0.14–0.16em, uppercase, condensed): micro-labels
  like SOUND, OCT, WAVEFORM.
- **Data** (mono 400–500, 8–10.5px): every number, scale, readout, key
  letter, command, and the model plate. Numbers are never set in Barlow.

### Named Rules
**The Speech/Measurement Rule.** Words the product says to the user are set
in Barlow; values the machine measures are set in Spline Sans Mono. Never
mix within one string.

## Layout

Fixed-viewport instrument layout: the app fills 100vh (min-width 1140px),
`overflow: hidden`, five stacked zones with 8px gutters and 10px outer
padding — top rail (58px), display strip (148px), body (flexible: 238px
crate column + performance panel), keys deck. The whole instrument fits
1280×800 with the rack closed; opening the rack compresses the macro zone
and scrolls internally, never the page. Section rails, not boxes, divide
content inside a panel. Spacing rhythm is 6/8/10/14px, tight within groups,
with panel padding 9–14px.

## Elevation & Depth

Tonal layering, not shadows: surfaces at rest are flat, and depth reads
from the five-step slate ramp plus recessed screen/well surfaces. Shadows
exist only on true overlays — the describe response, settings popover, and
tooltips — always with a real offset and soft blur
(`0 10px 28px rgba(0,0,0,0.55)` family). The only glow in the system is the
machine-glow `drop-shadow` on a knob arc while the AI turns it: it is a
state signal, not decoration.

### Named Rules
**The Overlay-Only Shadow Rule.** If it doesn't float over the deck, it
doesn't cast a shadow.

## Shapes

Rectangles with quiet radii: 8px panels, 5–6px controls and inputs, 3–4px
chips and list rows. Function chips are 7–8px rounded squares (2px radius),
the hot-cue shape. Every boundary is a 1px seam line; there are no 2px+
borders and no colored side-stripes. Knobs are the one circular family:
flat slate cap, 1px rim, bright pointer, 5.5-unit hue arc, tick ring.

## Components

### Buttons
- **Shape:** small radius (5px), 1px seam-strong border
- **Secondary (default):** deck-control ground, dim text; hover raises one
  slate step and brightens text (#2b3038 / #e9ecef)
- **Primary / commit (Save, Match):** action green fill (#57d074) with
  near-black green ink (#0c1710); Save wears secondary clothes while the
  name field is empty and earns green only when there is something to commit
- **Shape (describe submit):** the tri-band spectrum gradient with #101215
  text — unique to the describe action, never reused
- **Disabled:** 40–45% opacity, no color change

### Chips
- **Function chips:** 7–8px rounded squares filled with the section's hue,
  leading every rail title and group header; neutral slate (#8b94a0) when
  the section has no function color.

### Cards / Containers
- **Corner Style:** 8px panels, 6px inner wells
- **Background:** deck-panel chassis; screen/well when recessed
- **Shadow Strategy:** none at rest (see Elevation)
- **Border:** 1px seam everywhere

### Inputs / Fields
- **Style:** recessed well ground (#0d0f13), 1px seam, 5–6px radius, Barlow
  13px (mono for key/model fields); placeholder text-faint
- **Focus:** the describe lane grows its tri-band hairline on focus-within;
  standard fields shift to seam-strong; global focus-visible ring is 2px
  #7ab8ff offset 2px
- **Caret:** band-high blue; selection rgba(79,168,255,0.4)

### Navigation
Zone rails are the navigation: condensed uppercase titles with function
chips and seam lines. The advanced rack toggle is a full-width raised rail
carrying a drawn chevron (rotates 90° when open), the ADVANCED word, the
mono signal-path legend (OSC A/B ▸ MIXER ▸ FILTER ▸ AMP ▸ FX ▸ OUT), and a
plain-words hint pinned right.

### The Knob (signature component)
One SVG family in three mounted sizes (106 / 82 / 58px): tick ring, min and
max dots, 0–10 numerals on large caps, slate cap with bright pointer, and
the value arc in the control's `--knob-hue`. Macro stations set the hue per
macro; rack groups set it per engine section; unhued knobs fall back to
neutral slate. While a programmatic change tweens the knob, `.knob-glowing`
lifts the arc to full opacity with a hue drop-shadow and colors the value
readout: the machine visibly at work. Idle arcs sit at 0.72 opacity.

### The Display Strip (signature component)
Two live canvas instruments on one recessed screen: the spectrum (tri-band
trace and fill over a real dB/Hz grid, REF fine print top right) and the
white-phosphor waveform (graticule, +1/0/−1 scale, 5 ms/DIV fine print).
Scales are printed in Spline Sans Mono at 7.5–8.5px in slate silk
(rgba(214,222,232,0.5)). Idle states breathe slowly rather than going dead.

## Do's and Don'ts

### Do:
- **Do** give every new color a stated meaning before using it (The Meaning
  Rule), and reuse an existing hue when the meaning already exists.
- **Do** build boundaries from 1px seams and tonal steps; recess anything
  that displays or receives content one step darker than its chassis.
- **Do** set every numeral, scale, and readout in Spline Sans Mono, and
  every rail title in condensed tracked uppercase with its function chip.
- **Do** keep the machine-glow: any programmatic parameter change must
  light its control's hue while it moves (300ms tween + 400ms linger).
- **Do** write copy in plain musician words ("open the full rack", "a
  starting point, not a copy"), never engineering abbreviations.

### Don't:
- **Don't** introduce a single global accent color; this system's identity
  is many hues, each owned by a function. Mono-accent minimalism is a
  rejected direction for this product.
- **Don't** use cream grounds, serifs, or warm-enamel hardware skeuomorphism
  (engraved rules, ivory caps, VU amber) — all rejected prior worlds.
- **Don't** use the tri-band gradient outside the brand mark, describe
  hairline, and Shape button (The Spectrum Signature Rule).
- **Don't** add shadows to resting surfaces, colored side-stripes, glyph
  icons, or imitation materials (bevels, brushed metal, glass blur).
- **Don't** color the waveform display by frequency: time is not frequency;
  it stays white phosphor.
