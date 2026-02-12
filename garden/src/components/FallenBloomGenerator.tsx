import { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import FallenBloom3D from './FallenBloom3D';

// ─── Color Presets ──────────────────────────────────────────────────────────
// Each preset demonstrates a different emotion/association count combination.
// petalColors = emotion colors (1-3), stemColors = association colors (1-3)
// Leaf colors are derived internally from stemColors by FallenBloom3D.

const COLOR_PRESETS: Record<
  string,
  { label: string; petalColors: string[]; stemColors: string[] }
> = {
  anxious: {
    label: '1 emo / 2 assoc',
    petalColors: ['#00FFEF'],                          // 1 emotion
    stemColors: ['#9DC183', '#FFB6C1'],                // 2 associations
  },
  sad: {
    label: '2 emo / 1 assoc',
    petalColors: ['#2563EB', '#38BDF8'],               // 2 emotions
    stemColors: ['#DAA520'],                            // 1 association
  },
  stressed: {
    label: '3 emo / 3 assoc',
    petalColors: ['#EF4444', '#EC4899', '#FBCFE8'],    // 3 emotions
    stemColors: ['#DAA520', '#A0522D', '#FF69B4'],     // 3 associations
  },
  ashamed: {
    label: '2 emo / 1 assoc',
    petalColors: ['#FF5F1F', '#FFBF00'],               // 2 emotions
    stemColors: ['#9370DB'],                            // 1 association
  },
};

// ─── Config ─────────────────────────────────────────────────────────────────

interface GeneratorConfig {
  petalLength: number;
  petalWidth: number;
  stemLength: number;
  leafSize: number;
  scale: number;
  opacity: number;
  saturation: number;

  // Colors
  colorPreset: string;
  customPetalColor1: string;
  customPetalColor2: string;
  customPetalColor3: string;
  customStemColor1: string;
  customStemColor2: string;
  customStemColor3: string;
}

const DEFAULT_CONFIG: GeneratorConfig = {
  petalLength: 0.35,
  petalWidth: 0.18,
  stemLength: 0.35,
  leafSize: 0.5,
  scale: 0.8,
  opacity: 1.0,
  saturation: 1.0,

  colorPreset: 'stressed',
  customPetalColor1: '#EF4444',
  customPetalColor2: '#EC4899',
  customPetalColor3: '#FBCFE8',
  customStemColor1: '#DAA520',
  customStemColor2: '#A0522D',
  customStemColor3: '#FF69B4',
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  zIndex: 10,
  background: 'rgba(0, 0, 0, 0.92)',
  color: '#fff',
  padding: '14px',
  borderRadius: '8px',
  fontFamily: 'monospace',
  fontSize: '11px',
  width: '280px',
  maxHeight: 'calc(100vh - 32px)',
  overflowY: 'auto' as const,
};

const sectionStyle: React.CSSProperties = {
  marginTop: '10px',
  paddingTop: '8px',
  borderTop: '1px solid #333',
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 'bold',
  fontSize: '11px',
  color: '#aaa',
  marginBottom: '6px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const sliderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '5px',
};

const labelStyle: React.CSSProperties = {
  width: '80px',
  flexShrink: 0,
};

const valueStyle: React.CSSProperties = {
  width: '40px',
  textAlign: 'right' as const,
  flexShrink: 0,
  color: '#888',
};

const presetButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  border: active ? '1px solid #fff' : '1px solid #444',
  borderRadius: '4px',
  background: active ? '#333' : 'transparent',
  color: active ? '#fff' : '#888',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: '10px',
});

const colorInputStyle: React.CSSProperties = {
  width: '28px',
  height: '20px',
  border: '1px solid #444',
  borderRadius: '3px',
  cursor: 'pointer',
  padding: 0,
  background: 'transparent',
};

// ─── Slider ─────────────────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step, onChange, format,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div style={sliderRowStyle}>
      <span style={labelStyle}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} style={{ flex: 1 }} />
      <span style={valueStyle}>{format ? format(value) : value.toFixed(2)}</span>
    </div>
  );
}

// ─── Scene ──────────────────────────────────────────────────────────────────

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[15, 64]} />
      <meshStandardMaterial color="#3d2817" roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.4} />
    </>
  );
}

// ─── Generator ──────────────────────────────────────────────────────────────

export default function FallenBloomGenerator() {
  const [config, setConfig] = useState<GeneratorConfig>(DEFAULT_CONFIG);

  const update = (partial: Partial<GeneratorConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const activeColors = useMemo(() => {
    if (config.colorPreset === 'custom') {
      return {
        petalColors: [config.customPetalColor1, config.customPetalColor2, config.customPetalColor3].filter(Boolean),
        stemColors: [config.customStemColor1, config.customStemColor2, config.customStemColor3].filter(Boolean),
      };
    }
    const preset = COLOR_PRESETS[config.colorPreset] ?? COLOR_PRESETS.stressed;
    return { petalColors: preset.petalColors, stemColors: preset.stemColors };
  }, [config.colorPreset, config.customPetalColor1, config.customPetalColor2, config.customPetalColor3,
    config.customStemColor1, config.customStemColor2, config.customStemColor3]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#111' }}>
      {/* ── Control Panel ─────────────────────────────────────── */}
      <div style={panelStyle}>
        <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>
          Fallen Bloom Generator
        </div>
        <div style={{ color: '#666', marginBottom: '8px' }}>?test=fallenbloom &mdash; scattered debris</div>

        {/* Petal Geometry */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Petal Shape</div>
          <Slider label="Length" value={config.petalLength} min={0.2} max={0.5} step={0.05}
            onChange={(v) => update({ petalLength: v })} />
          <Slider label="Width" value={config.petalWidth} min={0.1} max={0.25} step={0.05}
            onChange={(v) => update({ petalWidth: v })} />
        </div>

        {/* Stem & Leaves */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Stem & Leaves</div>
          <Slider label="Stem Len" value={config.stemLength} min={0.2} max={0.6} step={0.05}
            onChange={(v) => update({ stemLength: v })} />
          <Slider label="Leaf Size" value={config.leafSize} min={0.3} max={1.0} step={0.05}
            onChange={(v) => update({ leafSize: v })} />
        </div>

        {/* Scale & Rendering */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Scale & Rendering</div>
          <Slider label="Scale" value={config.scale} min={0.4} max={1.8} step={0.05}
            onChange={(v) => update({ scale: v })} />
          <Slider label="Opacity" value={config.opacity} min={0} max={1} step={0.05}
            onChange={(v) => update({ opacity: v })} />
          <Slider label="Saturation" value={config.saturation} min={0} max={1} step={0.05}
            onChange={(v) => update({ saturation: v })} />
        </div>

        {/* Colors */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Colors</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
              <button key={key} style={presetButtonStyle(config.colorPreset === key)}
                onClick={() => update({ colorPreset: key })}>{preset.label}</button>
            ))}
            <button style={presetButtonStyle(config.colorPreset === 'custom')}
              onClick={() => update({ colorPreset: 'custom' })}>Custom</button>
          </div>

          {config.colorPreset === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={sliderRowStyle}>
                <span style={labelStyle}>Emotions</span>
                <input type="color" value={config.customPetalColor1}
                  onChange={(e) => update({ customPetalColor1: e.target.value })} style={colorInputStyle} />
                <input type="color" value={config.customPetalColor2}
                  onChange={(e) => update({ customPetalColor2: e.target.value })} style={colorInputStyle} />
                <input type="color" value={config.customPetalColor3}
                  onChange={(e) => update({ customPetalColor3: e.target.value })} style={colorInputStyle} />
              </div>
              <div style={sliderRowStyle}>
                <span style={labelStyle}>Associations</span>
                <input type="color" value={config.customStemColor1}
                  onChange={(e) => update({ customStemColor1: e.target.value })} style={colorInputStyle} />
                <input type="color" value={config.customStemColor2}
                  onChange={(e) => update({ customStemColor2: e.target.value })} style={colorInputStyle} />
                <input type="color" value={config.customStemColor3}
                  onChange={(e) => update({ customStemColor3: e.target.value })} style={colorInputStyle} />
              </div>
            </div>
          )}

          {config.colorPreset !== 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <span style={{ ...labelStyle, width: '60px', color: '#666' }}>Emotions</span>
                {activeColors.petalColors.map((c, i) => (
                  <div key={i} style={{ width: 16, height: 16, borderRadius: 3, background: c, border: '1px solid #444' }}
                    title={`E${i}`} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <span style={{ ...labelStyle, width: '60px', color: '#666' }}>Assoc</span>
                {activeColors.stemColors.map((c, i) => (
                  <div key={i} style={{ width: 16, height: 16, borderRadius: 3, background: c, border: '1px solid #444' }}
                    title={i === 0 ? 'Stem' : `Leaf ${i}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3D Canvas ─────────────────────────────────────────── */}
      <Canvas
        camera={{ position: [2, 3, 4], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
        shadows
      >
        <Lighting />
        <Ground />

        <FallenBloom3D
          seed={42}
          petalLength={config.petalLength}
          petalWidth={config.petalWidth}
          stemLength={config.stemLength}
          leafSize={config.leafSize}
          scale={config.scale}
          petalColors={activeColors.petalColors}
          stemColors={activeColors.stemColors}
          opacity={config.opacity}
          saturation={config.saturation}
        />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={20}
          target={[0.3, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
