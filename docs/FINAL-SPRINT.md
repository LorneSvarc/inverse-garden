# Inverse Garden: Final Sprint

## Document Information

**Status:** Active — Working Document
**Updated:** March 4, 2026
**Reference:** `docs/inverse-garden-gdd-v4.0.md` (canonical spec — read first every session)
**Purpose:** Track remaining tasks to get Inverse Garden exhibition-ready

---

## Instructions for Claude Code

1. **Read `docs/inverse-garden-gdd-v4.0.md` first** at the start of every session for full project context.
2. **Update this document** as tasks are completed, decisions are made, or new issues are discovered.
3. **Any item that gets deferred, pushed forward, or deemed out of scope** must be moved to the "Deferred to Polish Sprint" section at the bottom of this document. Nothing gets silently dropped.
4. **When things are unclear or contradictory, stop and ask Lorne.** Do not guess.
5. **Log decisions** in the "Decisions Made During Sprint" section as they happen.

---

## Task Sequence

### 1. Shader Decision Point — DEFERRED

**What:** Implement the Moebius-style post-processing pass and evaluate whether it becomes the visual foundation.

**Build spec:** `docs/inverse-garden-moebius-pass-spec.md` (follow steps 0–5)

**Steps:**
- [x] Step 0: Swap toon materials → standard PBR (preserve all color values)
- [x] Step 1: Scaffold custom pass, get red-tint test working
- [x] Step 2: Edge detection / outlines with hand-drawn wobble
- [x] Step 3: Crosshatched shadows
- [x] Step 5: Wire up tunable uniforms (outline thickness, depth multiplier, etc.)
- [x] Screenshot comparison: toggle on/off against current toon look
- [x] **CHECK WITH LORNE:** Show comparison. Go/no-go is a gut-feel visual evaluation.

**Decision: DEFERRED** — Moebius outlines looked promising but the three-stdlib EffectComposer pipeline introduced an unresolvable brightness mismatch (scene significantly darker with pass enabled). After multiple fix attempts (NoToneMapping, manual ACES + sRGB in shader, exposure compensation), brightness still didn't match. All changes reverted — materials back to meshToonMaterial, postprocessing files deleted, App.tsx restored to pre-Moebius state. See Decisions log below.

**Reverted to:** Commit `80be93e` (pre-Moebius state). No files changed.

---

### 2. Scale Calibration 🔶 IN PROGRESS — REVISIT LATER

**What:** Fix flower scale distribution so valence intensity reads clearly. Scale IS the primary valence signal — if it doesn't communicate, the encoding is weak.

**Problem:** Low-percentile flowers (0–10%) all look similar in size. The linear percentile→scale mapping doesn't create enough distinction at the small end.

**Steps:**
- [x] Try non-linear curve: applied `percentile^0.7` power curve to spread out the low end
- [ ] Try tighter range: e.g., 0.6–1.3 instead of 0.4–1.8
- [ ] Test with full dataset — compare visual size distribution before/after
- [ ] Also evaluate FallenBloom scale range (1.0–3.6) — is this too wide?
- [ ] **CHECK WITH LORNE:** Show before/after of garden at various timeline points

**Change made (2026-03-02):** Replaced linear `percentileToScale()` with `Math.pow(t, 0.7)` power curve in `percentileCalculator.ts`. Endpoints unchanged (flower 0.4–1.8, sprout 0.8–1.0, decay 1.0–3.6), but low-end plants are more spread out. Lorne's initial assessment: "seems ok" — needs re-evaluation after Tasks 3/4 when scene composition and plant variance may change how scale reads.

**⚠️ REVISIT:** Re-evaluate scale curve, min/max ranges, and FallenBloom range after Camera/Layout Phase 1 (new positioning system changes spatial context), plant variance (Task 3), and scene redesign (Task 4) are in place. Those changes may affect how scale reads visually.

**Done when:** Clear visual size distinction across the percentile range. Lorne confirms it reads well.

---

### 3. Plant Parameter Variance ⬜ NOT STARTED

**What:** Right now every flower looks identical, every sprout looks identical, every FallenBloom looks identical (aside from color and scale). The DNA system supports procedural variation via parameters like petal curvature, stem bend, leaf angle, leaf size, etc. — but everything is locked to defaults.

**Goal:** Seeded pseudo-randomization from entry timestamps, using defaults as midpoints. Same entry always produces the same plant. The garden should feel diverse and alive while still doing its data-vis job.

**Key constraint:** Some parameters are encoding-critical (petal colors = emotions, stem colors = associations, scale = valence). These CANNOT vary. Other parameters (petal curvature, stem bend, leaf angle) can vary freely. Some (petal count, petal length/width) may have narrow safe ranges before plants look broken.

**Steps:**
- [ ] Review all DNA parameters for each component type (Flower, Sprout, FallenBloom)
- [ ] Classify each parameter: locked (encoding), free (visual variety), constrained (narrow range)
- [ ] Implement seeded randomization using entry timestamp as seed
- [ ] **CHECK WITH LORNE:** Show a garden full of varied plants. Too loose? Too tight? Weird shapes?
- [ ] Iterate on ranges based on feedback

**Done when:** Garden has visible plant variety. No broken/weird shapes. Encoding still reads clearly.

---

### Camera, Layout & Data Display ⬜ NOT STARTED

**What:** Three sequential phases that transform the garden from a flat scatter into a multi-level storytelling experience with temporal structure, semantic zoom, and museum-label data cards.

**Build spec:** `docs/inverse-garden-camera-layout-spec.md` (follow Phases 1→2→3 in order)

**Relationship to other tasks:**
- **Replaces Task 7** (Spatial Layout) — Phase 1's week-per-row temporal layout IS the spatial layout solution.
- **Partially overlaps Task 4A** — Phase 1 handles plant positioning only. Task 4A's open questions about wall placement, enclosure design, additional framing structures, and how spatial elements relate to each other remain unresolved.
- **Partially overlaps Task 6** — Phase 3 handles plant/day/week data cards (replacing the plant inspection panel). Task 6 still owns: timeline UI evaluation, LjNeuev2.otf font application, garden level bar decisions, overall visual design language, and UI density review.

---

#### Phase 1: Positioning System Rewrite ⬜

**What:** Replace the patch-based jittered grid with a calendar-structured week-per-row layout. Calendar weeks as rows (back-to-front, newest closest to camera), days as slots (left-to-right Monday–Sunday), entries clustered within day slots.

**Key constraints:**
- PLANT_BOUNDS (34 × 28) and GROUND_BOUNDS (36 × 30) do NOT change
- `calculatePositions()` function signature preserved: `(entries) → Map<id, [x,y,z]>`
- Seeded PRNG utilities (`createSeededRandom`, `timestampToSeed`, `dateStringToSeed`) kept and reused
- `patchConfig.ts` deleted — replaced by new `LAYOUT_CONFIG` in `environmentConfig.ts`

**Steps:**
- [ ] Pre-calculate day/week summaries (DaySummary, WeekSummary interfaces)
- [ ] Implement week-per-row layout math (rowZ per week, slotX per day, entry clusters within slots)
- [ ] Delete patch-based code (`generatePatches`, `orderPatchesSerpentine`, `positionEntriesInPatch`, `simulateTimeline`)
- [ ] Delete `patchConfig.ts`, add `LAYOUT_CONFIG` to `environmentConfig.ts`
- [ ] Validate: plants stay inside PLANT_BOUNDS, no overlapping, same entry always gets same position
- [ ] **CHECK WITH LORNE:** Does the temporal structure read? Do weeks/days feel distinct?

**Done when:** Garden shows clear week rows and day clusters. Timeline scrub fills rows chronologically. Lorne confirms.

---

#### Phase 2: Camera Zoom System ⬜

**Depends on:** Phase 1 (needs week/day structure to know where to zoom)

**What:** Four semantic zoom levels — Garden (full view), Week (one row), Day (one slot), Plant (single plant close-up). Smooth animated transitions via lerp. Per-level OrbitControls constraints.

**Steps:**
- [ ] Define CameraState interface (level, target, distance, polar/azimuth angles, damping)
- [ ] Implement Level 0 (Garden): full bed visible, current OrbitControls behavior
- [ ] Implement Level 1 (Week): click week row → camera moves to show that row
- [ ] Implement Level 2 (Day): click day cluster → camera zooms to that slot
- [ ] Implement Level 3 (Plant): click plant → close-up, slow orbit
- [ ] Animated transitions (lerp position + target over ~0.8s)
- [ ] Navigation: scroll/pinch to zoom in, Escape/click-away to zoom out, breadcrumb trail
- [ ] **CHECK WITH LORNE:** Do transitions feel smooth? Are zoom levels useful?

**Done when:** All four levels work with smooth transitions. Navigation is intuitive. Lorne confirms.

---

#### Phase 3: Data Display Cards ⬜

**Depends on:** Phase 2 (cards appear at specific zoom levels)

**What:** React DOM overlay cards that show plant/day/week data using the project's emotion and association color maps. Museum-label aesthetic — no raw numbers visible to viewers.

**Steps:**
- [ ] Implement Level 3 plant card (classification badge, emotion pills in hex colors, association pills, timestamp)
- [ ] Implement Level 2 day card (date, entry count, dominant emotion, mood indicator)
- [ ] Implement Level 1 week card (week range, entry count, dominant emotion, mood trend)
- [ ] Card styling: dark semi-transparent background, rounded corners, consistent typography hierarchy
- [ ] Remove default dev panel from viewer experience (keep accessible via hotkey)
- [ ] **CHECK WITH LORNE:** Card design, info density, visual feel

**Done when:** Cards appear at correct zoom levels with correct data. Museum-label feel. Lorne approves.

---

### 4. Scene Redesign ⬜ NOT STARTED

**What:** The core creative challenge. Environment, atmosphere, composition, and mood encoding are all one interconnected design problem. They cannot be solved sequentially in isolation — wall position depends on sky, sky depends on composition, ground glow is literally mood encoding, ground treatment looks different under different lighting.

**Approach:** Iterative design rounds with checkpoints. Each round builds on the previous but can revisit earlier decisions.

---

#### 4A. Round 1: Rough Composition ⬜

**What:** Get the spatial relationships roughed in. "What does this space look like as a physical place?" Don't tune anything — just get things approximately placed.

**Note:** Plant positioning is now handled by Camera/Layout Phase 1 (week-per-row temporal layout). This task focuses on the non-plant compositional elements: wall, enclosure, framing structures, and how they relate to the new row-based plant layout.

**Questions to answer with Lorne:**
- Where does the wall go? Currently centered at [0, 10, -30]. Offset to one side? Angled? How does it relate to the week rows?
- Do we need additional structures to frame the scene? (Pillar, secondary wall, gate?)
- What does the camera see when it first loads? What's the establishing shot? (Camera/Layout Phase 2 defines zoom levels, but the default Level 0 framing is a composition question.)
- Is the ExcavatedBed (raised bed with organic walls) the right ground containment, or does it need rethinking?
- How do the non-plant elements relate to the new row structure?

**Steps:**
- [ ] Start with neutral, flat lighting (no time-of-day, no mood response)
- [ ] Experiment with wall position and camera framing
- [ ] **CHECK WITH LORNE:** "Does this feel like a space?" Iterate on position/framing.
- [ ] Lock rough composition before moving to Round 2

**Done when:** Lorne says "this feels like a coherent space, move on to lighting."

---

#### 4B. Round 2: Light & Sky ⬜

**What:** Make time-of-day readable. Noon should look like noon, sunset like sunset, night like night. No mood response yet — just the time axis.

**Questions to answer with Lorne:**
- Does the current ProceduralSky work, or does it need replacement?
- How dramatic should the time-of-day shift be? (Communication over realism)
- How does the sky interact with the composition from Round 1? Enough sky visible?
- Night handling: how dark? Moonlight? Do we need to handle night at all for exhibition?

**Steps:**
- [ ] Get sky responding to time of day (may need ProceduralSky rework depending on shader decision)
- [ ] Get lighting matching sky (sun arc, shadow direction, color temperature)
- [ ] Test full time sweep: morning → noon → dusk → night
- [ ] Revisit Round 1 decisions if needed (wall might need moving based on sky visibility)
- [ ] **CHECK WITH LORNE:** "Can you tell what time of day it is?" Iterate.

**Done when:** Time-of-day reads clearly at a glance.

---

#### 4C. Round 3: Mood Encoding ⬜

**What:** Layer on the dynamic atmosphere. The million-dollar question: can a viewer tell a good day from a bad day within seconds?

**The inversion to communicate:**
- Negative daily mood = clear, beautiful, bright
- Positive daily mood = gloomy, overcast, muted

**Design principle from addendum:** Consider fewer, bolder channels rather than six subtle ones. One dominant channel with huge range may be more readable than many small shifts.

**Channels available:**
- Cloud coverage (none ↔ completely overcast)
- Sky color/saturation (vivid blue ↔ flat grey)
- Light quality (hard directional shadows ↔ completely diffuse)
- Scene-wide saturation (vivid ↔ desaturated) — could be done in shader if Moebius pass is active
- Floor glow (outside bed) — currently warm ↔ cool, but "doesn't convey much"
- Fog density (if we decide fog is worth keeping)

**Steps:**
- [ ] Decide which channels to use and how bold to make them
- [ ] Implement mood response on chosen channels
- [ ] Test: scrub timeline across days with different Daily Mood valences
- [ ] Revisit Round 1/2 decisions if mood encoding changes what's needed
- [ ] **CHECK WITH LORNE:** "Show this to someone who hasn't seen it. Can they tell good day from bad day in seconds?"
- [ ] Iterate on channel intensity/range until mood reads

**Done when:** Mood communicates at a glance. Lorne confirms.

---

### 5. Animation Integration ⬜ NOT STARTED

**What:** Growth animations make plants feel alive instead of just appearing. Flower animation exists in test scene but isn't in the main scene. Sprout and FallenBloom animations need to be created.

**Materials:** meshToonMaterial (Moebius pass was deferred, PBR swap was reverted). AnimatedToonFlower3D already uses toon materials — no material changes needed.

**Steps:**

**Flower (port existing):**
- [ ] Integrate AnimatedToonFlower3D into main App.tsx (replace static CleanToonFlower3D for newly-appearing plants)
- [ ] Verify timeline interaction: scrub speed detection, fast-scrub snap to final state
- [ ] Confirm animation speed at 2.7x (~0.74s total) still feels right in context

**Sprout (create new):**
- [ ] Implement per-phase animation: stem → cotyledons → bud (overlapping phases like flower)
- [ ] Target ~0.59s at 2.7x speed
- [ ] Test alongside flower animation — should feel proportionally right

**FallenBloom (create new):**
- [ ] **DECIDE WITH LORNE:** Animation approach — fall from above (A), materialize in place (B), or wilt/collapse (C)
- [ ] Implement chosen approach
- [ ] Test timing and feel

**Done when:** All three plant types animate in on timeline scrub. Fast scrub skips animations. Reverse scrub removes plants cleanly.

---

### 6. UI & Interaction ⬜ NOT STARTED

**What:** This is an art piece, not an app. UI should be minimal but functional.

**Note:** Plant/day/week data cards are handled by Camera/Layout Phase 3. This task covers everything else: timeline, font, visual style language, and overall UI density.

**Steps:**

**Timeline:**
- [ ] Evaluate current timeline UI — is it clear enough for viewers?
- [ ] What info does it show? Just scrub + play/pause, or also date, mood indicator?

**Visual Design:**
- [ ] Apply LjNeuev2.otf font to UI elements (menus, headings, info panels — NOT in-scene assets like LED wall)
- [ ] Remove garden level bar from main UI (keep in dev panel only)
- [ ] Overall: how much UI is right? Less is more for an art piece.
- [ ] **CHECK WITH LORNE:** Review UI layout and density

**Done when:** UI supports the experience without competing with it. Plant inspection works. Lorne approves the look.

---

### 7. Spatial Layout Refinement — ABSORBED

**Absorbed by:** Camera/Layout Phase 1 (Positioning System Rewrite). The week-per-row temporal layout directly solves the temporal grouping problem this task was created to address. See `docs/inverse-garden-camera-layout-spec.md`.

---

## Decisions Made During Sprint

*Log decisions here as they happen. Include date, what was decided, and why.*

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-19 | **Shader: DEFERRED** — Moebius post-processing pass fully reverted. All code removed, materials back to meshToonMaterial. | Outlines themselves looked good (hand-drawn illustration feel, plant silhouettes pop). But the three-stdlib EffectComposer pipeline couldn't achieve brightness parity with the normal render path. Root cause: EffectComposer's intermediate render targets + double tone mapping/sRGB encoding. Multiple fix attempts failed (manual ACES in shader, sRGB compensation, exposure bumps 0.9→1.3). Sky and highlights remained visibly darker. PBR material swap was also reverted since it was never validated independently. Could revisit with @react-three/postprocessing Effect class or different approach in Polish Sprint. |
| 2026-03-02 | **Scale: Power curve applied, revisit later** — `percentileToScale()` changed from linear to `t^0.7`. Initial look OK but needs re-evaluation after Tasks 3/4. | Linear mapping made low-percentile plants indistinguishable. Power curve spreads low end (percentile 10 flower: 0.54→0.67 scale). Min/max ranges and FallenBloom range (1.0–3.6) still need evaluation with full scene context. |
| 2026-03-04 | **Camera/Layout/Data Display spec adopted** — New task block added between Tasks 3 and 4. Task 7 absorbed by Phase 1. | Lorne's `Inverse-Garden-Camera-Layout-Plan.docx` defines week-per-row temporal layout, four-level camera zoom, and museum-label data cards. Phase 1 (positioning rewrite) is foundational — camera system and data display depend on it. Spec: `docs/inverse-garden-camera-layout-spec.md`. Partial overlap with Tasks 4A (composition) and 6 (UI) properly scoped — those tasks retain their non-overlapping responsibilities. |

---

## Deferred to Polish Sprint

Items not in scope for this sprint. This list grows as the sprint progresses — any task that gets deferred, descoped, or pushed forward MUST be added here.

| Item | Why Deferred | Notes |
|------|-------------|-------|
| LED wall per-brick text transitions | InstancedMesh needs per-instance color attribute | Currently all-at-once, needs single InstancedMesh rewrite |
| Fog as major feature | Unlikely to make final — nearly invisible at current density | Could revisit if mood encoding needs another channel |
| Targeted bloom | May have a use-case but not a priority | Was disabled during Phase 5 diagnostic |
| Plant sinking on fade | Mentioned in animation brief, never built | Y-axis translation driven by garden level |
| 60fps lighting smoothness | Would need useFrame-driven sun/lighting | Currently 20fps prop updates, minor choppiness |
| FallenBloom petal clipping | Multi-petal card-deck layout still clips with curl | Aesthetic issue, not functional |
| Cross-browser testing | Final pass before exhibition | Safari memory limits, Chrome compatibility |
| Particle effects | Original GDD Phase 4 item | Never implemented, low priority |
| Plant parameter variance: petal rows | May need investigation separately from general variance | Could produce weird shapes if varied too freely |

---

*This is the active working document for the Inverse Garden final sprint. Update it every session.*
