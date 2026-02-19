# Inverse Garden: Environment Redesign Brief

## Section 1: What This Project Is

**Inverse Garden** is a data visualization art piece that transforms personal mood tracking data into a 3D garden.

The core concept is **inversion**: negative emotions produce beautiful, lush flowers while positive emotions produce decay and barrenness. Difficult emotional experiences deserve beautiful representation.

It uses real data from Apple Health's State of Mind tracker (~300 entries over 3 months). Users scrub through a timeline and watch the garden evolve.

This is an **audience-facing art piece** viewed as a webpage, not a personal tool. There's a default camera view with limited user control. Viewers should be able to "read" the garden without instruction.

---

## Section 2: What's Locked

**The Encoding System**
- Valence classification determines component type (flower/sprout/decay)
- Emotions determine colors (the specific hex values in the color mapping files)
- Associations determine accent colors
- Scale (size) represents intensity via percentile mapping

**The Inversion Concept**
- Negative emotions = beautiful, lush, vibrant
- Positive emotions = muted, decayed, barren
- This is non-negotiable. It's the point of the piece.

**The Data**
- Apple Health CSV with ~300 entries
- Timeline scrubbing as the interaction model

**Three Component Types**
- Flowers for negative valence
- Sprouts for neutral
- Decay for positive

**Everything else is open.** How the plants look, how they're shaded, the environment, the lighting, the materials, the camera, the ground, the sky — all of it can be redesigned as long as the encoding and inversion are honored.

---

## Section 3: What's Broken and What We Need

**The Technical Problem**

The environment was built piecemeal. We added elements one at a time — ground plane, brick wall, lighting, shadows, sky — without a unified design. Now:

- Elements compete visually and technically
- Fixing one thing breaks another
- The scene doesn't feel like a cohesive space
- It's extremely difficult to edit because of interdependencies
- Decisions about shading affect shadows affect lighting affect materials — and none of these were made together

We need to strip back to nothing and design the whole visual system together.

**The Creative Direction**

- **The exhibit/diorama concept:** The garden exists in a bounded, self-contained world. It's not floating in infinite space — it's an exhibit with edges. The void around it is "the gallery," not broken emptiness.

- **The LED wall:** A brick wall where individual bricks can light up to display text (the valence classification: "Very Unpleasant," "Neutral," etc.). This anchors the piece and signals that this is a virtual/organic hybrid world — which gives permission to stylize everything else.

- **Stylized, not realistic:** Because it's an exhibit, and because of the LED wall, things can be pushed more graphic/designed. Grass doesn't have to look like grass. The sun can be theatrical. Internal consistency matters more than realism.

**How to approach design decisions**

- **Don't default to the obvious solution.** If the first answer to "what's the ground" is "a green plane," that's probably not interesting enough. Push past the first idea.

- **Propose options, not just implementations.** When there's a design decision, show 2-3 directions with different tradeoffs. Don't just pick the easiest one.

- **Justify visual choices.** If something looks a certain way, there should be a reason — how it supports the inversion, how it works with the LED wall concept, how it creates the right feeling.

---

## Section 4: What The Environment Needs To Do (Functionally)

**Support the timeline system**
- As users scrub through entries, time passes
- The viewer should be able to sense what time of day it is (morning, noon, evening, night)
- How this is achieved is open — could be sun position, shadows, sky color, something else, or a combination

**Support the Daily Mood atmosphere**
- Entries with Kind = "Daily Mood" set the weather/atmosphere for that day
- Negative daily mood = clear, sharp, bright and beautiful
- Positive daily mood = overcast, diffuse, muted
- This is about the quality of the light and atmosphere
- A negative noon is blazing sunshine; a positive noon is heavy clouds
- How this is achieved is open — but it needs to read as weather, not just color shift
- This honors the inversion

**Contain and ground the garden**
- Plants need to exist in a space, not float in void
- There needs to be a ground plane or surface where plants grow
- The space should feel bounded and intentional

**Work with the camera**
- Default view that frames the garden well
- Limited user movement (can orbit/explore but constrained)
- Camera can never break the illusion (see underneath things, see past the edges in ugly ways)

**Display the LED wall text**
- Wall receives the current entry's valence classification
- Text rendered via bitmap font (bricks light up as pixels)
- Updates as user scrubs timeline

---

## Section 5: How To Work

**Starting point**

There are two scenes in the codebase:
- **Main scene** — Has plants with fading over time. Environment is a mess.
- **Environment test scene** — Has the wall, sun, day/night cycle, time controls, animation. Closer to what we want, but still not right.

Use the environment test scene as reference to understand what we were attempting. But don't treat it as the foundation to build on — the design decisions in it may be wrong.

**What to take from the existing code:**
- Understanding of what elements we've been trying to implement (wall, time-of-day, atmosphere)
- The LED wall bitmap approach (if it's there)
- Technical patterns that work in R3F

**What NOT to take:**
- The specific visual design choices
- The way elements are structured/connected
- Assumptions about shading, materials, lighting approach

The goal is a fresh design informed by what we've learned, not a renovation of what exists.

**Design before implementing**
- Before writing code, propose the overall visual system — how ground, lighting, atmosphere, wall, and camera work together
- Get feedback on the design direction before building it

**Prototype and validate**
- Build incrementally and show renders at each stage
- Check that each element works with what's already there before adding the next thing
- If something isn't working, say so — don't patch around it

**Push back**
- If something in this brief doesn't make sense or seems like it won't work, say so
- If there's a conflict between requirements, flag it
- You have permission to propose alternatives

---

## Reference Documents

The following documents contain additional context:

- `inverse-garden-gdd-v3_3.md` — Full game design document with encoding details
- `inverse-garden-emotion-colors.html` — Emotion to color mapping
- `inverse-garden-association-colors.html` — Association to accent color mapping
- `inverse-garden-atmosphere-spec.md` — Previous atmosphere/lighting attempts (for context on what was tried, not as a spec to follow)
- `daily-valence-atmosphere-spec.md` — Notes on Daily Mood encoding via weather
