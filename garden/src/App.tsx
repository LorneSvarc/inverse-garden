import { useEffect, useState, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { MoodEntryWithPercentile, PlantDNA } from './types';
import { parseCSVWithPercentiles } from './utils/csvParser';
import { entryToDNA } from './utils/dnaMapper';
import { calculatePositions, getLayoutConfig } from './utils/positionCalculator';
import Flower3D from './components/Flower3D';
import Sprout3D from './components/Sprout3D';
import Decay3D from './components/Decay3D';
import TimelineControls from './components/TimelineControls';
import './App.css';

/**
 * Plant component that renders the appropriate 3D component based on DNA type
 */
function Plant({ plantDNA, position }: { plantDNA: PlantDNA; position: [number, number, number] }) {
  switch (plantDNA.type) {
    case 'flower':
      return <Flower3D dna={plantDNA.dna} position={position} />;
    case 'sprout':
      return <Sprout3D dna={plantDNA.dna} position={position} />;
    case 'decay':
      return <Decay3D dna={plantDNA.dna} position={position} />;
  }
}

/**
 * Ground plane for the garden
 * Size matches the garden radius from positionCalculator
 */
function Ground() {
  const { gardenRadius } = getLayoutConfig();
  // Make ground slightly larger than plant area for visual margin
  const groundRadius = gardenRadius * 1.3;

  return (
    <mesh position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[groundRadius, 64]} />
      <meshStandardMaterial color="#8B7355" roughness={1} />
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

  // Filter entries that are visible at current time
  // A plant is visible if currentTime >= entry.timestamp
  const visibleEntries = useMemo(() => {
    if (!currentTime) return [];
    return allEntries.filter(entry => entry.timestamp <= currentTime);
  }, [allEntries, currentTime]);

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
      {/* Collapsible info panel */}
      <div className={`info-panel ${panelOpen ? 'open' : 'collapsed'}`}>
        <div className="panel-header" onClick={() => setPanelOpen(!panelOpen)}>
          <h1>Plant Details</h1>
          <span className="toggle">{panelOpen ? '−' : '+'}</span>
        </div>
        {panelOpen && (
          <div className="panel-content">
            <p>Showing {visiblePlants.length} of {allEntries.length} entries</p>
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

        {visiblePlants.map((plantDNA, index) => (
          <Plant
            key={visibleEntries[index].id}
            plantDNA={plantDNA}
            position={getPosition(visibleEntries[index].id)}
          />
        ))}

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
