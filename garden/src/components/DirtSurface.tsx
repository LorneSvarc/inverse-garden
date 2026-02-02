import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GROUND_BOUNDS } from '../config/environmentConfig';
import { getToonGradient } from '../utils/toonGradient';

// Simple pseudo-random noise function (Value Noise)
function pseudoNoise(x: number, z: number) {
    const sinX = Math.sin(x);
    const cosZ = Math.cos(z);
    return Math.sin(sinX * 12.9898 + cosZ * 78.233) * 43758.5453 - Math.floor(Math.sin(sinX * 12.9898 + cosZ * 78.233) * 43758.5453);
}

// Low frequency noise for "patches"
function smoothNoise(x: number, y: number) {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fX = x - i;
    const fY = y - j;

    // Four corners
    const a = pseudoNoise(i, j);
    const b = pseudoNoise(i + 1, j);
    const c = pseudoNoise(i, j + 1);
    const d = pseudoNoise(i + 1, j + 1);

    // Smooth interpolation (quintic)
    const u = fX * fX * fX * (fX * (fX * 6 - 15) + 10);
    const v = fY * fY * fY * (fY * (fY * 6 - 15) + 10);

    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const DirtSurface: React.FC = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    const gradientMap = useMemo(() => getToonGradient(), []);

    const geometry = useMemo(() => {
        const w = GROUND_BOUNDS.width;
        const h = GROUND_BOUNDS.depth;
        // Increase segments for better noise resolution
        const geo = new THREE.PlaneGeometry(w, h, 64, 64);

        // Rotate to face up
        geo.rotateX(-Math.PI / 2);

        // Apply noise to colors
        const count = geo.attributes.position.count;
        const colors = new Float32Array(count * 3);

        const color1 = new THREE.Color('#3D2817'); // Dark soil
        const color2 = new THREE.Color('#5C4033'); // Mid brown
        const color3 = new THREE.Color('#8B7355'); // Light tan

        for (let i = 0; i < count; i++) {
            // Get vertex position (world space relative to mesh)
            const x = geo.attributes.position.getX(i);
            const z = geo.attributes.position.getZ(i);

            // Large scale noise for patches
            // Scale down x, z
            const n = smoothNoise(x * 0.3, z * 0.3); // 0 to 1 roughly

            // Map 0-1 to blend weights
            const c = new THREE.Color();
            if (n < 0.4) {
                c.lerpColors(color1, color2, n / 0.4);
            } else {
                c.lerpColors(color2, color3, (n - 0.4) / 0.6);
            }

            // Add random slight grain
            c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);

            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }

        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        return geo;
    }, []);

    return (
        <mesh ref={meshRef} geometry={geometry} position={[0, -0.05, 0]} receiveShadow>
            {/* Slightly below wall top */}
            <meshLambertMaterial
                vertexColors
            />
        </mesh>
    );
};
