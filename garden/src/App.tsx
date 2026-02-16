import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { MoodEntryWithPercentile, PlantDNA } from './types';
import { parseCSVWithPercentiles } from './utils/csvParser';
import { entryToDNA, getPlantType } from './utils/dnaMapper';
import { calculatePositions, calculatePositionsWithDebug, type PatchDebugInfo } from './utils/positionCalculator';
import { calculateGardenLevel } from './utils/gardenLevel';
import { calculateFadeState, type FadeState } from './utils/plantFading';
import { SpecimenVitrine } from './components/environment/SpecimenVitrine';
import { PostProcessing } from './components/environment/PostProcessing';
import { CAMERA_LIMITS } from './config/environmentConfig';
import CleanToonFlower3D from './components/CleanToonFlower3D';
import CleanToonSprout3D from './components/CleanToonSprout3D';
import FallenBloom3D from './components/FallenBloom3D';
import TimelineControls from './components/TimelineControls';
import PatchDebugOverlay from './components/PatchDebugOverlay';
import TestScene from './components/TestScene';
import AtmospherePlayground from './components/AtmospherePlayground';
import EnvironmentTest from './components/EnvironmentTest';
import ExhibitTest from './components/ExhibitTest';
import NewEnvironmentTest from './components/NewEnvironmentTest';
import VitrineTest from './components/VitrineTest';
import FallenBloomGenerator from './components/FallenBloomGenerator';
import './App.css';

/**
 * Check if test mode is enabled via URL parameter
 */
function isTestMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('test') === 'true';
}

/**
 * Check if environment test mode is enabled via URL parameter
 */
function isEnvironmentTestMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('test') === 'environment';
}

/**
 * Check if exhibit test mode is enabled via URL parameter
 */
function isExhibitTestMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('test') === 'exhibit';
}

/**
 * Check if new environment test mode is enabled via URL parameter
 */
function isNewEnvironmentTestMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('test') === 'newenv';
}

/**
 * Check if vitrine test mode is enabled via URL parameter
 */
function isVitrineTestMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('test') === 'vitrine';
}

/**
 * Check if playground mode is enabled via URL path
 */
function isFallenBloomTestMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('test') === 'fallenbloom';
}

function isPlaygroundMode(): boolean {
  return window.location.pathname === '/playground';
}

/**
 * Smooths a value over time using exponential interpolation.
 * Must be rendered inside Canvas (uses useFrame).
 * Prevents jarring visual pops when moodValence changes at day boundaries.
 */
function SmoothedMoodBridge({
  target,
  smoothingSpeed,
  onUpdate,
}: {
  target: number;
  smoothingSpeed: number;  // Higher = faster transition (e.g., 3 = ~0.3s to settle)
  onUpdate: (smoothed: number) => void;
}) {
  const currentRef = useRef(target);

  useFrame((_, delta) => {
    const current = currentRef.current;
    const diff = target - current;
    // Exponential decay toward target
    const smoothed = current + diff * (1 - Math.exp(-smoothingSpeed * delta));
    // Snap if very close (avoid floating point drift)
    currentRef.current = Math.abs(diff) < 0.001 ? target : smoothed;
    onUpdate(currentRef.current);
  });

  return null;
}

/**
 * Plant component that renders the appropriate 3D component based on DNA type
 */
function Plant({
  plantDNA,
  position,
  opacity,
  saturation,
  onClick,
}: {
  plantDNA: PlantDNA;
  position: [number, number, number];
  opacity: number;
  saturation: number;
  onClick?: (e: any) => void;
}) {
  switch (plantDNA.type) {
    case 'flower':
      return <CleanToonFlower3D dna={plantDNA.dna} position={position} opacity={opacity} saturation={saturation} onClick={onClick} />;
    case 'sprout':
      return <CleanToonSprout3D dna={plantDNA.dna} position={position} opacity={opacity} saturation={saturation} onClick={onClick} />;
    case 'decay':
      return (
        <FallenBloom3D
          seed={plantDNA.dna.seed}
          petalLength={plantDNA.dna.petalLength}
          petalWidth={plantDNA.dna.petalWidth}
          stemLength={plantDNA.dna.stemLength}
          leafSize={plantDNA.dna.leafSize}
          scale={plantDNA.dna.scale}
          decayAmount={plantDNA.dna.decayAmount}
          frayAmount={plantDNA.dna.frayAmount}
          frayDensity={plantDNA.dna.frayDensity}
          petalColors={plantDNA.dna.petalColors}
          stemColors={plantDNA.dna.stemColors}
          opacity={opacity}
          saturation={saturation}
          position={position}
          rotation={plantDNA.dna.rotation}
          onClick={onClick}
        />
      );
  }
}

/**
 * Dev controls panel for tuning environment parameters
 * Only visible when ?dev=true is in the URL
 */
function DevPanel({
  dataHour,
  dataMood,
  smoothedMood,
  dataValenceText,
  gardenLevel,
  overrides,
  onChange,
}: {
  dataHour: number;
  dataMood: number;
  smoothedMood: number;
  dataValenceText: string;
  gardenLevel: number;
  overrides: DevOverrides;
  onChange: (overrides: DevOverrides) => void;
}) {
  const [open, setOpen] = useState(true);

  const update = (partial: Partial<DevOverrides>) => {
    onChange({ ...overrides, ...partial });
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#fff',
        padding: '12px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '11px',
        minWidth: open ? '280px' : 'auto',
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ fontWeight: 'bold', fontSize: '12px' }}>Dev Controls</span>
        <span>{open ? '\u2212' : '+'}</span>
      </div>

      {open && (
        <div style={{ marginTop: '8px' }}>
          {/* Read-only data values */}
          <div style={{ padding: '6px 0', borderBottom: '1px solid #333', marginBottom: '8px', color: '#888' }}>
            <div>Data hour: {dataHour.toFixed(1)}h</div>
            <div>Data mood: {dataMood.toFixed(2)} → {smoothedMood.toFixed(2)}</div>
            <div>Valence text: {dataValenceText}</div>
            <div>Garden level: {gardenLevel.toFixed(2)}</div>
          </div>

          {/* Hour override */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <input
              type="checkbox"
              checked={overrides.hourOverride !== null}
              onChange={(e) => update({ hourOverride: e.target.checked ? dataHour : null })}
            />
            <span style={{ width: '80px' }}>Hour</span>
            {overrides.hourOverride !== null && (
              <>
                <input
                  type="range" min={0} max={24} step={0.5}
                  value={overrides.hourOverride}
                  onChange={(e) => update({ hourOverride: parseFloat(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span style={{ width: '40px', textAlign: 'right' }}>{overrides.hourOverride.toFixed(1)}</span>
              </>
            )}
            {overrides.hourOverride === null && <span style={{ color: '#666' }}>Auto</span>}
          </label>

          {/* Mood override */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <input
              type="checkbox"
              checked={overrides.moodOverride !== null}
              onChange={(e) => update({ moodOverride: e.target.checked ? dataMood : null })}
            />
            <span style={{ width: '80px' }}>Mood</span>
            {overrides.moodOverride !== null && (
              <>
                <input
                  type="range" min={-1} max={1} step={0.05}
                  value={overrides.moodOverride}
                  onChange={(e) => update({ moodOverride: parseFloat(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span style={{ width: '40px', textAlign: 'right' }}>{overrides.moodOverride.toFixed(2)}</span>
              </>
            )}
            {overrides.moodOverride === null && <span style={{ color: '#666' }}>Auto</span>}
          </label>

          {/* Fog density */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ width: '90px' }}>Fog density</span>
            <input
              type="range" min={0} max={0.03} step={0.001}
              value={overrides.fogDensity ?? 0.008}
              onChange={(e) => update({ fogDensity: parseFloat(e.target.value) })}
              style={{ flex: 1 }}
            />
            <span style={{ width: '40px', textAlign: 'right' }}>{(overrides.fogDensity ?? 0.008).toFixed(3)}</span>
          </label>

          {/* Bloom intensity */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ width: '90px' }}>Bloom</span>
            <input
              type="range" min={0} max={5} step={0.1}
              value={overrides.bloomIntensity}
              onChange={(e) => update({ bloomIntensity: parseFloat(e.target.value) })}
              style={{ flex: 1 }}
            />
            <span style={{ width: '40px', textAlign: 'right' }}>{overrides.bloomIntensity.toFixed(1)}</span>
          </label>

          {/* Bloom threshold */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ width: '90px' }}>Bloom thresh</span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={overrides.bloomThreshold}
              onChange={(e) => update({ bloomThreshold: parseFloat(e.target.value) })}
              style={{ flex: 1 }}
            />
            <span style={{ width: '40px', textAlign: 'right' }}>{overrides.bloomThreshold.toFixed(2)}</span>
          </label>

          {/* Vignette */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ width: '90px' }}>Vignette</span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={overrides.vignetteStrength}
              onChange={(e) => update({ vignetteStrength: parseFloat(e.target.value) })}
              style={{ flex: 1 }}
            />
            <span style={{ width: '40px', textAlign: 'right' }}>{overrides.vignetteStrength.toFixed(2)}</span>
          </label>

          {/* Toggles */}
          <div style={{ marginTop: '8px', borderTop: '1px solid #333', paddingTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={overrides.godRaysEnabled} onChange={(e) => update({ godRaysEnabled: e.target.checked })} />
              <span>God Rays</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={overrides.cloudsEnabled} onChange={(e) => update({ cloudsEnabled: e.target.checked })} />
              <span>Clouds</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={overrides.shadowsEnabled} onChange={(e) => update({ shadowsEnabled: e.target.checked })} />
              <span>Shadows</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={overrides.patchDebugEnabled} onChange={(e) => update({ patchDebugEnabled: e.target.checked })} />
              <span>Patch Debug</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

interface DevOverrides {
  hourOverride: number | null;
  moodOverride: number | null;
  fogDensity: number | undefined;
  bloomIntensity: number;
  bloomThreshold: number;
  vignetteStrength: number;
  godRaysEnabled: boolean;
  cloudsEnabled: boolean;
  shadowsEnabled: boolean;
  patchDebugEnabled: boolean;
}

/**
 * Get the time bounds of the dataset
 */
function getTimeBounds(entries: MoodEntryWithPercentile[]): { earliest: Date; latest: Date } {
  if (entries.length === 0) {
    const now = new Date();
    return { earliest: now, latest: now };
  }

  let earliest = entries[0].timestamp;
  let latest = entries[0].timestamp;

  for (const entry of entries) {
    if (entry.timestamp < earliest) earliest = entry.timestamp;
    if (entry.timestamp > latest) latest = entry.timestamp;
  }

  return { earliest, latest };
}

function App() {
  // Check for special modes
  if (isTestMode()) {
    return <TestScene />;
  }
  if (isEnvironmentTestMode()) {
    return <EnvironmentTest />;
  }
  if (isExhibitTestMode()) {
    return <ExhibitTest />;
  }
  if (isNewEnvironmentTestMode()) {
    return <NewEnvironmentTest />;
  }
  if (isVitrineTestMode()) {
    return <VitrineTest />;
  }
  if (isFallenBloomTestMode()) {
    return <FallenBloomGenerator />;
  }
  if (isPlaygroundMode()) {
    return <AtmospherePlayground />;
  }

  // All entries from the CSV (sorted by timestamp)
  const [allEntries, setAllEntries] = useState<MoodEntryWithPercentile[]>([]);

  // Pre-calculated positions for all entries (stable, doesn't change with timeline)
  const [positions, setPositions] = useState<Map<string, [number, number, number]>>(new Map());

  // Patch debug info (populated when using patch-based positioning)
  const [patchDebugInfo, setPatchDebugInfo] = useState<PatchDebugInfo[]>([]);

  // Time bounds of the data
  const [timeBounds, setTimeBounds] = useState<{ earliest: Date; latest: Date } | null>(null);

  // Current position in the timeline
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.25); // days per second

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false); // Start collapsed for timeline view
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Environment state
  const [sunMesh, setSunMesh] = useState<THREE.Mesh | null>(null);

  // Dev mode: ?dev=true enables tuning panel
  const isDevMode = useMemo(() => new URLSearchParams(window.location.search).get('dev') === 'true', []);
  const [devOverrides, setDevOverrides] = useState<DevOverrides>({
    hourOverride: null,
    moodOverride: null,
    fogDensity: undefined,
    bloomIntensity: 1.0,
    bloomThreshold: 0.4,
    vignetteStrength: 0.2,
    godRaysEnabled: true,
    cloudsEnabled: true,
    shadowsEnabled: true,
    patchDebugEnabled: false,
  });

  // Load and parse CSV data
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/mood-data.csv');
        if (!response.ok) {
          throw new Error(`Failed to load CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        const parsedEntries = parseCSVWithPercentiles(csvText);

        // Sort entries by timestamp (oldest first)
        const sortedEntries = [...parsedEntries].sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );

        console.log(`Loaded ${sortedEntries.length} entries`);

        // Get time bounds
        const bounds = getTimeBounds(sortedEntries);
        console.log('Time bounds:', bounds.earliest, 'to', bounds.latest);

        // Only calculate positions for plant-spawning entries (not Daily Mood)
        const plantEntries = sortedEntries.filter(entry => entry.kind !== 'Daily Mood');
        const { positions: calculatedPositions, patches } = calculatePositionsWithDebug(plantEntries);
        console.log(`Calculated positions for ${calculatedPositions.size} plant entries across ${patches.length} patches (${sortedEntries.length - plantEntries.length} Daily Mood entries excluded)`);

        setAllEntries(sortedEntries);
        setPositions(calculatedPositions);
        setPatchDebugInfo(patches);
        setTimeBounds(bounds);
        // Start at the earliest time (empty garden, will grow as we advance)
        setCurrentTime(bounds.earliest);
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Playback effect - advance time when playing
  useEffect(() => {
    if (!isPlaying || !currentTime || !timeBounds) return;

    const intervalMs = 50; // Update every 50ms for smooth animation
    const msPerDay = 24 * 60 * 60 * 1000;
    const baseAdvance = (playbackSpeed * msPerDay * intervalMs) / 1000;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        if (!prev || !timeBounds) return prev;

        // Fast-forward through night hours (12am-7am) — almost no entries
        const hour = prev.getHours();
        const nightMultiplier = (hour >= 0 && hour < 7) ? 6 : 1;
        const timeAdvancePerTick = baseAdvance * nightMultiplier;

        const newTime = new Date(prev.getTime() + timeAdvancePerTick);

        // Stop at the end
        if (newTime >= timeBounds.latest) {
          setIsPlaying(false);
          return timeBounds.latest;
        }
        return newTime;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, timeBounds, currentTime]);

  // Calculate garden level at current time
  const gardenLevel = useMemo(() => {
    if (!currentTime) return 0;
    return calculateGardenLevel(allEntries, currentTime);
  }, [allEntries, currentTime]);

  // === DATA → ENVIRONMENT BRIDGE ===

  // Hour from currentTime (drives sun arc, sky colors, lighting)
  const hour = useMemo(() => {
    if (!currentTime) return 12;
    return currentTime.getHours() + currentTime.getMinutes() / 60;
  }, [currentTime]);

  // Daily mood valence — from Daily Mood entries on the current calendar day
  // Drives clouds, floor glow (outside bed), fog, atmospheric effects
  // Daily Mood applies to the WHOLE calendar day (not gated by log time)
  const moodValence = useMemo(() => {
    if (!currentTime || allEntries.length === 0) return 0;
    const currentDay = currentTime.toDateString();

    // First: use Daily Mood entry if one exists for this calendar day
    const dailyMoodEntries = allEntries.filter(e =>
      e.kind === 'Daily Mood' &&
      e.timestamp.toDateString() === currentDay
    );
    if (dailyMoodEntries.length > 0) {
      const avg = dailyMoodEntries.reduce((sum, e) => sum + e.valence, 0) / dailyMoodEntries.length;
      return Math.max(-1, Math.min(1, avg));
    }

    // Fallback: average of ALL Momentary Emotion entries on this day
    // Applied to whole day (same behavior as Daily Mood)
    const momentaryEntries = allEntries.filter(e =>
      e.kind === 'Momentary Emotion' &&
      e.timestamp.toDateString() === currentDay
    );
    if (momentaryEntries.length > 0) {
      const avg = momentaryEntries.reduce((sum, e) => sum + e.valence, 0) / momentaryEntries.length;
      return Math.max(-1, Math.min(1, avg));
    }

    return 0; // No entries at all for this day
  }, [allEntries, currentTime]);

  // LED wall text: valence classification of most recent entry of any kind
  const valenceText = useMemo(() => {
    if (!currentTime) return 'NEUTRAL';
    const pastEntries = allEntries.filter(e => e.timestamp <= currentTime);
    if (pastEntries.length === 0) return 'NEUTRAL';
    return pastEntries[pastEntries.length - 1].valenceClassification.toUpperCase();
  }, [allEntries, currentTime]);

  // Effective values: dev override if set, otherwise data-derived
  const effectiveHour = devOverrides.hourOverride ?? hour;
  const targetMood = devOverrides.moodOverride ?? moodValence;
  const [smoothedMood, setSmoothedMood] = useState(0);

  // Filter entries that have been created by current time
  // Daily Mood entries control atmosphere + garden level only, not plant spawning (per GDD)
  // (they may still be visible even if fading)
  const createdEntries = useMemo(() => {
    if (!currentTime) return [];
    return allEntries.filter(entry =>
      entry.timestamp <= currentTime && entry.kind !== 'Daily Mood'
    );
  }, [allEntries, currentTime]);

  // Calculate fade state for each created entry
  const fadeStates = useMemo(() => {
    if (!currentTime) return new Map<string, FadeState>();
    const states = new Map<string, FadeState>();
    for (const entry of createdEntries) {
      const plantType = getPlantType(entry.valenceClassification);
      const fadeState = calculateFadeState(entry, plantType, currentTime, gardenLevel);
      states.set(entry.id, fadeState);
    }
    return states;
  }, [createdEntries, currentTime, gardenLevel]);

  // Filter to only entries that are still visible (opacity > 0)
  const visibleEntries = useMemo(() => {
    return createdEntries.filter(entry => {
      const fadeState = fadeStates.get(entry.id);
      return fadeState?.isVisible ?? false;
    });
  }, [createdEntries, fadeStates]);

  // Convert visible entries to DNA (memoized for performance)
  const visiblePlants = useMemo(() => {
    return visibleEntries.map(entryToDNA);
  }, [visibleEntries]);

  // Timeline control handlers
  const handleTimeChange = useCallback((time: Date) => {
    setCurrentTime(time);
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  if (loading) {
    return <div className="loading">Loading mood data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!timeBounds || !currentTime) {
    return <div className="loading">Initializing timeline...</div>;
  }

  // Get position for an entry from the pre-calculated position map
  // Falls back to origin if somehow missing (shouldn't happen)
  const getPosition = (entryId: string): [number, number, number] => {
    return positions.get(entryId) ?? [0, 0, 0];
  };

  return (
    <div className="app">
      {/* Garden Level Display (dev UI) */}
      <div className="garden-level-display">
        <span className="label">Garden Level:</span>
        <span className={`value ${gardenLevel < 0 ? 'lush' : gardenLevel > 0 ? 'barren' : 'neutral'}`}>
          {gardenLevel.toFixed(2)}
        </span>
        <span className="indicator">
          {gardenLevel < -0.5 ? '🌸 Lush' : gardenLevel > 0.5 ? '🍂 Barren' : '⚖️ Balanced'}
        </span>
      </div>

      {/* Dev controls panel - only visible with ?dev=true */}
      {isDevMode && (
        <DevPanel
          dataHour={hour}
          dataMood={moodValence}
          smoothedMood={smoothedMood}
          dataValenceText={valenceText}
          gardenLevel={gardenLevel}
          overrides={devOverrides}
          onChange={setDevOverrides}
        />
      )}

      {/* Collapsible info panel */}
      <div className={`info-panel ${panelOpen ? 'open' : 'collapsed'}`}>
        <div className="panel-header" onClick={() => setPanelOpen(!panelOpen)}>
          <h1>Plant Details</h1>
          <span className="toggle">{panelOpen ? '−' : '+'}</span>
        </div>
        {panelOpen && (
          <div className="panel-content">
            {/* Selected plant details (click a plant in the garden) */}
            {selectedEntryId && (() => {
              const entry = allEntries.find(e => e.id === selectedEntryId);
              if (!entry) return null;
              const plantType = getPlantType(entry.valenceClassification);
              const dna = entryToDNA(entry);
              return (
                <div style={{
                  padding: '8px',
                  marginBottom: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  borderLeft: '3px solid #4fc3f7',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px' }}>Selected: {plantType}</strong>
                    <span
                      style={{ cursor: 'pointer', opacity: 0.5, fontSize: '11px' }}
                      onClick={() => setSelectedEntryId(null)}
                    >✕ clear</span>
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '4px', lineHeight: '1.6' }}>
                    <div><span className="label">Date:</span> {entry.timestamp.toLocaleDateString()} {entry.timestamp.toLocaleTimeString()}</div>
                    <div><span className="label">Kind:</span> {entry.kind}</div>
                    <div><span className="label">Emotions:</span> {entry.emotions.length > 0 ? entry.emotions.join(', ') : '(none)'}</div>
                    <div><span className="label">Associations:</span> {entry.associations.length > 0 ? entry.associations.join(', ') : '(none)'}</div>
                    <div><span className="label">Valence:</span> {entry.valence.toFixed(2)} ({entry.valenceClassification})</div>
                    <div><span className="label">Scale Percentile:</span> {entry.scalePercentile.toFixed(0)}%</div>
                    {dna.type === 'decay' && (
                      <div><span className="label">Decay Scale:</span> {dna.dna.scale.toFixed(2)}</div>
                    )}
                    {dna.type === 'flower' && (
                      <div><span className="label">Flower Scale:</span> {dna.dna.scale.toFixed(2)}</div>
                    )}
                  </div>
                </div>
              );
            })()}

            <p>Showing {visiblePlants.length} of {allEntries.length} entries (created: {createdEntries.length})</p>
            <ul>
              {visibleEntries.slice(-10).reverse().map((entry, i) => (
                <li
                  key={entry.id}
                  style={entry.id === selectedEntryId ? { background: 'rgba(79,195,247,0.15)', borderRadius: '4px', padding: '2px 4px' } : undefined}
                  onClick={() => setSelectedEntryId(entry.id)}
                >
                  <strong>{visiblePlants[visibleEntries.length - 1 - i]?.type}</strong>
                  <span className="entry-date">
                    {entry.timestamp.toLocaleDateString()}
                  </span>
                  <br />
                  <span className="label">Emotions:</span>{' '}
                  {entry.emotions.length > 0 ? entry.emotions.join(', ') : '(none)'}
                  <br />
                  <span className="label">Valence:</span>{' '}
                  {entry.valenceClassification}
                </li>
              ))}
              {visibleEntries.length > 10 && (
                <li className="more-entries">
                  ...and {visibleEntries.length - 10} more entries
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Timeline controls at the bottom */}
      <TimelineControls
        currentTime={currentTime}
        earliest={timeBounds.earliest}
        latest={timeBounds.latest}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        visibleCount={visiblePlants.length}
        totalCount={allEntries.length}
        onTimeChange={handleTimeChange}
        onPlayPause={handlePlayPause}
        onSpeedChange={handleSpeedChange}
      />

      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        camera={{ position: [0, 25, 35], fov: 50 }}
      >
        {/* Smooth mood transitions between frames */}
        <SmoothedMoodBridge target={targetMood} smoothingSpeed={3} onUpdate={setSmoothedMood} />

        {/* Environment: sky, clouds, lighting, ground, LED wall */}
        <SpecimenVitrine
          hour={effectiveHour}
          moodValence={smoothedMood}
          valenceText={valenceText}
          shadowsEnabled={devOverrides.shadowsEnabled}
          fogDensity={devOverrides.fogDensity}
          cloudsEnabled={devOverrides.cloudsEnabled}
          onSunMeshReady={setSunMesh}
        />

        {/* Plants */}
        {visiblePlants.map((plantDNA, index) => {
          const entry = visibleEntries[index];
          const fadeState = fadeStates.get(entry.id) ?? { opacity: 1, saturation: 1, isVisible: true };
          return (
            <Plant
              key={entry.id}
              plantDNA={plantDNA}
              position={getPosition(entry.id)}
              opacity={fadeState.opacity}
              saturation={fadeState.saturation}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEntryId(entry.id);
                setPanelOpen(true);
                console.log('🌿 Plant clicked:', {
                  type: plantDNA.type,
                  id: entry.id,
                  date: entry.timestamp.toLocaleDateString(),
                  time: entry.timestamp.toLocaleTimeString(),
                  emotions: entry.emotions,
                  associations: entry.associations,
                  valence: entry.valence,
                  classification: entry.valenceClassification,
                  percentile: entry.scalePercentile,
                });
              }}
            />
          );
        })}

        {/* Patch debug overlay — dev mode only */}
        {isDevMode && devOverrides.patchDebugEnabled && (
          <PatchDebugOverlay patches={patchDebugInfo} currentTime={currentTime} />
        )}

        {/* Post-processing: bloom, god rays, vignette, saturation */}
        <PostProcessing
          bloomIntensity={devOverrides.bloomIntensity}
          bloomThreshold={devOverrides.bloomThreshold}
          bloomRadius={0.7}
          vignetteStrength={devOverrides.vignetteStrength}
          moodValence={smoothedMood}
          sunMesh={sunMesh}
          godRaysEnabled={devOverrides.godRaysEnabled}
        />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={CAMERA_LIMITS.minDistance}
          maxDistance={CAMERA_LIMITS.maxDistance}
          minPolarAngle={CAMERA_LIMITS.minPolarAngle}
          maxPolarAngle={CAMERA_LIMITS.maxPolarAngle}
          minAzimuthAngle={CAMERA_LIMITS.minAzimuthAngle}
          maxAzimuthAngle={CAMERA_LIMITS.maxAzimuthAngle}
          target={[0, 2, 0]}
        />
      </Canvas>
    </div>
  );
}

export default App;
