---
name: Synthonos
description: Natural-language virtual analog synth wearing a 1982 flagship's front panel, where the machine speaks in light
colors:
  deck-page: "#09090a"
  deck-1: "#131315"
  deck-2: "#19191c"
  deck-3: "#202023"
  deck-4: "#2a2a2e"
  screen: "#050506"
  well: "#0b0b0d"
  seam: "#000000"
  seam-strong: "#2e2e33"
  text: "#eae8e1"
  text-dim: "#a9a79f"
  text-faint: "#83817a"
  frame: "rgba(234, 232, 225, 0.26)"
  frame-faint: "rgba(234, 232, 225, 0.13)"
  edge-light: "rgba(255, 255, 255, 0.05)"
  m-grit: "#ef4a3e"
  m-thickness: "#f58a30"
  m-brightness: "#f5c343"
  m-movement: "#55c26a"
  m-attack: "#3dbdbf"
  m-space: "#4f95e8"
  m-width: "#8d7ef0"
  m-character: "#d963b4"
  led: "#ff3b2e"
  led-glow: "rgba(255, 59, 46, 0.65)"
  led-ghost: "rgba(255, 59, 46, 0.14)"
  amber: "#ffb03a"
  amber-hover: "#ffc05e"
  amber-ink: "#241703"
  amber-glow: "rgba(255, 176, 58, 0.32)"
  danger: "#ef4a3e"
  danger-ink: "#1c0605"
  neutral-chip: "#8f8d85"
  ink-on-color: "#0b0b0c"
  speech-bright: "#f4f2ea"
  switch-hi: "#242428"
  switch-lo: "#1d1d20"
  switch-hover-hi: "#2b2b30"
  switch-hover-lo: "#232327"
  toggle-hi: "#202024"
  toggle-lo: "#1a1a1d"
  toggle-hover-hi: "#26262b"
  hover-edge: "#3a3a40"
  knob-cap: "#1c1c1f"
  knob-cap-face: "#151517"
  knob-track: "#232327"
  knob-pointer: "#f0eee7"
  dial-print: "rgba(234, 232, 225, 0.42)"
  dial-print-faint: "rgba(234, 232, 225, 0.22)"
  scope-silk: "rgba(234, 232, 225, 0.5)"
  scope-phosphor: "rgba(172, 248, 186, 0.98)"
  ivory: "#e9e6dd"
  ivory-pressed: "#d4d1c6"
  key-black-hi: "#232326"
  key-black-lo: "#121214"
typography:
  brand:
    fontFamily: "Michroma, Barlow Condensed, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.18em"
  silk-title:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.18em"
  silk-label:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.16em"
  silk-fine:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 500
    letterSpacing: "0.16em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  sentence:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  data:
    fontFamily: "Spline Sans Mono, ui-monospace, Cascadia Mono, monospace"
    fontSize: "10.5px"
    fontWeight: 500
  led14:
    fontFamily: "DSEG14 Classic, Spline Sans Mono, monospace"
    fontSize: "12px"
    fontWeight: 400
    letterSpacing: "0.08em"
  led7:
    fontFamily: "DSEG7 Classic, Spline Sans Mono, monospace"
    fontSize: "12px"
    fontWeight: 400
rounded:
  sm: "2px"
  md: "3px"
  knurl: "4px"
  pill: "8px"
  round: "50%"
spacing:
  xs: "3px"
  sm: "6px"
  gap: "7px"
  md: "9px"
  lg: "12px"
  xl: "14px"
components:
  button-switch:
    backgroundColor: "{colors.switch-hi}"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.sm}"
    padding: "5px 12px"
  button-switch-hover:
    backgroundColor: "{colors.switch-hover-hi}"
    textColor: "{colors.text}"
  button-commit:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.sm}"
    padding: "5px 12px"
  button-commit-hover:
    backgroundColor: "{colors.amber-hover}"
    textColor: "{colors.amber-ink}"
  button-shape:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.sm}"
    padding: "7px 15px"
  patch-cap:
    backgroundColor: "{colors.switch-hi}"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  patch-cap-current:
    backgroundColor: "{colors.deck-4}"
    textColor: "{colors.text}"
  bank-cat:
    backgroundColor: "{colors.switch-hi}"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.sm}"
    padding: "3px 9px"
  bank-cat-selected:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
  enum-option-selected:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    rounded: "1px"
    padding: "3px 8px"
  input-well:
    backgroundColor: "{colors.well}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "6px 9px"
  led-display:
    backgroundColor: "{colors.screen}"
    textColor: "{colors.led}"
    typography: "{typography.led14}"
    rounded: "{rounded.sm}"
    padding: "8px 12px 6px"
  macro-name-plate:
    backgroundColor: "{colors.neutral-chip}"
    textColor: "{colors.ink-on-color}"
    padding: "2px 9px 1px"
  tooltip:
    backgroundColor: "{colors.deck-4}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
---

# Design System: Synthonos

## Overview

**Creative North Star: "The Jupiter Panel"**

Synthonos wears the front panel of a 1982 polyphonic flagship, in the
Roland Jupiter-8's own grammar (direction seed 10f477f8; the composition
is The Symmetric Console, surface seed be120ee0). One matte black
painted-steel face carries everything: white silkscreen legends and 1px
frame rules explain the machine the way hardware explains itself,
tactile switch caps travel when pressed, and red LED segment displays
say what the machine is holding. The world refuses the category default
that renders "80s retro" as a synthwave neon grid, and equally refuses
the dark-plugin-with-one-glowing-accent shell.

Three material laws govern the surface. Law 1, steel mounting: every
panel is mounted on painted steel, and depth is machined, not floated; a
1px black panel gap and a hairline top highlight, never a drop shadow at
rest. Law 2, the machine speaks in light: LED displays carry what the
machine is saying, an armed switch is backlit amber, and a knob the
machine turns burns its ink while it moves. Light always means "the
machine is working here". Law 3, indexed ink: the eight macro inks are
the whole palette, laid out once in the rainbow pinstripe band over the
keybed; every colored block, arc, chip, and category mark on the panel
is one of those eight inks doing a job.

The story the surface tells: a beginner types a sentence and the
flagship obeys. LEDs light where the machine is working, the rainbow
band runs a light chase while it shapes, and the band itself teaches
which color belongs to which macro.

**Key Characteristics:**
- One continuous painted-steel face; regions drawn by silkscreen frames
  and rules, never cards
- Eight indexed inks, laid out once in the rainbow band, reused for
  every colored mark on the panel
- Two lights with fixed meanings: red LED for what the machine says,
  amber backlight for what is armed or selected
- Silkscreen realness: printed dial rings, dB/Hz/ms-DIV scales,
  calibration fine print, a model plate
- Switch caps that travel 1px and seat when pressed; LED displays with
  ghost segments and a marquee
- A power-on sequence: panels seat, the rainbow wipes in, the LED
  displays flicker alive

## Colors

A near-black steel ramp carries the chassis; eight indexed macro inks,
one red LED light, and one amber backlight do all the talking.

### Primary
- **The eight macro inks**, in rainbow-band order, red to magenta: Grit
  red (#ef4a3e), Thickness orange (#f58a30), Brightness yellow
  (#f5c343), Movement green (#55c26a), Attack teal (#3dbdbf), Space
  blue (#4f95e8), Width violet (#8d7ef0), Character magenta (#d963b4).
  Each ink lives in its macro's knob arc, its silkscreened name plate,
  and its pinstripe in the rainbow band. The same inks are reused as
  rack group colors (Oscillator A takes Space blue, Oscillator B takes
  Grit red, Filter takes Brightness yellow, envelopes take Attack teal,
  LFO takes Movement green, Pitch takes Character magenta, FX take
  Width violet) and as patch-bank category marks (Pads violet, Basses
  orange, Leads blue, Plucks teal, Keys and Bells green, Motion and FX
  magenta, Your sounds yellow). Grit red doubles as the danger ink for
  the two-step delete. The spectrum trace borrows three of them as the
  frequency trio: low red, mid green, high blue, blended at 250 Hz and
  4 kHz.

### Secondary
- **LED red** (#ff3b2e): the machine's voice. The patch window and
  octave readout in DSEG segments, the lit dot on the loaded patch cap,
  the blinking dot on the Shape switch while the machine thinks, and
  the light bar on a held piano key. Always glows
  (`rgba(255, 59, 46, 0.65)`); unlit segments stay visible as ghosts
  (`rgba(255, 59, 46, 0.14)`).
- **Backlight amber** (#ffb03a, hover #ffc05e, ink #241703): the armed
  state. Commit switches (Shape, Save, Match), the selected category,
  the selected enum position. Also the interface's focus ring, caret,
  and text selection (`rgba(255, 176, 58, 0.35)`). Amber is earned:
  Save sits unlit until a name is typed.

### Neutral
- **Deck Page** (#09090a): the window ground behind the panels, painted
  before the bundle loads so the window never flashes light.
- **Steel ramp** (#131315 panel, #19191c popover, #202023, #2a2a2e
  pressed cap and tooltip plate): the painted-steel surfaces. Custom
  property names (--deck-1..4) are historical; the values are truth.
- **Screen** (#050506) and **Well** (#0b0b0d): display glass and
  recessed input slots, always with an inset dark shadow.
- **Seam** (#000000): the 1px black panel gap around every mounted
  part. **Seam strong** (#2e2e33) only for emphasized top edges of
  overlays and focused input borders.
- **Silkscreen inks** (warm white): text #eae8e1, dim #a9a79f, faint
  #83817a for fine print; frame rules at `rgba(234, 232, 225, 0.26)`
  and 0.13; ink printed on a colored block is near-black #0b0b0c.
- **Neutral chip** (#8f8d85): the ink for sections that own no
  function color (Mixer, Master, unhued knobs).

### Named Rules
**The Indexed Ink Rule.** The eight macro inks are the entire chromatic
palette. Before coloring anything, name which ink it is and what job
that ink is doing (macro, rack group, category, band); if there is no
answer, use steel or silkscreen. New hues do not exist.
**The Two Lights Rule.** Red LED means the machine is speaking or
holding something (displays, lit dots, held keys). Amber means armed,
selected, or ready to commit. Neither is ever decoration, and no other
color glows.
**The Rainbow Signature Rule.** The full eight-ink sweep appears in
exactly three places: the pinstripe band over the keybed (the
flagship's own placement), the small stripe quote under the wordmark,
and the hairline under the describe sentence. Never anywhere else.

## Typography

**Brand Font:** Michroma (with Barlow Condensed fallback)
**Silkscreen Font:** Barlow Condensed (500/600)
**Speech Font:** Barlow (400 to 700)
**Data Font:** Spline Sans Mono (variable 400 to 600)
**LED Fonts:** DSEG14 Classic and DSEG7 Classic

All bundled as woff2, all OFL. **Character:** an extended-tech wordmark
over disciplined condensed silkscreen caps, a plain humanist grotesk
for everything the product says, a narrow mono for everything it
measures, and real segment faces for everything it displays. No serifs
anywhere on the panel.

### Hierarchy
- **Brand** (Michroma 400, 17px, 0.18em, uppercase): the SYNTHONOS
  wordmark only, over its stripe quote and the 8.5px/0.3em "say it,
  hear it" sub-line.
- **Silk title** (condensed 600, 11px, 0.18em, uppercase): section
  legends (Performance, Patch Bank, Keys, Advanced, Match a sound),
  printed on the frame rule they interrupt.
- **Silk label / fine print** (condensed 500-600, 8-10px, 0.1-0.3em,
  uppercase): micro-legends (Sound, Oct, Z, X), the model plate
  (Polyphonic Synthesizer · SYN-01), the panel spec line, sound counts.
  Faint ink.
- **Speech** (Barlow 400-600, 11-13px): buttons, patch names, hints,
  tooltips, responses. The describe sentence is the amendment: Barlow
  400 at 15px in bright warm white (#f4f2ea), scale and warmth
  instead of an italic serif, because 1982 hardware never mixed a
  serif into its silkscreen. This is ratified; do not reintroduce the
  serif.
- **Data** (mono 500, 8-10.5px): knob readouts, the signal-path legend,
  scope scales and calibration prints, key letters, C labels, settings
  keys. Numbers are never set in Barlow.
- **LED** (DSEG14 12px for the patch window, DSEG7 12px for the octave
  window): everything the machine holds up in light, uppercase, red,
  glowing, with ghost segments behind.

### Named Rules
**The Silkscreen/Speech/Segment Rule.** Legends printed on the panel
are condensed tracked uppercase; words the product says are Barlow
sentence case; values the machine measures are Spline Sans Mono; values
the machine displays are DSEG in LED red. Never mix within one string.

## Layout

A fixed-viewport instrument: the app fills 100vh (min-width 1140px),
`overflow: hidden`, five mounted panels stacked with 7px gaps inside
9px outer padding. Top rail (58px): wordmark plate, describe lane,
history switches, settings, model plate, separated by hairline
dividers. Then the symmetric console (flexible height): two mirrored
2x2 macro banks, Bank A left (Brightness, Space, Grit, Width) and Bank
B right (Thickness, Movement, Attack, Character), flanking a 470px
center instrument cluster of spectrum glass over waveform glass, the
patch LED window, and the spec print. Then the advanced rack rail, the
patch bank, and the keys deck under the full-width rainbow band. The
whole face fits 1280x800 with the rack closed, no page scroll. Opening
the rack compresses the console (macro caps drop to their 74px
mounting, dial numerals and readouts lift off, the spec print
disappears) and the rack scrolls internally, never the page. Spacing
rhythm is 3/6/7/9/12/14px, tight within a frame; panel padding runs
7-14px.

## Elevation & Depth

No floating at rest, ever. Depth is machined: every mounted panel gets
the same construction, a 1px black seam all round plus one hairline
top highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.05)`, the
`--machined` token). Switch caps add a vertical two-stop gradient, an
inset top light, and a 1px dark ledge below
(`0 1px 0 rgba(0, 0, 0, 0.7)`); pressing travels the cap 1px down and
swaps the ledge for a seated inset (`inset 0 1px 3px rgba(0,0,0,0.5)`).
Glass and wells recess with inset dark blur (display glass
`inset 0 3px 14px rgba(0, 0, 0, 0.75)` plus a radial vignette; input
slots `inset 0 2px 5px rgba(0, 0, 0, 0.55)`; LED windows deeper still).
Real drop shadows exist only on true overlays: the describe response
(`0 10px 28px rgba(0, 0, 0, 0.65)`), the settings popover
(`0 12px 32px`), the match drawer (`0 14px 34px`), and tooltips
(`0 8px 20px rgba(0, 0, 0, 0.55)`). The only glows are the two lights
and the machine-glow: a knob the machine is turning lifts its arc to
full opacity with a 5px drop-shadow in its own ink for the 300ms tween
plus a 400ms linger.

### Named Rules
**The Machined Edge Rule.** If it is mounted on the panel, it gets the
seam-and-hairline construction and no shadow. If it floats over the
panel, it gets a real offset shadow. There is no third state.
**The Light-Means-Work Rule.** Glow is a state signal, never a
material: LED glow, amber backlight glow, and the machine-glow on a
moving knob arc are the only luminous things on the face.

## Shapes

Machined rectangles with near-sharp corners: 3px on panels, 2px on
caps, chips, inputs, and windows; nothing softer except the scrollbar
thumb (4px), the armed delete pill (8px), and true circles (knob caps,
LED dots, the delete button). Category ink marks are sharp 7px squares
with no radius at all: paint chips, not pills. Frames are 1px
silkscreen rules; section titles physically interrupt their frame,
sitting on a patch of panel paint over the rule line, the way hardware
prints legends across engraved borders. Rack group titles go further:
the title block itself is a plate of the group's ink with near-black
text. The knob is the one circular family: a turned black cap (r26 in
a 100 viewBox) with a machined rim and inner face, a full-radius bright
pointer line, a printed tick ring (7 ticks small, 11 large) with min
and max dots and 0/10 numerals on large caps, and a 270-degree value
arc in the control's ink. The rainbow band is eight 2px pinstripes
separated by 1px of steel, 23px tall, full width.

## Components

### Switch Caps (buttons)
- **Character:** every button is a tactile cap on the steel.
- **Shape:** 2px radius, 1px black seam, vertical gradient (#242428 to
  #1d1d20), inset top light plus 1px dark ledge.
- **Hover:** gradient lightens one step (#2b2b30 to #232327), text
  brightens dim to full.
- **Active:** cap travels down 1px and seats (inset shadow, no ledge).
- **Commit (primary):** backlit amber (#ffb03a) with near-black amber
  ink (#241703) and an amber glow; hover #ffc05e. Save wears unlit
  switch clothes until the name field has text (the backlight is
  earned). The Shape switch adds a 6px red LED dot: lit when armed,
  blinking (0.5s steps) while the machine thinks.
- **Disabled:** 40-45% opacity, no color change.
- **Octave caps:** the same construction at 26x24px with silkscreened
  Z/X legends below.

### LED Displays
- **Patch window** (DSEG14, 12px, uppercase, LED red on #050506 glass,
  deep inset): a row of ghost tilde segments renders behind the
  message so the display reads as a real device; names longer than 18
  characters marquee across the glass (6s linear, 1.2s delay,
  infinite). **Octave window** (DSEG7) is a smaller red window of its
  own. Both flicker alive on power-on (the led-boot keyframes).

### Chips
- **Category ink** (`.cat-ink`): a sharp 7px square of the category's
  macro ink, leading every category switch; neutral #8f8d85 when no
  ink applies.
- **Macro name plate:** each macro's name silkscreened as near-black
  condensed caps on a block of its own ink.

### Cards / Containers
- There are no cards. Every region is either a mounted panel (steel,
  seam, machined hairline), a recessed glass or well, or a silkscreen
  frame (`1px solid rgba(234, 232, 225, 0.13-0.26)`) whose title
  interrupts the rule. Overlays (describe response, settings popover,
  match drawer) use the steel-2 surface with a seam-strong top edge
  and a real shadow.

### Inputs / Fields
- **Style:** recessed well (#0b0b0d), 1px black seam, 2px radius,
  inset shadow, Barlow 12.5px; placeholder in faint ink; settings key
  and model fields set in mono.
- **Focus:** border shifts to seam-strong; the global focus ring is
  2px amber, offset 2px. Caret amber; selection amber at 35%;
  Chromium autofill is repainted back to the dark well.
- **Enum selector:** a recessed well housing 2px-padded options; the
  chosen position is backlit amber, exactly like every selector on
  the panel.

### Navigation
- Silkscreen rules are the navigation: condensed uppercase titles
  breaking their frame line, with fine print pinned right. The
  advanced rack toggle is a full-width switch rail carrying a drawn
  chevron (rotates 90 degrees open), the ADVANCED legend, the mono
  signal-path print (OSCILLATORS ▸ MIXER ▸ FILTER ▸ LOUDNESS ▸
  EFFECTS ▸ OUT), and a plain-words hint pinned right.

### The Knob (signature component)
One SVG family in staged mountings: 124px macro caps (74px with the
rack open), 58px rack knobs (a 98px medium mounting is defined but
currently unmounted). Printed dial ring, min and max dots, 0 and 10
numerals on large caps, turned black cap with machined rim, bright
full-radius pointer, and the value arc (4.5 stroke, 0.85 opacity) in
the control's `--knob-hue`; macro stations set the hue per macro, rack
groups per engine section, unhued knobs fall back to the neutral chip.
Bipolar parameters fill from 12 o'clock. Programmatic changes tween
the pointer over 300ms; while the machine turns the knob,
`.knob-glowing` lifts the arc to full opacity with a 5px ink
drop-shadow and colors the readout: the describe interaction made
visible (Law 2). Macro arcs carry a constant faint 1.5px ink glow.
Drag vertically (Shift for fine), double-click to reset, arrows and
Home/End from the keyboard.

### The Patch Bank (signature component)
Presets as named switch caps in a strip, the way an 80s receiver
carried station presets. The rail holds the Patch Bank legend, seven
category switches each wearing its ink square (selected one backlit
amber), the fine-print sound count, and the Match toggle. Init is
always the first cap; the loaded cap sits seated with its 5px LED lit.
The caps lane scrolls on its own; the save station (well input plus
earned-amber Save) stays mounted right. Deleting a user sound is a
two-step press on the cap itself: a round dot appears on hover, first
press arms it into a danger-ink pill reading "Sure?", it disarms after
3 seconds. Match rides above the bank as a 360px drawer with a real
shadow.

### The Instrument Cluster (signature component)
One glass window (#050506, machined edge, deep inset, radial
vignette), split by a hairline: the spectrum on top, the waveform
below. The spectrum trace carries the frequency trio (Grit red through
Movement green to Space blue, blended at 250 Hz and 4 kHz) over a real
grid with dB marks down the left (0 to -36 in a 48 dB window), Hz
decades along the bottom, and calibration fine print (REF 0 dBFS ·
LOG) in the corner, all silkscreened in mono at 7.5-8.5px. The
waveform is a green phosphor trace (halo passes under a crisp
`rgba(172, 248, 186, 0.98)` line) on a graticule with +1/0/-1 marks
and its own fine print (5 ms/DIV · AC); time is not frequency, so the
scope earns no band color. Idle displays breathe slowly instead of
going dead.

### The Rainbow Band (signature component)
The signature at full width: eight 2px pinstripes, one per macro ink,
red to magenta, separated by 1px steel, 23px tall, mounted over the
keybed exactly where the flagship wore its own. While the machine
shapes a sound (`data-shaping` on the root) a white light chase sweeps
the band (1.1s linear, infinite). The same stripes are quoted small
(8px) under the wordmark, and the describe lane's 2px hairline is the
third and last appearance: it grows in from the left on focus and
sweeps while the machine thinks.

### The Describe Lane
The front door: a recessed glass slot in the top rail holding a
words-to-waveform glyph, the sentence input (Barlow 15px, #f4f2ea),
and the Shape switch. The machine's reply overlays below on steel-2
with a real shadow, never shifting the layout.

### Tooltips
Plain words on hover, everywhere: a steel-4 plate (2px radius, #3a3a40
edge, real shadow), Barlow 11.5px sentence case, max 230px, appearing
after a 0.4s delay. Knob tooltips center under the cap; the rightmost
bank flips them inward; scope tooltips pin inside the glass. Tooltip
text always resets letterspacing, case, and text-shadow: speech, not
silkscreen.

### The Power-On Sequence
The face boots like hardware: the five panels seat upward in sequence
(0.45s each, staggered 0 to 0.26s), the brand stripes and rainbow band
wipe in from the left, the LED windows flicker alive, and the knob
arcs fade up last. `prefers-reduced-motion` collapses every animation
and transition to effectively zero.

## Do's and Don'ts

### Do:
- **Do** build every mounted element from the one construction: steel
  gradient or flat steel, 1px black seam, machined hairline; recess
  anything that displays or receives content into screen or well glass
  with an inset shadow.
- **Do** index every color: each colored mark is one of the eight
  macro inks doing a named job, or one of the two lights doing its
  fixed job (red = the machine speaking, amber = armed or selected).
- **Do** set legends in condensed tracked uppercase, speech in Barlow,
  measurements in Spline Sans Mono, and machine-held values in DSEG
  with ghost segments behind them.
- **Do** keep the machine-glow: any programmatic parameter change
  tweens its knob over 300ms and burns the arc's ink (plus 400ms
  linger) while it moves.
- **Do** make backlight earned: a commit switch stays unlit until
  there is something to commit.
- **Do** write UI copy in plain musician words ("open the full rack",
  "a starting point, not a copy"), never engineering abbreviations.
- **Do** honor the power-on sequence for new panels (seat, wipe,
  flicker) and collapse everything under `prefers-reduced-motion`.

### Don't:
- **Don't** add drop shadows to resting surfaces, cards, or any
  rounded-corner radius above 3px on mounted parts (scrollbar, armed
  pill, and true circles are the only exceptions).
- **Don't** invent hues outside the eight inks and two lights, and
  don't let any ink glow decoratively; glow is reserved for the
  machine's own light and work.
- **Don't** use the rainbow sweep outside its three seats: the band
  over the keys, the brand quote, the describe hairline (The Rainbow
  Signature Rule).
- **Don't** put an italic serif (or any serif) in the describe lane or
  anywhere else; the ratified amendment sets the human sentence in
  Barlow 15px warmth. 1982 silkscreen had no serifs.
- **Don't** render "80s" as synthwave neon, grids, chrome, or bloom;
  the world is matte steel and printed ink, not backlit plastic.
- **Don't** color the waveform trace by frequency; time is not
  frequency, and the scope stays single-hue green phosphor.
