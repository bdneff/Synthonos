# Sound Vocabulary

Phase 0.5 research deliverable. A mapping from producer slang to concrete
parameter movements in this synth.

How this file is used: it is loaded as context for the natural language
patch editing feature (build plan section 5). Rules for the model consuming
it:

- Every backticked parameter id in this file exists in params.schema.json.
  Moves marked (future: ...) refer to parameters that do not exist yet and
  MUST be ignored until they appear in the schema. Do not emit them, do not
  substitute a guess for them.
- Terms compose. "Warm plucky bass" merges the moves of warm, plucky, and
  the low register moves of deep or sub. Apply entries in the order the
  user said them; when two entries move the same parameter, the later term
  wins only when that is musically sensible (a plucky envelope should beat
  warm's neutral envelope; warm's lower cutoff should survive plucky).
- When two terms directly conflict (bright and dark, wide and narrow),
  prefer the user's most recent word.
- All moves are relative to the current patch. "Up slightly" means nudge
  from where the knob is now, not jump to a fixed value. Target regions in
  real units are given where a term implies a destination rather than a
  nudge.
- Rough magnitude scale: slightly is about 10 to 15 percent of the usable
  range, moderately is about a third, hard is half or more, toward a
  region means land inside it.

## Contents

- [Tone and brightness](#tone-and-brightness): warm, bright, dark,
  muffled, crisp, smooth, harsh, glassy, hollow, nasal, honky, screechy,
  cold, airy, breathy
- [Weight and thickness](#weight-and-thickness): fat, thin, huge, small,
  deep, muddy, boomy
- [Texture](#texture): gritty, dirty, clean, crunchy, fuzzy, metallic,
  digital, analog, organic, growl, aggressive
- [Width and space](#width-and-space): wide, narrow, spacious, distant,
  close, dry, wet, lush, dreamy
- [Envelope and dynamics](#envelope-and-dynamics): plucky, punchy, snappy,
  soft, stabby, swelling, sustained, gated
- [Movement](#movement): wobbly, vibrato, tremolo, evolving, static,
  pulsing, detuned, chorused, shimmering
- [Archetypes](#archetypes): supersaw, reese, hoover, acid, sub, laser,
  chiptune, bell-like, brassy, stringy, organ-like, pad-like, lead-like,
  pluck-like

## Tone and brightness

### warm
Definition: rounded and comfortable, with a soft top end and a full low
middle. The opposite of harsh or cold.
Moves:
- `filter_cutoff` down moderately (toward 1000 to 5000 Hz)
- `filter_type` toward lowpass
- `filter_resonance` down slightly
- `osc1_waveform` toward saw or triangle rather than square
- `osc2_level` up slightly with `osc2_octave` down 1, a quiet layer an
  octave below adds body
- `filter_drive` up slightly
- `chorus_mix` up slightly
Reference: the pads in Boards of Canada "Roygbiv".

### bright
Definition: lots of high frequency content, open and forward. The most
common single request.
Moves:
- `filter_cutoff` up hard (toward 8000 to 16000 Hz)
- `osc1_waveform` toward saw
- `filter_keytrack` up slightly so high notes stay open
- `fenv_sustain` up slightly if `filter_env_amount` is above zero
Reference: the lead in Avicii "Levels".

### dark
Definition: high end rolled away, brooding and heavy. Not the same as
muffled; dark can still be clear.
Moves:
- `filter_cutoff` down hard (toward 200 to 1500 Hz)
- `filter_type` toward lowpass
- `filter_resonance` down slightly
- `osc1_octave` down 1 if the sound is a lead or bass
Reference: the bass line of Angelo Badalamenti "Laura Palmer's Theme"
from Twin Peaks.

### muffled
Definition: like hearing the sound through a wall or under a blanket. All
treble gone, detail smeared.
Moves:
- `filter_cutoff` down very hard (toward 200 to 800 Hz)
- `filter_resonance` down toward zero
- `amp_attack` up slightly to soften the transient
Reference: the smeared synths of Washed Out "Feel It All Around".

### crisp
Definition: clear, defined, with a clean fast transient. What plucks and
keys sound like when they cut through a mix.
Moves:
- `filter_cutoff` up moderately (toward 6000 to 12000 Hz)
- `amp_attack` down to the minimum
- `filter_env_amount` up slightly with `fenv_decay` short (toward 0.05 to
  0.2 s) for a defined front edge
- `filter_resonance` up slightly
Reference: the plucks in deadmau5 "Strobe".

### smooth
Definition: no rough edges, no buzz, no bite. Even and pleasant from
bottom to top.
Moves:
- `osc1_waveform` toward triangle or sine
- `filter_resonance` down moderately
- `filter_cutoff` to a middle region (toward 2000 to 6000 Hz)
- `amp_attack` up slightly
- `distortion_mix` down to zero
Reference: the synth lines in Air "La Femme d'Argent".

### harsh
Definition: piercing and fatiguing, aggressive high end that borders on
unpleasant. Sometimes wanted, often the complaint "less harsh".
Moves:
- `filter_cutoff` up hard (toward the top of its range)
- `filter_resonance` up hard
- `osc1_waveform` toward square or saw
- `distortion_drive` up hard
Reference: the leads in Skrillex "Bangarang". For "less harsh", invert
these moves.

### glassy
Definition: pure, bright, and slightly fragile, like struck glass or a
clean electric piano. Few harmonics but placed high.
Moves:
- `osc1_waveform` toward sine or triangle
- `osc2_waveform` toward sine with `osc2_octave` up 1 or `osc2_semitone`
  up 7, at a modest `osc2_level` (around 0.3 to 0.5)
- `filter_cutoff` up hard
- `filter_resonance` down
- `amp_attack` down to the minimum, `amp_decay` moderate
Reference: the DX7 "E PIANO 1" preset heard on countless 1980s ballads.
Note: true glassiness comes from FM synthesis, which this engine does not
have; this is the closest subtractive approximation.

### hollow
Definition: strong fundamental with a scooped, empty middle. Woody and
tube-like, the classic clarinet quality.
Moves:
- `osc1_waveform` toward square (odd harmonics only, the hollow shape)
- `filter_cutoff` to a middle region (toward 1500 to 4000 Hz)
- `filter_resonance` down slightly
- `osc2_level` down, a single square carries the effect best
Reference: a clarinet, the textbook hollow (odd harmonic) instrument.

### nasal
Definition: pinched and midrange heavy, like a voice through a telephone
or an oboe. Only the middle of the spectrum survives.
Moves:
- `filter_type` toward bandpass
- `filter_cutoff` to a middle region (toward 800 to 2000 Hz)
- `filter_resonance` up moderately
Reference: an oboe.

### honky
Definition: a boxy vowel-like midrange bump, lower and rounder than
nasal. The talk box and cheap speaker zone.
Moves:
- `filter_type` toward bandpass
- `filter_cutoff` toward 500 to 1200 Hz
- `filter_resonance` up moderately
- `osc1_waveform` toward square
Reference: the talk box lines in Zapp and Roger "More Bounce to the
Ounce".

### screechy
Definition: a high whistling scream, resonance pushed until it almost
sings on its own.
Moves:
- `filter_cutoff` up hard (toward 4000 to 10000 Hz)
- `filter_resonance` up very hard (toward the top of its range)
- `osc1_octave` up 1
- `lfo_target` to cutoff with `lfo_rate` fast (toward 4 to 8 Hz) and
  `lfo_depth` up slightly for a moving screech
Reference: the screech leads in Flux Pavilion "Bass Cannon".

### cold
Definition: precise, sterile, no warmth or drift. Machine-like on
purpose.
Moves:
- `osc1_fine` and `osc2_fine` to zero, remove all beating
- `osc1_unison_voices` and `osc2_unison_voices` down to 1
- `filter_cutoff` up moderately
- `filter_resonance` up slightly
- `osc1_waveform` toward square or saw
- `chorus_mix` down to zero
Reference: Kraftwerk "The Robots".

### airy
Definition: light, open, with a breath of very high frequency around the
tone. Feels like air moving.
Moves:
- `osc_noise_level` up moderately, this is the real mechanism
- `filter_cutoff` up hard (toward 10000 Hz and above)
- `osc2_waveform` toward sine with `osc2_octave` up 2 at a low
  `osc2_level` (around 0.15 to 0.3)
- `amp_attack` up slightly
- `reverb_mix` up moderately
Reference: the pads under Enya "Orinoco Flow". Note: without a noise
source the current schema only gestures at this term.

### breathy
Definition: audible breath in the tone, like a flute or a whispering
voice. Noise blended with pitch.
Moves:
- `osc_noise_level` up hard, this is the essential move
- `filter_cutoff` to a middle region (toward 2000 to 5000 Hz)
- `amp_attack` up slightly (toward 0.05 to 0.2 s)
- `osc1_waveform` toward triangle or sine
Reference: the breathy flute figure that opens Peter Gabriel
"Sledgehammer". Note: barely expressible until a noise source lands.

## Weight and thickness

### fat
Definition: thick and full, occupying plenty of space without being
muddy. Synonym: thick. The classic analog bass compliment.
Moves:
- `osc1_unison_voices` up moderately (toward 3 to 5)
- `osc1_unison_detune` to a moderate region (toward 10 to 25 cents)
- `osc2_level` up moderately with `osc2_octave` down 1
- `filter_cutoff` down slightly
- `filter_drive` up moderately
Reference: a Minimoog bass, the sound "fat" was coined for.

### thin
Definition: lacking low end and body. Sometimes wanted (a thin verse
sound that leaves room), usually the complaint "too thin".
Moves:
- `filter_type` toward highpass with `filter_cutoff` up moderately
  (toward 300 to 1000 Hz) to remove lows
- `osc1_unison_voices` and `osc2_unison_voices` down to 1
- `osc2_level` down
- `osc1_octave` up 1
Reference: a transistor radio. For "too thin", invert these moves.

### huge
Definition: enormous in every direction, tall, wide, and long. The
festival drop feeling.
Moves:
- `osc1_unison_voices` and `osc2_unison_voices` up to the top (7 or 8)
- `osc1_unison_detune` and `osc2_unison_detune` up moderately (toward 20
  to 40 cents)
- `osc1_pan` hard left and `osc2_pan` hard right
- `osc2_octave` down 1
- `amp_release` up moderately
- `master_width` up hard, `reverb_mix` up moderately
Reference: Tiësto "Adagio for Strings".

### small
Definition: tiny, contained, toy-like. The opposite of huge in every
direction.
Moves:
- `osc1_unison_voices` and `osc2_unison_voices` down to 1
- `osc1_pan` and `osc2_pan` to center
- `osc1_octave` up 1 or 2
- `amp_release` down hard
- `osc1_level` down slightly
- `reverb_mix` down to zero
Reference: a music box.

### deep
Definition: reaching far down into the bass, felt as much as heard.
Moves:
- `osc1_octave` down 1 or 2
- `osc1_waveform` toward sine or triangle so the bottom stays clean
- `filter_cutoff` down moderately
- `osc2_level` down unless it is also carrying low end
Reference: the sub bass in James Blake "Limit to Your Love".

### muddy
Definition: a congested, indistinct buildup in the low midrange (roughly
150 to 500 Hz). Almost always a complaint, so the usual request is "less
muddy": invert the moves below.
Moves (that cause mud, invert to fix):
- `filter_cutoff` down into the 300 to 800 Hz region with high
  `amp_sustain`
- `osc2_level` up with `osc2_octave` down 1 stacking more low mids
- `filter_resonance` down toward zero, removing definition
Reference: the low end of a cassette four track demo.

### boomy
Definition: exaggerated, ringing low end that hangs in the air after the
note.
Moves:
- `osc1_octave` down 1
- `filter_cutoff` down hard (toward 100 to 250 Hz)
- `filter_resonance` up moderately so the low end rings
- `amp_decay` and `amp_release` up moderately
Reference: a TR-808 kick with the decay turned up.

## Texture

### gritty
Definition: a rough, sandpapery surface on the tone. Dirt that adds
attitude without destroying the note.
Moves:
- `distortion_drive` up moderately, the primary mechanism
- `filter_drive` up moderately
- `osc1_waveform` toward saw
- `filter_resonance` up slightly
- `osc1_unison_detune` up slightly if unison is active
Reference: the electro bass of Benny Benassi "Satisfaction". Note: only
weakly expressible until drive and distortion parameters land.

### dirty
Definition: unpolished and slightly distorted, in a good way. Looser and
lower-fi than gritty.
Moves:
- `distortion_drive` up moderately with (future:
  `distortion_mix`) around half
- `osc2_waveform` matching osc1 with `osc2_fine` offset (toward 8 to 15
  cents) for a loose unstable pitch
- `filter_resonance` up slightly
- `filter_cutoff` down slightly
Reference: the bass in Daft Punk "Da Funk".

### clean
Definition: pure and precise, no distortion, no drift, nothing extra.
Moves:
- `osc1_fine` and `osc2_fine` to zero
- `osc1_unison_voices` down to 1 or 2 with `osc1_unison_detune` low
- `filter_resonance` down moderately
- `osc1_waveform` toward triangle or sine
- `distortion_mix` down to zero
Reference: Hot Butter "Popcorn".

### crunchy
Definition: hard-clipped, broken-speaker distortion with a brittle edge.
More damaged than gritty.
Moves:
- `distortion_drive` up hard with `distortion_mix`
  up hard, the real mechanism
- `osc1_waveform` toward square
- `filter_resonance` up moderately
Reference: Justice "Waters of Nazareth". Note: not honestly expressible
until distortion lands; the current schema can only hint at it.

### fuzzy
Definition: thick, wooly, sustained distortion, like a fuzz pedal. Rounder
than crunchy, the edges blur together.
Moves:
- `distortion_drive` up hard, the real mechanism
- `osc1_waveform` toward saw with `osc2_waveform` square and `osc2_fine`
  offset slightly
- `filter_cutoff` down moderately to round off the top
Reference: the fuzz bass on Beastie Boys "Sabotage".

### metallic
Definition: clangorous and inharmonic, like struck metal. The overtones
do not line up with the note.
Moves:
- `osc2_semitone` to a dissonant interval (up 6, a tritone) at moderate
  `osc2_level`
- `filter_type` toward bandpass with `filter_resonance` up hard
- `amp_decay` down moderately, metal rings then dies
- `filter_env_amount` up slightly with `fenv_decay` short
Reference: a gamelan. Note: convincing metal needs FM or ring modulation,
which this engine does not have; this is an approximation.

### digital
Definition: precise, glossy, slightly artificial. The sheen of 1980s and
1990s hardware, worn proudly.
Moves:
- `osc1_fine` and `osc2_fine` to zero
- `osc1_unison_voices` down to 1
- `filter_cutoff` up hard
- `filter_resonance` down
- `osc1_waveform` toward square or sine
Reference: the clean tones of a Yamaha DX7.

### analog
Definition: slightly imperfect and alive, tuning that drifts a little,
edges that are rounded. The warmth of old hardware.
Moves:
- `osc2_fine` offset slightly (toward 3 to 8 cents against osc1)
- `filter_cutoff` down slightly
- `filter_resonance` up slightly
- `filter_drive` up slightly
- `chorus_mix` up slightly
Reference: a Roland Juno-106.

### organic
Definition: sounds played rather than programmed. Subtle constant
variation, nothing perfectly repeating.
Moves:
- `lfo_target` to cutoff with `lfo_waveform` triangle, `lfo_rate` very
  low (toward 0.1 to 0.4 Hz), `lfo_depth` up slightly
- `osc2_fine` offset slightly
- `amp_attack` up slightly
Reference: the wavering textures across Boards of Canada "Music Has the
Right to Children".

### growl
Definition: a low snarling vowel-like movement, the modern bass music
staple.
Moves:
- `osc1_octave` down 1 with `osc1_waveform` saw and `osc2_waveform`
  square
- `filter_type` toward bandpass or lowpass with `filter_cutoff` low
  (toward 300 to 1000 Hz)
- `filter_resonance` up moderately
- `lfo_target` to cutoff with `lfo_rate` toward 1 to 4 Hz and
  `lfo_depth` up moderately
- `distortion_drive` up hard
Reference: Skrillex "Scary Monsters and Nice Sprites". Note: real growls
also need formant movement and heavy distortion; partial for now.

### aggressive
Definition: loud, forward, confrontational. Everything sharpened and
pushed.
Moves:
- `filter_cutoff` up moderately
- `filter_resonance` up moderately
- `osc1_waveform` toward saw with `osc1_unison_voices` up and
  `osc1_unison_detune` up moderately
- `amp_attack` down to the minimum
- `distortion_drive` up hard
Reference: the synth stabs in The Prodigy "Smack My Bitch Up".

## Width and space

### wide
Definition: fills the stereo field from far left to far right instead of
sitting in the middle.
Moves:
- `osc1_pan` hard left and `osc2_pan` hard right
- `osc1_unison_voices` up moderately (4 or more)
- `osc1_unison_detune` up moderately
- `master_width` up hard
- `chorus_mix` up moderately
Reference: the Roland JP-8000 "SuperSaw" spread.

### narrow
Definition: pulled into the center, mono or close to it. What basses need
so the low end stays solid.
Moves:
- `osc1_pan` and `osc2_pan` to center
- `osc1_unison_voices` and `osc2_unison_voices` down toward 1
- `osc1_unison_detune` and `osc2_unison_detune` down hard
- `master_width` down toward mono
Reference: a Moog Taurus bass pedal, a mono instrument by design.

### spacious
Definition: sits in a large space, air and room around the sound.
Moves:
- `reverb_mix` up hard with `reverb_size` large, the
  real mechanism
- `amp_release` up moderately
- `amp_attack` up slightly
- `filter_cutoff` down slightly
Reference: Brian Eno "An Ending (Ascent)". Note: mostly out of reach
until reverb lands; release time is the only current stand-in.

### distant
Definition: far away in the mix, behind everything else. Quiet, dull,
and washed in room sound.
Moves:
- `filter_cutoff` down moderately (distance eats treble first)
- `osc1_level` down slightly
- `reverb_mix` up hard with `reverb_size` large
Reference: the pads in Burial "Archangel".

### close
Definition: right in front of the listener, intimate and present.
Moves:
- `filter_cutoff` up slightly
- `amp_attack` down toward the minimum
- `osc1_level` up slightly
- `reverb_mix` and `delay_mix` down to zero
Reference: the dry upfront synth lines of Prince "1999".

### dry
Definition: no reverb, no echo, no space at all. The raw signal.
Moves:
- `reverb_mix` and `delay_mix` down to zero, the
  entire meaning of the term
- `amp_release` down slightly
Reference: Kraftwerk "Computer World", famously bone dry. Note: until
effects land every patch is already dry, so this term is a no-op today.

### wet
Definition: soaked in reverb and echo, more space than source.
Moves:
- `reverb_mix` up hard, `delay_mix` up moderately,
  `delay_feedback` up moderately
- `amp_release` up moderately as a weak stand-in
Reference: the dub echoes of King Tubby. Note: not honestly expressible
until effects land.

### lush
Definition: rich, layered, and enveloping, thick with gentle movement.
The classic chorused pad quality.
Moves:
- `osc1_unison_voices` and `osc2_unison_voices` up moderately
- `osc1_unison_detune` toward 15 to 30 cents
- `amp_attack` up moderately, `amp_release` up moderately
- `osc1_pan` and `osc2_pan` spread apart moderately
- `chorus_mix` up hard, `reverb_mix` up moderately
Reference: The Cure "Plainsong".

### dreamy
Definition: hazy, floating, slightly unreal. Soft edges and slow motion.
Moves:
- `amp_attack` up moderately, `amp_release` up hard
- `filter_cutoff` down slightly
- `lfo_target` to pitch with `lfo_waveform` sine, `lfo_rate` low (toward
  0.2 to 1 Hz), `lfo_depth` up very slightly for a gentle waver
- `osc2_fine` offset slightly
- `reverb_mix` up hard, `chorus_mix` up moderately
Reference: Beach House "Space Song".

## Envelope and dynamics

### plucky
Definition: a note that starts instantly and falls away quickly, like a
plucked string. Defined by the envelope, not the tone.
Moves:
- `amp_attack` down to the minimum
- `amp_decay` down (toward 0.1 to 0.4 s)
- `amp_sustain` down toward zero
- `amp_release` short to moderate (toward 0.1 to 0.4 s)
- `filter_env_amount` up moderately with `fenv_attack` at minimum,
  `fenv_decay` short (toward 0.05 to 0.3 s), `fenv_sustain` low
Reference: the pluck lead in Eric Prydz "Opus".

### punchy
Definition: a hard, weighty front edge that hits and then settles. Punch
is the transient, not the length.
Moves:
- `amp_attack` down to the minimum
- `filter_env_amount` up moderately with `fenv_decay` very short (toward
  0.03 to 0.1 s) for a bright bite on the front
- `amp_decay` down moderately with `amp_sustain` at a middle level
- `amp_velocity` up moderately
- (future: `osc*_phase`) fixed rather than random, so every hit lands
  identically
Reference: the bass in Daft Punk "Around the World".

### snappy
Definition: short, tight, and percussive, over almost as soon as it
starts. Shorter than plucky.
Moves:
- `amp_attack` down to the minimum
- `amp_decay` down hard (toward 0.05 to 0.15 s)
- `amp_sustain` down to zero
- `amp_release` down hard
Reference: the clavinet on Stevie Wonder "Superstition".

### soft
Definition: gentle onset, nothing sharp anywhere. Notes arrive rather
than hit.
Moves:
- `amp_attack` up moderately (toward 0.1 to 0.5 s)
- `filter_cutoff` down slightly
- `filter_resonance` down slightly
- `osc1_waveform` toward triangle or sine
Reference: the pads in Tycho "A Walk".

### stabby
Definition: short assertive chord hits, longer than snappy but still
clipped. The rave stab.
Moves:
- `amp_attack` down to the minimum
- `amp_decay` toward 0.2 to 0.5 s with `amp_sustain` low
- `amp_release` down (toward 0.05 to 0.2 s)
- `filter_cutoff` up moderately, stabs are bright
- `osc1_waveform` toward saw
Reference: the rave stabs in The Prodigy "Charly".

### swelling
Definition: rises slowly out of silence and blooms. The note gets louder
and usually brighter as it grows.
Moves:
- `amp_attack` up hard (toward 1 to 3 s)
- `filter_env_amount` up moderately with `fenv_attack` up hard to match,
  so brightness blooms with the volume
- `amp_sustain` up high
- `amp_release` up moderately
Reference: the slow synth swells opening Pink Floyd "Shine On You Crazy
Diamond".

### sustained
Definition: holds at full strength for as long as the key is down.
Moves:
- `amp_sustain` up toward 1
- `amp_decay` up moderately so the note does not dip on the way there
- `amp_release` at a middle setting
Reference: a pipe organ.

### gated
Definition: chopped rhythmically on and off, as if a gate opens and
closes in time.
Moves:
- `lfo_target` to amp
- `lfo_waveform` to square
- `lfo_rate` toward 4 to 8 Hz
- `lfo_depth` up hard
- `amp_sustain` up high so the gate has material to chop
- (future: `lfo_sync`) to a tempo division, gates really want tempo sync
Reference: the chopped lead of Zombie Nation "Kernkraft 400".

## Movement

### wobbly
Definition: the filter opens and closes in a rhythmic wah, the bass music
wobble.
Moves:
- `lfo_target` to cutoff
- `lfo_waveform` to sine or triangle
- `lfo_rate` toward 0.5 to 4 Hz
- `lfo_depth` up moderately to hard
- `filter_cutoff` to a low middle region so the sweep has range
- `filter_resonance` up slightly
- (future: `lfo_sync`) to a tempo division for wobbles that lock to the
  beat
Reference: the wobble bass in Rusko "Cockney Thug".

### vibrato
Definition: the pitch wavers gently and periodically, the way a singer or
violinist shapes a held note.
Moves:
- `lfo_target` to pitch
- `lfo_waveform` to sine
- `lfo_rate` toward 4 to 7 Hz
- `lfo_depth` up slightly, vibrato is subtle or it sounds seasick
- `lfo_fade` up moderately so the vibrato arrives after the
  note starts, which is how players actually do it
Reference: a theremin.

### tremolo
Definition: the volume pulses up and down while the pitch stays still.
Moves:
- `lfo_target` to amp
- `lfo_waveform` to sine or triangle
- `lfo_rate` toward 3 to 8 Hz
- `lfo_depth` up moderately
Reference: the trembling electric piano on Portishead "Roads".

### evolving
Definition: the tone changes slowly and continuously over the note, never
sitting still. Pad territory.
Moves:
- `lfo_target` to cutoff
- `lfo_waveform` to triangle, or sample_hold for stepped random drift
- `lfo_rate` down very low (toward 0.05 to 0.2 Hz)
- `lfo_depth` up moderately
- `amp_attack` and `amp_release` up moderately
- (future: second LFO and mod matrix slots) for movement on more than one
  destination at once
Reference: Aphex Twin "Xtal".

### static
Definition: completely still, no movement or modulation at all. Usually
the complaint "too static" asking for the opposite.
Moves:
- `lfo_depth` down to zero, or `lfo_target` to none
- `osc1_fine` and `osc2_fine` to zero
Reference: a held Hammond organ note with the Leslie off. For "too
static", apply evolving or organic instead.

### pulsing
Definition: a smooth rhythmic breathing of the volume, softer than gated,
rounder than tremolo. The pumping dance floor feel.
Moves:
- `lfo_target` to amp
- `lfo_waveform` to triangle
- `lfo_rate` toward 1 to 4 Hz
- `lfo_depth` up moderately
- `amp_sustain` up high
- (future: `lfo_sync`) to quarter or eighth notes
Reference: the pumping pads of Stardust "Music Sounds Better with You".

### detuned
Definition: two or more pitches deliberately rubbed against each other,
creating a slow thick beating.
Moves:
- `osc2_level` up to match osc1 with `osc2_waveform` matching
- `osc2_fine` offset moderately (toward 10 to 30 cents)
- `osc1_unison_detune` up moderately if unison is active
Reference: the detuned lead of Kavinsky "Nightcall".

### chorused
Definition: a watery doubled shimmer, as if several copies of the sound
play at once slightly out of tune.
Moves:
- `chorus_mix` up hard with `chorus_rate` slow and
  `chorus_depth` moderate, the real mechanism
- `osc2_waveform` matching osc1 with `osc2_fine` offset (toward 5 to 15
  cents) as the current approximation
- `osc1_pan` and `osc2_pan` spread apart slightly
- `osc1_unison_voices` up to 2 or 3 with `osc1_unison_detune` low
Reference: the chorus button on a Roland Juno-60, one of the most loved
single buttons in synth history.

### shimmering
Definition: a sparkling high layer that glints above the main tone, in
gentle constant motion.
Moves:
- `osc2_waveform` toward sine or triangle with `osc2_octave` up 2 at a
  low `osc2_level` (around 0.15 to 0.3)
- `filter_cutoff` up hard
- `lfo_target` to pan with `lfo_waveform` sine, `lfo_rate` low (toward
  0.3 to 1.5 Hz), `lfo_depth` up slightly
- `reverb_mix` up moderately
Reference: the glittering arpeggios of Owl City "Fireflies".

## Archetypes

Each archetype entry is a complete starting point recipe: set everything
listed, starting from the default patch, rather than nudging. Future
bullets list what the recipe is missing until those parameters exist.

### supersaw
Definition: the anthem trance and EDM lead, a huge stack of detuned saws
that sounds like a hundred synths playing at once.
Moves:
- `osc1_waveform` to saw, `osc2_waveform` to saw
- `osc1_unison_voices` to 7 or 8, `osc2_unison_voices` to 7 or 8
- `osc1_unison_detune` toward 20 to 35 cents, `osc2_unison_detune`
  slightly higher (toward 30 to 45 cents) so the stacks do not align
- `osc2_octave` up 1 with `osc2_level` around 0.5 to 0.7
- `osc1_pan` moderately left, `osc2_pan` moderately right
- `filter_type` lowpass, `filter_cutoff` high (toward 8000 to 14000 Hz),
  `filter_resonance` low
- `amp_attack` near minimum, `amp_decay` around 0.3 s, `amp_sustain`
  around 0.8, `amp_release` around 0.3 s
- `master_width` up hard, `chorus_mix` and (future:
  `reverb_mix`) up moderately, `filter_slope` 12 dB per octave
  for the brighter open top
Reference: Darude "Sandstorm".

### reese
Definition: the drum and bass growl bass, two barely detuned saws whose
slow beating turns into a churning hollow menace.
Moves:
- `osc1_waveform` to saw, `osc2_waveform` to saw
- `osc1_octave` down 1, `osc2_octave` down 1
- `osc2_fine` toward 20 to 40 cents, the beating is the whole sound
- `osc1_unison_voices` and `osc2_unison_voices` at 1, the classic is two
  plain saws
- `osc1_pan` and `osc2_pan` center, reese lows stay mono
- `filter_type` lowpass, `filter_cutoff` toward 300 to 900 Hz,
  `filter_resonance` low to moderate
- `amp_attack` near minimum, `amp_sustain` high, `amp_release` short
- `distortion_drive` up moderately and `filter_slope`
  24 dB per octave for the modern processed version
Reference: Renegade "Terrorist" (the Reese bass lineage runs from Kevin
Saunderson's Reese "Just Want Another Chance" into jungle).

### hoover
Definition: the rave siren, a snarling sweeping chord of heavily detuned
saws that seems to swallow the track.
Moves:
- `osc1_waveform` to saw, `osc2_waveform` to saw
- `osc1_unison_voices` toward 4 to 6, `osc2_unison_voices` toward 4 to 6
- `osc1_unison_detune` and `osc2_unison_detune` up hard (toward 40 to 70
  cents), well past pretty
- `osc2_octave` down 1 with `osc2_level` around 0.7
- `filter_type` lowpass, `filter_cutoff` toward 4000 to 10000 Hz,
  `filter_resonance` up moderately
- `amp_attack` near minimum, `amp_sustain` high
- `glide_time` up moderately, the signature upward pitch slide
  into each note cannot be made without portamento
- `distortion_drive` up moderately
Reference: Human Resource "Dominator".

### acid
Definition: the squelchy resonant 303 line, a filter pushed so hard it
whistles and chirps around the notes. Synonym: squelchy.
Moves:
- `osc1_waveform` to saw or square, both are authentic
- `osc2_level` to 0, one oscillator only
- `osc1_unison_voices` at 1, `osc1_pan` center
- `filter_type` lowpass, `filter_cutoff` low (toward 200 to 800 Hz)
- `filter_resonance` up hard (toward 0.7 to 0.9)
- `filter_env_amount` up hard (toward 0.6 to 0.9)
- `fenv_attack` at minimum, `fenv_decay` toward 0.1 to 0.4 s,
  `fenv_sustain` at 0
- `amp_attack` at minimum, `amp_decay` around 0.3 s, `amp_sustain`
  around 0.3 to 0.5, `amp_release` short
- `glide_time` short for slides between tied notes, (future:
  `amp_velocity`) up for accents, `distortion_drive` up
  slightly, all three are core 303 behavior
Reference: Phuture "Acid Tracks".

### sub
Definition: a pure low sine that carries the weight under a track. Felt
in the chest, nearly invisible on small speakers.
Moves:
- `osc1_waveform` to sine
- `osc1_octave` down 2 (down 1 if the part is played high)
- `osc1_unison_voices` at 1, `osc1_pan` center
- `osc2_level` to 0
- `filter_type` lowpass, `filter_cutoff` low (toward 150 to 400 Hz),
  `filter_resonance` at 0
- `amp_attack` near minimum, `amp_sustain` high, `amp_release` toward
  0.1 to 0.3 s
- `lfo_depth` at 0
- `distortion_drive` up slightly only if it must be audible on
  small speakers
Reference: the 808 style sine sub under modern trap and drill.

### laser
Definition: a fast descending zap, the arcade gun sound. Synonym: zap.
Moves:
- `osc1_waveform` to square or saw
- `filter_resonance` up very hard (toward 0.85 to 0.95)
- `filter_env_amount` up to maximum
- `fenv_attack` at minimum, `fenv_decay` very short (toward 0.05 to
  0.15 s), `fenv_sustain` at 0
- `filter_cutoff` low (toward 200 to 500 Hz) so the sweep falls into it
- `amp_attack` at minimum, `amp_decay` short, `amp_sustain` at 0,
  `amp_release` short
- (future: mod matrix pitch envelope) is the real mechanism, a fast pitch
  drop; the resonant filter sweep above is the best current stand-in
Reference: the zap of the Space Invaders arcade cabinet.

### chiptune
Definition: the 8 bit console sound, raw unfiltered pulse waves with
simple fast envelopes.
Moves:
- `osc1_waveform` to square
- `osc1_unison_voices` at 1, `osc1_fine` at 0, `osc1_pan` center
- `osc2_level` to 0 (or a second square at `osc2_semitone` up 12 for the
  two channel feel, at low level)
- `filter_cutoff` at maximum, `filter_resonance` at 0, the wave stays raw
- `amp_attack` at minimum, `amp_sustain` high, `amp_release` at minimum
- `lfo_target` to pitch with `lfo_waveform` sine, `lfo_rate` toward 5 to
  7 Hz, `lfo_depth` up slightly for the melody vibrato
- (future: pulse width control) for the 25 and 12.5 percent duty tones,
  `osc_noise_level` for the percussion channel; without pulse
  width only the 50 percent square is reachable
Reference: the Super Mario Bros. theme on the NES.

### bell-like
Definition: a struck bell or chime, a bright inharmonic strike that rings
and darkens as it fades.
Moves:
- `osc1_waveform` to sine
- `osc2_waveform` to sine with `osc2_octave` up 1 and `osc2_semitone` up
  3 or 4, the slightly off partial above the octave is what reads as bell
- `osc2_level` around 0.3 to 0.5
- `amp_attack` at minimum, `amp_decay` long (toward 2 to 4 s),
  `amp_sustain` at 0, `amp_release` long (toward 2 to 4 s)
- `filter_env_amount` up moderately with `fenv_decay` long to match, so
  the strike is bright and the tail darkens
- `filter_keytrack` up
- (future: FM or ring modulation) is how real bell patches are made;
  `reverb_mix` up moderately
Reference: the DX7 "TUB BELLS" preset.

### brassy
Definition: synth brass, a saw section with a soft blooming attack where
the brightness arrives just after the note.
Moves:
- `osc1_waveform` to saw, `osc2_waveform` to saw
- `osc2_fine` toward 5 to 10 cents, `osc2_level` around 0.7
- `osc1_unison_voices` at 1 or 2
- `filter_type` lowpass, `filter_cutoff` toward 1000 to 3000 Hz,
  `filter_resonance` low to moderate
- `filter_env_amount` up moderately with `fenv_attack` toward 0.05 to
  0.15 s, the delayed brightness bloom is the brass signature
- `amp_attack` toward 0.02 to 0.08 s, `amp_sustain` high
- `lfo_target` to pitch with `lfo_rate` toward 4 to 6 Hz and `lfo_depth`
  up very slightly
- `filter_drive` up moderately for bite, `glide_time`
  very short for the swagger between notes
Reference: the CS-80 brass of the Vangelis "Blade Runner" main titles.

### stringy
Definition: the string machine ensemble, a soft wide bed of massed
detuned saws with slow edges.
Moves:
- `osc1_waveform` to saw, `osc2_waveform` to saw
- `osc1_unison_voices` toward 4 to 6, `osc2_unison_voices` toward 4 to 6
- `osc1_unison_detune` and `osc2_unison_detune` toward 15 to 25 cents
- `osc2_fine` toward 8 to 15 cents
- `osc1_pan` moderately left, `osc2_pan` moderately right
- `filter_type` lowpass, `filter_cutoff` toward 3000 to 7000 Hz,
  `filter_resonance` low
- `amp_attack` toward 0.2 to 0.5 s, `amp_sustain` high, `amp_release`
  toward 0.5 to 1.5 s
- `chorus_mix` up hard, ensemble chorus is most of the string
  machine sound; (future: `osc*_phase_random`) on, so stacked notes smear
  rather than align
Reference: the ARP Solina String Ensemble.

### organ-like
Definition: the drawbar organ, pure stacked octaves that start and stop
instantly and hold forever.
Moves:
- `osc1_waveform` to sine
- `osc2_waveform` to sine with `osc2_octave` up 1 and `osc2_level` near
  `osc1_level`
- `osc1_unison_voices` and `osc2_unison_voices` at 1
- `filter_cutoff` at maximum, `filter_resonance` at 0
- `filter_keytrack` up
- `amp_attack` at minimum, `amp_sustain` at 1, `amp_release` very short
  (toward 0.01 to 0.05 s), organs stop dead
- `osc_noise_level` a tiny amount for key click, (future:
  `chorus_rate`) fast for a rotary speaker feel; only two of the nine
  drawbars are reachable with two oscillators
Reference: the M1 organ bass of Robin S "Show Me Love".

### pad-like
Definition: a sustained background chord bed, soft edges, wide, slowly
moving, never demanding attention.
Moves:
- `osc1_waveform` to saw, `osc2_waveform` to saw or triangle
- `osc1_unison_voices` toward 3 to 5 with `osc1_unison_detune` toward 15
  to 25 cents
- `osc2_octave` down 1 with `osc2_level` around 0.5
- `osc1_pan` moderately left, `osc2_pan` moderately right
- `filter_type` lowpass, `filter_cutoff` toward 1500 to 5000 Hz,
  `filter_resonance` low
- `amp_attack` toward 0.5 to 2 s, `amp_sustain` toward 0.8 to 1,
  `amp_release` toward 1 to 3 s
- `lfo_target` to cutoff with `lfo_waveform` triangle, `lfo_rate` very
  low (toward 0.05 to 0.2 Hz), `lfo_depth` up slightly
- `reverb_mix` and `chorus_mix` up moderately, they
  do half the work of a finished pad
Reference: the pads of Depeche Mode "Enjoy the Silence".

### lead-like
Definition: a single melodic voice meant to sit on top of everything,
clear, sustained, and expressive.
Moves:
- `osc1_waveform` to saw or square
- `osc1_unison_voices` at 1 or 2 with low detune
- `osc2_level` low or 0
- `filter_type` lowpass, `filter_cutoff` toward 4000 to 10000 Hz,
  `filter_resonance` up slightly
- `amp_attack` at minimum, `amp_sustain` toward 0.7 to 0.9,
  `amp_release` toward 0.1 to 0.3 s
- `lfo_target` to pitch with `lfo_waveform` sine, `lfo_rate` toward 5 to
  6.5 Hz, `lfo_depth` up slightly
- `glide_time` short, expressive mono leads live on portamento;
  `lfo_fade` so the vibrato arrives late; (future:
  `amp_velocity`) up moderately
Reference: the lead hook of a-ha "Take On Me".

### pluck-like
Definition: the melodic pluck patch, an instant bright attack decaying to
silence, the backbone of trance and pop toplines.
Moves:
- `osc1_waveform` to saw
- `osc1_unison_voices` toward 2 to 4 with `osc1_unison_detune` toward 10
  to 20 cents
- `osc2_level` to 0
- `filter_type` lowpass, `filter_cutoff` toward 500 to 2000 Hz as the
  resting point
- `filter_env_amount` up hard with `fenv_attack` at minimum,
  `fenv_decay` toward 0.1 to 0.3 s, `fenv_sustain` low
- `filter_keytrack` up
- `amp_attack` at minimum, `amp_decay` toward 0.2 to 0.5 s,
  `amp_sustain` at or near 0, `amp_release` toward 0.2 to 0.4 s
- `reverb_mix` and `delay_mix` up moderately, the
  genre lives on plucks feeding a long tail
Reference: the pluck lead of Avicii "Levels".
