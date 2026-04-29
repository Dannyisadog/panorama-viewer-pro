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

/**
 * Ray-sphere intersection: find the point where a ray from the camera through
 * the given screen position hits a sphere of given radius centered at origin.
 *
 * This mirrors what THREE.Ray.intersectSphere does, but is a pure function
 * that can be unit tested without Three.js.
 *
 * @param screenPos    - Screen position { x, y } in pixels
 * @param camera       - Camera with projectionMatrix + matrixWorldInverse
 * @param width        - Container width in pixels
 * @param height       - Container height in pixels
 * @param sphereRadius - Panorama sphere radius (default 500)
 * @returns World position { x, y, z } on the sphere, or null if no hit
 */
export function unprojectToSphere(
  screenPos: { x: number; y: number },
  camera: { projectionMatrix: Float32Array; matrixWorldInverse: Float32Array },
  width: number,
  height: number,
  sphereRadius: number = 500
): Vec3 | null {
  // Normalize screen coords to [-1, +1]
  const nx = (screenPos.x / width) * 2 - 1;
  const ny = -((screenPos.y / height) * 2 - 1);

  // Ray in camera space: perspective ray goes from origin through (nx, ny, -1)
  const rayCamX = nx;
  const rayCamY = ny;
  const rayCamZ = -1;

  const mx = camera.matrixWorldInverse;

  // Camera position in world space (column 3 of matrixWorldInverse)
  const camWorldX = mx[12];
  const camWorldY = mx[13];
  const camWorldZ = mx[14];

  // Transform ray direction from camera space to world space (transpose of matrixWorldInverse)
  const dirX = mx[0] * rayCamX + mx[1] * rayCamY + mx[2] * rayCamZ;
  const dirY = mx[4] * rayCamX + mx[5] * rayCamY + mx[6] * rayCamZ;
  const dirZ = mx[8] * rayCamX + mx[9] * rayCamY + mx[10] * rayCamZ;

  // Ray-sphere intersection: |O + tD|² = r²
  const ox = camWorldX;
  const oy = camWorldY;
  const oz = camWorldZ;

  const a = dirX * dirX + dirY * dirY + dirZ * dirZ;
  const b = 2 * (ox * dirX + oy * dirY + oz * dirZ);
  const c = ox * ox + oy * oy + oz * oz - sphereRadius * sphereRadius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const sqrtD = Math.sqrt(discriminant);

  // Camera is INSIDE the sphere (|O| < r). The two roots give intersections
  // on opposite sides of the sphere. We need the one in front of the camera.
  // For perspective camera looking in -Z direction, forward hit has negative z.
  // t1 = (-b - sqrtD)/(2a), t2 = (-b + sqrtD)/(2a)
  // Camera at origin → t1 = -sqrtD/a, t2 = +sqrtD/a
  // We pick the root that gives a forward (negative z for identity camera) hit.
  let t1 = (-b - sqrtD) / (2 * a);
  let t2 = (-b + sqrtD) / (2 * a);

  let t: number;
  // If camera is inside the sphere, pick the root with positive t (forward direction)
  // If outside, pick the smaller |t| (nearer intersection)
  const camDistSq = ox * ox + oy * oy + oz * oz;
  if (camDistSq < sphereRadius * sphereRadius) {
    // Inside: pick positive t
    t = t2 > 0 ? t2 : t1;
  } else {
    // Outside: pick the smaller positive t
    t = t1 > 0 ? t1 : t2;
  }

  const hitX = ox + t * dirX;
  const hitY = oy + t * dirY;
  const hitZ = oz + t * dirZ;

  if (!Number.isFinite(hitX) || !Number.isFinite(hitY) || !Number.isFinite(hitZ)) return null;

  return { x: hitX, y: hitY, z: hitZ };
}
