/**
 * Projection utilities for converting 3D annotation positions to 2D screen coords.
 * These are pure functions — no Three.js dependency, no side effects.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ScreenPosition {
  x: number;
  y: number;
  /** Whether the point is in front of the camera (z <= 1 in NDC) */
  visible: boolean;
  /** Whether the projection produced valid finite numbers */
  valid: boolean;
}

/**
 * Project a 3D world position to 2D screen coordinates using a camera-like object.
 *
 * @param position  - 3D world position of the annotation
 * @param camera    - Object with `position`, `projectionMatrix`, `matrixWorldInverse`
 *                    (THREE.Camera satisfies this shape)
 * @param width     - Container width in pixels
 * @param height    - Container height in pixels
 */
export function projectToScreen(
  position: Vec3,
  camera: { projectionMatrix: Float32Array; matrixWorldInverse: Float32Array },
  width: number,
  height: number
): ScreenPosition {
  // ── Manual perspective projection ─────────────────────────────────────────
  // Simulates what Three.js Vector3.project(camera) does, without Three.js.
  //
  // Step 1: world space → camera space (multiply by matrixWorldInverse)
  // Step 2: camera space → clip space (multiply by projectionMatrix)
  // Step 3: clip space → NDC (divide by w)
  // Step 4: NDC → screen (viewport transform)

  const mx = camera.matrixWorldInverse;
  const proj = camera.projectionMatrix;

  // Camera-space position
  const cx = mx[0] * position.x + mx[4] * position.y + mx[8] * position.z + mx[12];
  const cy = mx[1] * position.x + mx[5] * position.y + mx[9] * position.z + mx[13];
  const cz = mx[2] * position.x + mx[6] * position.y + mx[10] * position.z + mx[14];
  const cw = mx[3] * position.x + mx[7] * position.y + mx[11] * position.z + mx[15];

  // Clip space
  const ox = proj[0] * cx + proj[4] * cy + proj[8] * cz + proj[12] * cw;
  const ow = proj[3] * cx + proj[7] * cy + proj[11] * cz + proj[15] * cw;

  // NDC (normalized device coordinates)
  const nx = ow !== 0 ? ox / ow : 0;
  const nz = ow !== 0 ? (proj[2] * cx + proj[6] * cy + proj[10] * cz + proj[14] * cw) / ow : 0;

  // Check for valid finite projection
  const valid = Number.isFinite(nx) && Number.isFinite(nz);

  // Screen coordinates
  const screenX = valid ? (nx * 0.5 + 0.5) * width : 0;
  const screenY = valid ? ((-nz * 0.5 + 0.5)) * height : 0;

  // In NDC clip space, z > 1 means behind camera (far plane = +1, camera = -1)
  const visible = valid && nz <= 1;

  return { x: screenX, y: screenY, visible, valid };
}
