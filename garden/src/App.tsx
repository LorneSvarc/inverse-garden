import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { MoodEntry, PlantDNA } from './types';
import { parseCSV } from './utils/csvParser';
import { entryToDNA, getPlantType } from './utils/dnaMapper';
import Flower3D from './components/Flower3D';
import Sprout3D from './components/Sprout3D';
import Decay3D from './components/Decay3D';
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
 */
function Ground() {
  return (
    <mesh position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[50, 64]} />
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
 * Select a diverse sample of entries for validation
 * - Get flowers with different primary associations
 * - Include some sprouts and decays too
 */
function selectDiverseSample(allEntries: MoodEntry[]): MoodEntry[] {
  const sample: MoodEntry[] = [];
  const seenPrimaryAssociations = new Set<string>();

  // First pass: get flowers with unique primary associations
  for (const entry of allEntries) {
    if (sample.length >= 8) break;

    const plantType = getPlantType(entry.valenceClassification);
    if (plantType !== 'flower') continue;
    if (entry.associations.length === 0) continue;

    const primary = entry.associations[0];
    if (seenPrimaryAssociations.has(primary)) continue;

    seenPrimaryAssociations.add(primary);
    sample.push(entry);
  }

  // Second pass: add a couple sprouts
  let sproutCount = 0;
  for (const entry of allEntries) {
    if (sproutCount >= 2) break;
    const plantType = getPlantType(entry.valenceClassification);
    if (plantType === 'sprout' && !sample.includes(entry)) {
      sample.push(entry);
      sproutCount++;
    }
  }

  // Third pass: add a couple decays
  let decayCount = 0;
  for (const entry of allEntries) {
    if (decayCount >= 2) break;
    const plantType = getPlantType(entry.valenceClassification);
    if (plantType === 'decay' && !sample.includes(entry)) {
      sample.push(entry);
      decayCount++;
    }
  }

  return sample;
}

function App() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [plants, setPlants] = useState<PlantDNA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Load and parse CSV data
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/mood-data.csv');
        if (!response.ok) {
          throw new Error(`Failed to load CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        const parsedEntries = parseCSV(csvText);

        console.log(`Loaded ${parsedEntries.length} entries`);

        // Select diverse sample for validation
        const sampleEntries = selectDiverseSample(parsedEntries);

        // Convert to DNA
        const plantDNA = sampleEntries.map(entryToDNA);

        // Log what we're rendering for debugging
        console.log('Sample entries:', sampleEntries);
        console.log('Generated DNA:', plantDNA);

        // Count plant types
        const typeCounts = plantDNA.reduce((acc, p) => {
          acc[p.type] = (acc[p.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('Plant types:', typeCounts);

        setEntries(sampleEntries);
        setPlants(plantDNA);
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <div className="loading">Loading mood data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  // Simple linear layout for validation - plants spread along X axis
  // We'll implement proper spatial layout in Phase 3
  const getPosition = (index: number): [number, number, number] => {
    // Spread plants out in a row with some spacing
    const spacing = 6;
    const startX = -((plants.length - 1) * spacing) / 2;
    return [startX + index * spacing, 0, 0];
  };

  return (
    <div className="app">
      <div className={`info-panel ${panelOpen ? 'open' : 'collapsed'}`}>
        <div className="panel-header" onClick={() => setPanelOpen(!panelOpen)}>
          <h1>Encoding Validation</h1>
          <span className="toggle">{panelOpen ? '−' : '+'}</span>
        </div>
        {panelOpen && (
          <div className="panel-content">
            <p>Showing {plants.length} entries (diverse sample)</p>
            <ul>
              {entries.map((entry, i) => (
                <li key={entry.id}>
                  <strong>{plants[i].type}</strong>
                  <br />
                  <span className="label">Emotions:</span>{' '}
                  {entry.emotions.length > 0 ? entry.emotions.join(', ') : '(none)'}
                  <br />
                  <span className="label">Associations:</span>{' '}
                  {entry.associations.length > 0 ? entry.associations.join(', ') : '(none)'}
                  <br />
                  <span className="label">Valence:</span>{' '}
                  {entry.valenceClassification} ({entry.valence.toFixed(2)})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Canvas
        camera={{ position: [0, 5, 25], fov: 60 }}
        style={{ background: '#1a1a2e' }}
      >
        <Lighting />
        <Ground />

        {plants.map((plantDNA, index) => (
          <Plant
            key={entries[index].id}
            plantDNA={plantDNA}
            position={getPosition(index)}
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
