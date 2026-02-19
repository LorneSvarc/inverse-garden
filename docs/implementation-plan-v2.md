# Inverse Garden: Implementation Plan v2

## Document Information

**Created:** February 17, 2026  
**Status:** Active — Revised after feedback  
**Purpose:** Get Inverse Garden from "everything works, nothing works well" to exhibition-ready

---

## What Changed from v1

The first plan treated issues too independently. Lorne's feedback made clear that:

- **Atmosphere/mood/environment are one interconnected design problem** — can't fix mood encoding without clouds, sky, floor, and wall simultaneously
- **The Moebius shader might solve problems in Phases 2 & 3**, not just be optional polish — it needs to be evaluated earlier
- **Clouds are inseparable from daily mood** — they shouldn't be deferred to a later phase
- **The wall is a composition element**, not just an info display — it breaks up infinite sky and its position/behavior affects everything
- **Some described "current state" was wrong** — e.g., soil noise isn't actually visible despite being in the code
- **Animation timing may ripple into other decisions** — leaving it to Week 4 risks redoing visual work

---

## Revised Structure

Instead of 7 sequential phases, the plan now has **3 tracks**:

**Track A: Stability** — Must happen first, gates everything else  
**Track B: The Scene Redesign** — One integrated effort covering atmosphere, mood, environment, and composition  
**Track C: Animation, UI & Polish** — Can start after Track B foundations are in place

---

## Track A: Stability (Week 1)

### A1. Performance Investigation & Crash Fix ⚠️ CRITICAL

**Problem:** App periodically crashes with "this page is using too much energy," especially during playback. Running on M1 Max MacBook Pro, Safari and Chrome.

**Approach:**
1. Profile in both Safari (Web Inspector → Timelines) and Chrome (DevTools → Performance)
2. Record 30-second playback session, identify the spike patterns
3. Audit suspects:
   - FallenBloom3D geometry creation (BufferGeometry per petal)
   - All ~300 plants running useFrame hooks
   - Post-processing stack (god rays aren't working anyway — are they still consuming GPU cycles?)
   - Cloud geometry merging
   - No frustum culling on off-screen plants
4. Safari-specific: check for WebGL context loss warnings (Safari is stricter about GPU memory)
5. Fix based on findings — likely combination of geometry pooling, frustum culling, and disabling broken effects

**Success criteria:** 5+ minutes continuous playback without crash on both browsers.

**Time:** 4-6 hours

### A2. Documentation Audit

**Problem:** TASKS.md, GDD may have stale info and hidden TODOs.

**Approach:** Read all docs, cross-reference with codebase, clean up.

**Time:** 2-3 hours (parallel to A1)

### A3. Quick Wins (do alongside A1/A2)

- **Remove garden level bar** from UI (keep in dev panel) — 5 minutes
- **Flower scale calibration** — reduce max scale, test non-linear curve. Try 0.6-1.3 range with `percentile^0.8` compression. — 1-2 hours

---

## Track B: The Scene Redesign

This is the core work. The previous plan split this across Phases 2, 3, and 7 — but your feedback is right that they're all one problem. Here's why:

- Daily mood encoding requires atmosphere changes (clouds, light quality, sky, floor)
- The wall is a composition element that interacts with sky and camera
- The shader could transform how everything looks, making fine-tuning individual materials moot
- The floor, enclosure, and ground interact with each other and with the atmosphere
- Solving any one in isolation risks the "fix one thing, break another" pattern that got us here

### The Approach: Design First, Then Build

Rather than jumping into parameter tweaking, we treat this as a **holistic environment design** with a clear decision sequence.

---

### B1. Shader Decision Point (Week 1-2, ~6-8 hours)

**Why this comes first:** The Moebius-style post-processing shader fundamentally changes the visual identity of *everything* — plants, ground, wall, sky, shadows. If we're going to use it, we need to know before fine-tuning anything else. If the shader gives us bold outlines, stylized shadows, and visual cohesion, it may resolve multiple complaints at once (toon material issues, boring ground, flat enclosure, placeholder sky).

**What to do:**
1. Follow the Moebius spec Step 0: swap toon materials → standard PBR (preserving all color values)
2. Follow Step 1: scaffold the pass, get the red-tint test working
3. Follow Step 2: implement edge detection / outlines
4. Follow Step 3: implement crosshatched shadows
5. Wire up controls (Step 5) so parameters are tunable
6. **Evaluate:** Screenshot comparison — toggle on/off, compare against current toon look

**Decision after evaluation:**
- **If the shader elevates the scene:** Keep it, adapt it. All subsequent environment work builds on this foundation. Many Phase 3 issues (boring ground, flat enclosure, placeholder sky feel) may be significantly improved by the visual treatment.
- **If the shader doesn't work or fights the emotion colors:** Revert, go back to tuning the toon approach. The PBR swap is easy to undo.
- **If it's somewhere in between:** Keep the outline detection, drop the crosshatching, layer our own color/shadow treatment on top.

**This is a 🔄 exploration with a hard exit:** If after 8 hours the pipeline isn't working or the visual result is clearly wrong, we stop and move to B2 without it.

**Note on performance:** The shader renders the scene 3x per frame. On M1 Max this should be fine, but it must be tested against the crash fix from A1. If it makes crashes worse, that's a dealbreaker.

---

### B2. Environment Design Session (Week 2, ~4-6 hours of design, then implementation)

Whether or not the shader is in play, we need to design the full environment as a unified system. This is the creative thinking phase that was missing from v1.

**The problems to solve simultaneously:**

1. **Daily mood needs to be immediately readable** — negative = beautiful/clear, positive = overcast/muted, and the difference must be obvious within seconds
2. **The sky/background needs to not be boring empty void** — but also not compete with the garden
3. **The floor (inside and outside enclosure) needs texture and life** — currently flat brown despite having noise code that doesn't appear to work
4. **The wall needs to be a composition element, not a centered text display** — it exists to break up the sky, anchor the scene, and occasionally display meaningful content
5. **Clouds need to serve the mood system, not be distracting** — constant shifting is the current problem; they should be a clear weather indicator
6. **God rays don't work** — either fix or replace with something that does

**Design questions to answer before implementing:**

**Composition:**
- Where does the wall go? (Offset to one side, angled?)
- Do we need additional structures? (Pillar, small secondary wall, gate, something to break up the sky on the other side?)
- What does the camera see when it first loads? What's the "establishing composition"?

**Atmosphere:**
- What channels communicate daily mood? Current system (clouds + floor glow + fog + broken god rays) is too subtle. What if we use fewer, bolder channels?
- Should sky itself change dramatically (clear blue vs. heavy grey overcast)?
- How does time-of-day interact with mood? (You said: communication over realism, just needs to feel like "middle of the day" etc.)

**Ground:**
- Why isn't the existing soil noise visible? (Need to check the code — is it just too subtle, or actually broken?)
- What would make the floor feel rich? Shader-based treatment, or geometric detail?
- The outside floor as mood indicator — is emissive glow the right approach, or should it be something else entirely?

**Wall behavior:**
- Wall is mostly quiet — just a structural element with texture
- Occasionally lights up with something meaningful: date at midnight, a phrase when valence hits thresholds, "Lorne's Emotional Garden" intermittently, symbols or patterns
- Multiple uses: it's a wall first, a display second
- Text isn't constant — it's an event, which makes it more noticeable when it happens

**Creative directions to explore (not exhaustive):**

For mood encoding, instead of trying to make 6 subtle parameters work together, consider:
- **One dominant channel with huge range**: e.g., sky goes from vivid saturated blue (negative/beautiful) to flat grey (positive/overcast). That alone might be enough.
- **Cloud coverage as the primary weather signal**: zero clouds vs. completely overcast. Binary-ish, not gradual.
- **Light quality, not just color**: hard directional shadows (beautiful day) vs. completely diffuse (overcast). This is dramatic and reads instantly.
- **Scene-wide saturation**: the whole world is vivid (negative) vs. desaturated (positive). This could be done in the shader.

For background/composition:
- The wall offset to one side + something on the other side (even just a distant silhouette shape) creates framing
- Fog/atmosphere at the far edges focuses attention on the garden center
- If the shader gives us outlines, even a simple ground plane looks "designed"

**Output of B2:** A design document (even if rough/sketched) describing what the scene looks like at: negative noon, neutral noon, positive noon, negative sunset, positive midnight. What's in the frame, what communicates what, and how elements work together.

---

### B3. Environment Implementation (Weeks 2-3)

Build what was designed in B2. The specific tasks depend on the design decisions, but likely includes:

**Atmosphere system overhaul:**
- Rework cloud system: fewer clouds, less motion, dramatic coverage range tied to mood
- Fix or replace sky: needs to feel like weather, not just a color gradient
- Fix or remove god rays (they're broken — either fix the actual bug or replace with an alternative like scene-wide brightness/saturation shift)
- Rework fog: currently too subtle, may need to be a major mood channel

**Composition elements:**
- Reposition wall (offset from center)
- Wall behavior: mostly static structure, occasional text events
- Wall texture/design refinement (elevate from Minecraft blocks)
- Potential additional structure(s) to frame the scene

**Ground:**
- Investigate why soil noise isn't visible, fix it
- Add visual richness to inside floor (texture, variation, depth)
- Rethink outside floor (if emissive glow isn't working, try something else)
- Enclosure wall: texture refinement (works with whatever ground treatment we choose)

**Time:** 8-12 hours implementation, spread across 1-2 weeks with testing between iterations

---

### B4. Mood System Validation

After B3, verify the core communication goal:

**Test:** Show the scene at 5 different mood levels to someone who hasn't seen it before. Can they tell you which is "good day" and which is "bad day" within a few seconds?

If not, identify which channels still aren't reading and iterate.

---

## Track C: Animation, UI & Polish

### On Animation Timing

You raised a good concern: should animation come earlier? Here's the tradeoff:

**Arguments for earlier:**
- Growth animation dramatically changes the visual focus and energy of the scene
- It might affect how we design atmosphere transitions (if flowers are growing during a mood shift, what does that look like?)
- The 1.5s duration was set in the brief but the test scene may have used something faster — we should verify

**Arguments for later:**
- Animation is additive — it doesn't change what the scene looks like at rest, just how things arrive
- If we do environment work and then animation breaks it, we've wasted time; but if we do animation first and then environment changes break the timing, same problem
- Environment is the bigger blocker (mood doesn't communicate at all; animation is nice-to-have for feel)

**Compromise:** **Integrate animation early in the build but after the shader decision (B1)** — because if we're swapping to PBR materials for the shader, the animated component needs to match. Do the material swap, then immediately test the animated flower component with the new materials. This gives us animation running alongside environment work rather than after it.

**Revised animation timing:**

### C1. Animation Integration (Week 2, parallel to B3)

1. After B1's material swap, update AnimatedToonFlower3D to use standard materials (if shader is adopted)
2. Integrate into main App.tsx alongside the static components
3. Test timeline interaction: scrub speed detection, overlap behavior
4. Verify the actual animation speed — brief says 1.5s but test scene may be faster (the overlapping phase config in the code shows stem: 0-50%, leaves: 25-70%, bloom: 60-100% — total wall-clock time needs checking)

### C2. UI Redesign (Week 3-4)

**On font:** You're right that layout/structure should come before font choice. The font (LjNeuev2.otf, in the Mood Garden Build folder) applies to UI elements only — menus, dropdowns, headings, info panels — not in-scene assets like the LED wall.

**Approach:**
1. First: decide what UI elements are needed and rough layout
   - Timeline: what info does it show? Just scrub + play/pause, or also date, time, mood indicator?
   - Plant info: click-to-show panel design — what data, what size, where on screen?
   - What else? Entry count? Any persistent indicators?
2. Then: design the layout and structure
3. Then: apply the font and visual styling
4. Consider: how much UI should there be? This is an art piece, not an app. Less may be more.

**Time:** 4-6 hours total

### C3. Camera & Composition (Week 3-4, after environment is set)

- Opening view: lower, pushed down, angled to show the composition from B2
- Movement restrictions: test after everything visual is in place
- Potentially: establish camera positions that showcase the wall offset, the garden depth, the atmosphere

### C4. Sprout Animation (Week 4)

Adapt flower animation for sprouts. Decay animation deferred until decay visual is finalized.

---

## Revised Timeline

```
WEEK 1
├── A1: Performance / crash fix [CRITICAL]
├── A2: Documentation audit [parallel]
├── A3: Quick wins (scale calibration, remove garden level bar) [parallel]
└── B1: Shader decision — implement Moebius pass, evaluate [starts mid-week]

WEEK 2
├── B1: Complete shader evaluation, make go/no-go decision
├── B2: Environment design session (unified design for atmosphere, mood,
│        composition, ground, wall, clouds — all as one system)
├── B3: Begin environment implementation
└── C1: Animation integration (after material swap from B1)

WEEK 3
├── B3: Continue environment implementation
├── B4: Mood system validation (does daily mood read?)
├── C2: UI redesign (layout → structure → styling → font)
└── C3: Camera positioning

WEEK 4
├── Polish and iteration based on B4 results
├── C4: Sprout animation
├── Cross-system integration testing
└── Bug fixes, edge cases
```

---

## Key Decisions That Need to Be Made

These aren't "open questions" for later — they're decisions that need to happen during the process:

| Decision | When | Made By |
|----------|------|---------|
| Keep shader, drop it, or keep partial? | End of B1 | Lorne (based on visual comparison) |
| Wall position and behavior design | During B2 | Lorne + Claude |
| What channels communicate daily mood | During B2 | Lorne + Claude |
| Additional structures needed? | During B2 | Lorne + Claude |
| Animation speed — verify actual vs. spec | Start of C1 | Check code |
| How much UI is right for an art piece? | Start of C2 | Lorne |

---

## What I Got Wrong in v1

For honesty and to avoid repeating mistakes:

1. **Treated interconnected problems as sequential tasks.** Mood, atmosphere, sky, clouds, floor, and composition are one design problem.
2. **Assumed current code was working as described.** Soil noise isn't visible. God rays are broken. Need to verify before prescribing fixes.
3. **Put the shader at the end as "optional."** Given it could resolve multiple issues simultaneously and you'd already written a full implementation spec, it should be evaluated first.
4. **Described the wall's purpose incorrectly.** It's a composition element that breaks up the sky, not a mood indicator. The mood is in the individual flowers.
5. **Proposed parameter tweaking before creative thinking.** "Make fog 20% denser" is a fine-tuning move, not a design move. The design might need to be fundamentally different.
6. **Deferred clouds to a separate phase.** They're the primary weather signal for daily mood — inseparable from mood encoding.
7. **Was too conservative about the wall.** Your ideas about it being mostly quiet, then occasionally lighting up with meaningful/whimsical content — date flashes, threshold messages, the title — that's much more interesting than a constant text display.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Shader adds 3x render cost, worsens crashes | High | Test immediately after A1 fix, have kill switch |
| Unified environment redesign takes too long | High | Set 2-week timebox; ship "good enough" and iterate |
| Animation integration conflicts with material swap | Medium | Do material swap first, then animate — sequence is clear |
| Mood still doesn't read after redesign | High | B4 validation catches this; have backup plan of more dramatic channels |
| Wall repositioning breaks existing camera constraints | Low | Camera constraints are adjustable; redesign together in B2 |
| Creative direction disagreements stall B2 | Medium | Make B2 time-limited; pick a direction and iterate rather than deliberating |

---

## Files Reference

**Core:**
- `garden/src/App.tsx` — Main scene
- `garden/src/components/environment/SpecimenVitrine.tsx` — Environment composite
- `garden/src/components/AnimatedToonFlower3D.tsx` — Growth animation

**Atmosphere (all need evaluation in B2/B3):**
- `garden/src/components/environment/ProceduralSky.tsx`
- `garden/src/components/environment/ToonClouds.tsx`
- `garden/src/components/ExcavatedBed.tsx`

**New in this plan:**
- `inverse-garden-moebius-pass-spec.md` — Shader implementation spec (in docs folder)
- `LjNeuev2.otf` — Custom font (in Mood Garden Build root)

**Config:**
- `garden/src/config/environmentConfig.ts` — Tunable parameters

---

*This plan prioritizes making one good decision (B1: shader yes/no) that unlocks everything else, followed by one integrated design effort (B2) rather than isolated fixes. Update as decisions are made.*
