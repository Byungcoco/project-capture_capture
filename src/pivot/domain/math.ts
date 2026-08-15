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

export function normalizeVec3(value: Vec3): Vec3 {
  const length = lengthVec3(value)
  if (length === 0) return { x: 0, y: 0, z: 0 }
  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  }
}

export function clampVec3Length(value: Vec3, maximum: number): Vec3 {
  const length = lengthVec3(value)
  if (length <= maximum || length === 0) return value
  const scale = maximum / length
  return { x: value.x * scale, y: value.y * scale, z: value.z * scale }
}
