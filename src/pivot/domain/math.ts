export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Aabb3 {
  center: Vec3
  halfSize: Vec3
}

export function lengthVec3(value: Vec3): number {
  return Math.hypot(value.x, value.y, value.z)
}
