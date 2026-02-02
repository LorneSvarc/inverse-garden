import React, { useMemo } from 'react';
import * as THREE from 'three';
import { GROUND_BOUNDS } from '../config/environmentConfig';
import { getToonGradient } from '../utils/toonGradient';

export const RaisedBed: React.FC = () => {
    const gradientMap = useMemo(() => getToonGradient(), []);

    const geometry = useMemo(() => {
        // Create the outer shape
        const outerShape = new THREE.Shape();
        const w = GROUND_BOUNDS.width / 2;
        const d = GROUND_BOUNDS.depth / 2;
        const r = GROUND_BOUNDS.cornerRadius;

        outerShape.moveTo(-w + r, -d);
        outerShape.lineTo(w - r, -d);
        outerShape.quadraticCurveTo(w, -d, w, -d + r);
        outerShape.lineTo(w, d - r);
        outerShape.quadraticCurveTo(w, d, w - r, d);
        outerShape.lineTo(-w + r, d);
        outerShape.quadraticCurveTo(-w, d, -w, d - r);
        outerShape.lineTo(-w, -d + r);
        outerShape.quadraticCurveTo(-w, -d, -w + r, -d);

        // Create the inner shape (hole) for the "planter box" effect
        // Reduce dimensions by wall thickness
        const thickness = 0.3; // visible wall thickness
        const innerPath = new THREE.Path();
        const wi = w - thickness;
        const di = d - thickness;
        const ri = Math.max(0.1, r - thickness); // Ensure slightly reduced radius

        innerPath.moveTo(-wi + ri, -di);
        innerPath.lineTo(wi - ri, -di);
        innerPath.quadraticCurveTo(wi, -di, wi, -di + ri);
        innerPath.lineTo(wi, di - ri);
        innerPath.quadraticCurveTo(wi, di, wi - ri, di);
        innerPath.lineTo(-wi + ri, di);
        innerPath.quadraticCurveTo(-wi, di, -wi, di - ri);
        innerPath.lineTo(-wi, -di + ri);
        innerPath.quadraticCurveTo(-wi, -di, -wi + ri, -di);

        outerShape.holes.push(innerPath);

        const geom = new THREE.ExtrudeGeometry(outerShape, {
            depth: GROUND_BOUNDS.wallHeight,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.05,
            bevelSegments: 2,
        });

        // Rotate so extrusion is along Y axis
        // Shape is in XY plane. Extrude is along Z.
        // We want shape in XZ ("ground"), Extrude along Y ("up").
        geom.rotateX(Math.PI / 2);

        // After rotateX(90):
        // Shape (XY) -> XZ
        // Extrusion (+Z) -> -Y (Down)

        // We want UP (+Y).
        // RotateX(-90) should map +Z to +Y.

        return geom;
    }, []);

    return (
        <mesh
            geometry={geometry}
            rotation={[-Math.PI, 0, 0]} // Flip it so it goes UP if needed, or adjust rotateX above
        >
            <meshToonMaterial
                color="#7A6352"
                gradientMap={gradientMap}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};
