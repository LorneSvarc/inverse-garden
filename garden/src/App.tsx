import { useEffect, useState, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { MoodEntryWithPercentile, PlantDNA } from './types';
import { parseCSVWithPercentiles } from './utils/csvParser';
import { entryToDNA, getPlantType } from './utils/dnaMapper';
import { calculatePositions, getLayoutConfig } from './utils/positionCalculator';
import { calculateGardenLevel } from './utils/gardenLevel';
import { calculateFadeState, type FadeState } from './utils/plantFading';
import CleanToonFlower3D from './components/CleanToonFlower3D';
import CleanToonSprout3D from './components/CleanToonSprout3D';
import CleanToonDecay3D from './components/CleanToonDecay3D';
import TimelineControls from './components/TimelineControls';
import TestScene from './components/TestScene';
import AtmospherePlayground from './components/AtmospherePlayground';
import EnvironmentTest from './components/EnvironmentTest';
import ExhibitTest from './components/ExhibitTest';
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
 * Check if playground mode is enabled via URL path
 */
function isPlaygroundMode(): boolean {
  return window.location.pathname === '/playground';
}

/**
 * Plant component that renders the appropriate 3D component based on DNA type
 */
function Plant({
  plantDNA,
  position,
  opacity,
  saturation
}: {
  plantDNA: PlantDNA;
  position: [number, number, number];
  opacity: number;
  saturation: number;
}) {
  switch (plantDNA.type) {
    case 'flower':
      return <CleanToonFlower3D dna={plantDNA.dna} position={position} opacity={opacity} saturation={saturation} />;
    case 'sprout':
      return <CleanToonSprout3D dna={plantDNA.dna} position={position} opacity={opacity} saturation={saturation} />;
    case 'decay':
      return <CleanToonDecay3D dna={plantDNA.dna} position={position} opacity={opacity} saturation={saturation} />;
  }
}

/**
 * Ground plane for the garden
 * Size matches the garden radius from positionCalculator
 * Uses DoubleSide rendering to prevent disappearing at certain camera angles
 */
function Ground() {
  const { gardenRadius } = getLayoutConfig();
  // Make ground slightly larger than plant area for visual margin
  const groundRadius = gardenRadius * 1.3;

  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[groundRadius, 64]} />
      <meshStandardMaterial color="#8B7355" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * Scene lighting
 */
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />
    </>
  );
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
  if (isPlaygroundMode()) {
    return <AtmospherePlayground />;
  }

  // All entries from the CSV (sorted by timestamp)
  const [allEntries, setAllEntries] = useState<MoodEntryWithPercentile[]>([]);

  // Pre-calculated positions for all entries (stable, doesn't change with timeline)
  const [positions, setPositions] = useState<Map<string, [number, number, number]>>(new Map());

  // Time bounds of the data
  const [timeBounds, setTimeBounds] = useState<{ earliest: Date; latest: Date } | null>(null);

  // Current position in the timeline
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // days per second

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false); // Start collapsed for timeline view

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

        // Calculate stable positions for all entries (done once at load time)
        const calculatedPositions = calculatePositions(sortedEntries);
        console.log(`Calculated positions for ${calculatedPositions.size} entries`);

        setAllEntries(sortedEntries);
        setPositions(calculatedPositions);
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
    const timeAdvancePerTick = (playbackSpeed * msPerDay * intervalMs) / 1000;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        if (!prev || !timeBounds) return prev;
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

  // Filter entries that have been created by current time
  // (they may still be visible even if fading)
  const createdEntries = useMemo(() => {
    if (!currentTime) return [];
    return allEntries.filter(entry => entry.timestamp <= currentTime);
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

      {/* Collapsible info panel */}
      <div className={`info-panel ${panelOpen ? 'open' : 'collapsed'}`}>
        <div className="panel-header" onClick={() => setPanelOpen(!panelOpen)}>
          <h1>Plant Details</h1>
          <span className="toggle">{panelOpen ? '−' : '+'}</span>
        </div>
        {panelOpen && (
          <div className="panel-content">
            <p>Showing {visiblePlants.length} of {allEntries.length} entries (created: {createdEntries.length})</p>
            <ul>
              {visibleEntries.slice(-10).reverse().map((entry, i) => (
                <li key={entry.id}>
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
        camera={{ position: [0, 30, 40], fov: 60 }}
        style={{ background: '#1a1a2e' }}
      >
        <Lighting />
        <Ground />

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
            />
          );
        })}

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={100}
        />
      </Canvas>
    </div>
  );
}

export default App;
