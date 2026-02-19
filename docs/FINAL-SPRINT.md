# Inverse Garden: Final Sprint

## Document Information

**Status:** Active — Working Document
**Updated:** February 19, 2026
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

### 1. Shader Decision Point ⬜ NOT STARTED

**What:** Implement the Moebius-style post-processing pass and evaluate whether it becomes the visual foundation.

**Build spec:** `docs/inverse-garden-moebius-pass-spec.md` (follow steps 0–5)

**Steps:**
- [ ] Step 0: Swap toon materials → standard PBR (preserve all color values)
- [ ] Step 1: Scaffold custom pass, get red-tint test working
- [ ] Step 2: Edge detection / outlines with hand-drawn wobble
- [ ] Step 3: Crosshatched shadows
- [ ] Step 5: Wire up tunable uniforms (outline thickness, depth multiplier, etc.)
- [ ] Screenshot comparison: toggle on/off against current toon look
- [ ] **CHECK WITH LORNE:** Show comparison. Go/no-go is a gut-feel visual evaluation.

**Decision outcomes:**
- **Keep:** All subsequent work builds on PBR + post-process. Adapt the pass for Inverse Garden.
- **Keep partial:** Keep outlines, drop crosshatching, layer own treatment on top.
- **Revert:** Go back to toon materials, move to Task 2.

**Hard exit:** If the pipeline isn't working or the visual result is clearly wrong, stop and move on.

**Performance check:** The shader renders the scene 3x per frame. Must not re-introduce the memory crashes fixed in the stability phase. Test on Safari.

**Done when:** Lorne has made the keep/partial/revert decision and it's logged below in Decisions.

---

### 2. Scale Calibration ⬜ NOT STARTED

**What:** Fix flower scale distribution so valence intensity reads clearly. Scale IS the primary valence signal — if it doesn't communicate, the encoding is weak.

**Problem:** Low-percentile flowers (0–10%) all look similar in size. The linear percentile→scale mapping doesn't create enough distinction at the small end.

**Steps:**
- [ ] Try non-linear curve: `percentile^0.8` compression (or similar) to spread out the low end
- [ ] Try tighter range: e.g., 0.6–1.3 instead of 0.4–1.8
- [ ] Test with full dataset — compare visual size distribution before/after
- [ ] Also evaluate FallenBloom scale range (1.0–3.6) — is this too wide?
- [ ] **CHECK WITH LORNE:** Show before/after of garden at various timeline points

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

### 4. Scene Redesign ⬜ NOT STARTED

**What:** The core creative challenge. Environment, atmosphere, composition, and mood encoding are all one interconnected design problem. They cannot be solved sequentially in isolation — wall position depends on sky, sky depends on composition, ground glow is literally mood encoding, ground treatment looks different under different lighting.

**Approach:** Iterative design rounds with checkpoints. Each round builds on the previous but can revisit earlier decisions.

---

#### 4A. Round 1: Rough Composition ⬜

**What:** Get the spatial relationships roughed in. "What does this space look like as a physical place?" Don't tune anything — just get things approximately placed.

**Questions to answer with Lorne:**
- Where does the wall go? Currently centered at [0, 10, -30]. Offset to one side? Angled?
- Do we need additional structures to frame the scene? (Pillar, secondary wall, gate?)
- What does the camera see when it first loads? What's the establishing shot?
- Is the ExcavatedBed (raised bed with organic walls) the right ground containment, or does it need rethinking?
- How do the plants relate to the wall? Close? Far? Asymmetric?

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

**Dependency:** Must happen after shader decision (Task 1) settles the material system. If Moebius pass is kept, AnimatedToonFlower3D needs to use standard materials.

**Steps:**

**Flower (port existing):**
- [ ] If shader kept: update AnimatedToonFlower3D to use meshStandardMaterial
- [ ] Integrate into main App.tsx (replace static CleanToonFlower3D for newly-appearing plants)
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

**Steps:**

**Plant Inspection (important):**
- [ ] Design click-to-inspect panel — what data to show (timestamp, emotions, associations, valence, classification)
- [ ] Panel size, position, visual design
- [ ] **CHECK WITH LORNE:** How much info? What layout?

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

### 7. Spatial Layout Refinement ⬜ NOT STARTED

**What:** Current spiral + scatter layout works but doesn't clearly communicate temporal groupings. Plants from the same day or week aren't obviously clustered.

**Steps:**
- [ ] Evaluate current layout with full dataset — how clear is the temporal structure?
- [ ] Experiment with tighter day clustering, clearer week boundaries
- [ ] Balance: temporal clarity vs natural/organic feel (too structured = grid-like, too loose = random)
- [ ] Consider how layout interacts with scene composition from Task 4
- [ ] **CHECK WITH LORNE:** Does the temporal flow read? Can you sense "this area is one week"?

**Done when:** Temporal structure is visible to attentive viewers without feeling artificial.

---

## Decisions Made During Sprint

*Log decisions here as they happen. Include date, what was decided, and why.*

| Date | Decision | Rationale |
|------|----------|-----------|
| | | |

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
