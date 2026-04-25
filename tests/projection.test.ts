import { describe, it, expect } from 'vitest';
import { projectToScreen, type Vec3 } from '@/utils/projection';

// ── Camera fixture helpers ─────────────────────────────────────────────────────

/** Build a minimal camera-like object for testing projection. */
function makeCamera(
  matrixWorldInverse: Float32Array,
  projectionMatrix: Float32Array
) {
  return { matrixWorldInverse, projectionMatrix };
}

/**
 * Build a perspective camera looking down -Z (forward), positioned at origin.
 * matrixWorldInverse: identity (camera at world origin, no rotation)
 * projectionMatrix: standard perspective (FOV 75°, aspect 1, near 0.1, far 2000)
 */
function makeDefaultCamera(): { matrixWorldInverse: Float32Array; projectionMatrix: Float32Array } {
  // Identity matrixWorldInverse
  const mx = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);

  // Perspective projection (FOV=75°, aspect=1, near=0.1, far=2000)
  const fov = 75 * (Math.PI / 180);
  const aspect = 1;
  const near = 0.1;
  const far = 2000;
  const f = 1 / Math.tan(fov / 2);
  const proj = new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ]);

  return { matrixWorldInverse: mx, projectionMatrix: proj };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('projectToScreen', () => {
  const camera = makeDefaultCamera();
  const width = 800;
  const height = 600;

  describe('basic projection', () => {
    it('returns valid=true for a point in front of the camera', () => {
      const result = projectToScreen({ x: 0, y: 0, z: -1 }, camera, width, height);
      expect(result.valid).toBe(true);
    });

    it('marks a point in front of camera as visible', () => {
      const result = projectToScreen({ x: 0, y: 0, z: -1 }, camera, width, height);
      expect(result.visible).toBe(true);
    });

    it('returns finite x/y screen coordinates for a valid point', () => {
      const result = projectToScreen({ x: 0, y: 0, z: -1 }, camera, width, height);
      expect(Number.isFinite(result.x)).toBe(true);
      expect(Number.isFinite(result.y)).toBe(true);
    });

    it('maps left and right to opposite sides of the screen', () => {
      const left = projectToScreen({ x: -1, y: 0, z: -1 }, camera, width, height);
      const right = projectToScreen({ x: 1, y: 0, z: -1 }, camera, width, height);
      expect(left.x).toBeLessThan(right.x);
    });

    it('produces consistent results for the same input', () => {
      const a = projectToScreen({ x: 0, y: 0, z: -1 }, camera, width, height);
      const b = projectToScreen({ x: 0, y: 0, z: -1 }, camera, width, height);
      expect(a.x).toBe(b.x);
      expect(a.y).toBe(b.y);
    });
  });

  describe('behind-camera detection', () => {
    it('marks a point behind the camera as not visible', () => {
      const result = projectToScreen({ x: 0, y: 0, z: 1 }, camera, width, height);
      expect(result.visible).toBe(false);
    });

    it('marks a point far behind camera as not visible', () => {
      const result = projectToScreen({ x: 0, y: 0, z: 100 }, camera, width, height);
      expect(result.visible).toBe(false);
    });

    it('marks a point behind camera even if x/y are finite', () => {
      // Even though the projection math produces numbers, the z check flags it
      const result = projectToScreen({ x: 0, y: 0, z: 5 }, camera, width, height);
      expect(result.valid).toBe(true); // projection math is valid
      expect(result.visible).toBe(false); // but behind camera
    });
  });

  describe('NaN / invalid input handling', () => {
    it('returns valid=false for NaN x', () => {
      const result = projectToScreen({ x: NaN, y: 0, z: -1 }, camera, width, height);
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for Infinity', () => {
      const result = projectToScreen({ x: Infinity, y: 0, z: -1 }, camera, width, height);
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for all-NaN position', () => {
      const result = projectToScreen({ x: NaN, y: NaN, z: NaN }, camera, width, height);
      expect(result.valid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles zero-width container without crashing', () => {
      const result = projectToScreen({ x: 0, y: 0, z: -1 }, camera, 0, 600);
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('visible');
    });

    it('handles zero-height container without crashing', () => {
      const result = projectToScreen({ x: 0, y: 0, z: -1 }, camera, 800, 0);
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('visible');
    });

    it('handles negative dimensions without crashing', () => {
      const result = projectToScreen({ x: 0, y: 0, z: -1 }, camera, -100, -100);
      expect(result).toHaveProperty('valid');
    });

    it('handles all-zero world position', () => {
      const result = projectToScreen({ x: 0, y: 0, z: 0 }, camera, width, height);
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('visible');
    });
  });

  describe('camera orientation changes projection', () => {
    it('camera rotated 180° around Y changes which side is "in front"', () => {
      // 180° rotation around Y — flip the matrixWorldInverse
      const mxRotated = new Float32Array([
        -1, 0, 0, 0,
         0, 1, 0, 0,
         0, 0,-1, 0,
         0, 0, 0, 1,
      ]);
      const cam = makeCamera(mxRotated, camera.projectionMatrix);

      const front = projectToScreen({ x: 0, y: 0, z: 1 }, cam, width, height); // +Z was behind, now in front
      expect(front.visible).toBe(true);
    });
  });
});
