/**
 * Spherical coordinate math utilities for panorama camera control.
 *
 * Coordinate system:
 *   - longitude (theta): horizontal angle, radians, 0 = facing -Z, increases CW when viewed from above
 *   - latitude (phi):     vertical angle, radians, 0 = horizon, positive = looking up
 *
 * Camera direction from spherical coords:
 *   x = cos(phi) * sin(theta)
 *   y = sin(phi)
 *   z = -cos(phi) * cos(theta)
 */

export const SPHERE_RADIUS = 500;

/**
 * Convert yaw/pitch (degrees) to a 3D unit direction vector.
 * Used for placing hotspot markers on the sphere surface.
 */
export function yawPitchToVector(yawDeg: number, pitchDeg: number): [x: number, y: number, z: number] {
  const theta = (-yawDeg + 90) * (Math.PI / 180); // longitude: 0° = front (-Z), yaw offset
  const phi = pitchDeg * (Math.PI / 180);           // latitude: 0° = horizon

  return [
    Math.cos(phi) * Math.sin(theta),
    Math.sin(phi),
    -Math.cos(phi) * Math.cos(theta),
  ];
}

/**
 * Convert a 3D direction vector back to yaw/pitch in degrees.
 * Used for getting current view direction from camera.
 */
export function vectorToYawPitch(x: number, y: number, z: number): { yaw: number; pitch: number } {
  const r = Math.sqrt(x * x + y * y + z * z);
  const pitch = (Math.asin(y / r) * 180) / Math.PI;
  // theta: atan2(sin(theta), -cos(theta)) where z = -cos(phi)*cos(theta)
  // Rearranged: theta = atan2(x, -z)
  const yaw = (Math.atan2(x, -z) * 180) / Math.PI;
  return { yaw, pitch };
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
