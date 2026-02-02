# Daily Valence Encoding & Atmosphere System

## Document Information

**Version:** 0.2  
**Status:** In Development - Testing Sky Approaches  
**Created:** January 2025  
**Last Updated:** January 28, 2025  
**Purpose:** Define how daily mood valence is communicated through weather/atmosphere

---

## Core Concept

Daily valence entries affect the overall atmosphere and weather of the garden scene. This is separate from individual plant encoding (where emotions → flower colors, etc.). The atmosphere creates the environmental context that all plants exist within.

### The Inversion Applied to Weather

| Daily Valence | Weather | Visual Result |
|---------------|---------|---------------|
| Negative (Very Unpleasant → Slightly Unpleasant) | Clear, beautiful day | Bright sun, sharp shadows, blue sky, minimal clouds |
| Neutral | Overcast | Soft diffuse light, no harsh shadows, cloud-covered sky |
| Positive (Slightly Pleasant → Very Pleasant) | Gloomy / Rainy | Dark, heavy clouds, muted colors, possibly rain |

This maintains the project's core inversion: difficult emotions get beautiful representation (clear skies), while positive emotions get muted/somber representation (gloom).

---

## System Components

### 1. Sky System
**Status:** Testing approaches

The sky needs to:
- Respond to time of day (sun position/color)
- Look stylized to match toon-shaded flowers
- Serve as backdrop that clouds will partially obscure
- Work with the enclosed courtyard environment (wall blocks most of sky, only strip visible above)

### 2. Cloud System  
**Status:** Planned - Phase 2

- Cloud coverage density controlled by daily valence
- Negative valence → few/no clouds (clear sky visible)
- Neutral valence → moderate cloud coverage
- Positive valence → heavy cloud coverage (most of sky obscured)
- Clouds styled to match aesthetic (toon-shaded geometry)

### 3. Light Quality System
**Status:** Planned - Phase 2

- Works in coordination with clouds
- Clear day: strong directional sun, sharp shadows, high contrast
- Overcast: soft diffuse lighting, minimal/soft shadows, lower contrast
- Gloomy: very low light, no distinct shadows, muted

### 4. Atmospheric Effects
**Status:** Planned - Phase 3 (if needed)

- Fog density increases with positive valence (gloomy conditions)
- Color of fog/atmosphere shifts (blue-grey for gloom)
- Helps sell the weather state

### 5. Rain Particles
**Status:** Planned - Phase 4 (if needed)

- Only for highly positive valence days (most gloomy)
- Particle system for falling rain
- May not be necessary if clouds + light + fog read well enough

---

## Sky Approaches Tested

### Attempt 1: Static Skybox (Blockade Labs)
**Result:** ❌ Rejected

- Used equirectangular JPG mapped onto sphere with `meshBasicMaterial`
- Problems:
  - Sky didn't respond to lighting at all
  - Garden felt disconnected - lit scene against static backdrop
  - Mismatch between sunny garden and unchanging sky was jarring
  - Would require multiple skybox images + crossfading for time of day
  - Still wouldn't solve the lighting disconnect

### Attempt 2: Toon-Shaded Sky Dome (lit by sun)
**Result:** ❌ Rejected

- Sphere with `meshToonMaterial` and same gradient as flowers
- Idea: Let sun light the sky naturally like any other object
- Problems:
  - Sky was lit like a solid object, not like a sky
  - Created weird moving band of light across the dome as sun moved
  - Looked like a painted ball, not atmospheric scattering
  - Real skies don't work this way - they ARE scattered light, not lit surfaces

### Attempt 3: Toon-Shaded Dome with Emissive (current test)
**Status:** 🧪 Testing

- Same sphere with `meshToonMaterial`
- Added `emissive` property so sky is partially self-lit
- Theory: Base emissive glow provides consistent brightness, toon shading adds subtle variation
- `emissiveIntensity` can be tuned (0.5 as starting point)
- Waiting on results

### Potential Future Approaches (if current test fails)

**Procedural Gradient Sky:**
- Programmatically define sky colors based on time of day
- Colors shift automatically as sun position changes
- Risk: Two separate systems (sun position vs sky color) that must stay in sync
- Could use banded gradients for stylized look

**Hybrid Approach:**
- Simple emissive/gradient sky for base
- Add a visible "sun" object (glowing sphere/disk) at sun position
- Clouds as separate toon-shaded geometry in front

---

## Environment Context

The sky exists within an enclosed courtyard setup:
- Back wall (brick texture) blocks most of the view
- Wall is tall enough that camera can't see over it at normal angles
- Only a strip of sky visible above the wall
- This actually helps - less sky visible = less disconnect to notice
- Ground plane extends from garden to walls

This enclosure was chosen because:
- Creates intimate, focused feel (not vast open world)
- Wall receives same lighting as garden (unified scene)
- Reduces how much "sky problem" we need to solve
- Matches the diorama/curated viewing aesthetic

---

## Implementation Order

### Phase 1: Sky Foundation (Current)
Get a sky that:
- Looks acceptable at different times of day
- Doesn't fight the lighting system
- Provides backdrop for future cloud system

### Phase 2: Clouds + Light Quality
- Cloud geometry with toon shading
- Density responds to valence
- Light softens as cloud coverage increases

### Phase 3: Fog/Atmosphere (if needed)
- Density and color respond to valence

### Phase 4: Rain (if needed)
- Particle effect for highly positive valence days

---

## Technical Notes

### Time vs Valence: Two Separate Axes

**Time of day** controls:
- Sun position
- Sun intensity and color
- Sky appearance (time-based shifts)

**Daily valence** controls:
- Cloud coverage
- Shadow softness / light diffusion
- Fog density
- Rain presence

These combine independently. A negative valence day at sunset = clear sky with sunset colors. A positive valence day at noon = gloomy overcast even though sun would be high.

### Night Time Handling

Current issue: At night (sun below horizon), weird shadows cast upward onto wall.
Solution needed: Disable shadows or reduce directional light when sun Y < 0.

---

## Open Questions

- [ ] Does the emissive sky dome approach work?
- [ ] How to handle night lighting properly (disable shadows? switch to ambient-only?)
- [ ] How quickly should weather transition when scrubbing timeline across days with different valence?
- [ ] Should there be any randomization/variation in weather, or purely deterministic from valence?
- [ ] Performance implications of cloud geometry + potential particles

---

## Risk Assessment

| Component | Difficulty | Risk Level |
|-----------|------------|------------|
| Sky that looks good | Medium | Medium-High (multiple attempts so far) |
| Cloud geometry | Medium | Medium |
| Light quality shifts | Low | Low |
| All components unified | Medium-High | Medium-High |
| Fog | Low-Medium | Low |
| Rain particles | Medium-High | Medium-High |

**Highest risk:** Getting the sky right, and all weather components feeling unified rather than separate effects.

---

*This document will be updated as testing continues.*
