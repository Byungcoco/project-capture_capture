import type { Aabb3, Vec3 } from './math'

const SPHERE_SWEEP_EPSILON = 1e-8

export type CollisionAxis = 'x' | 'y' | 'z'

export interface CollisionContact {
  axis: CollisionAxis
  normal: -1 | 1
}

export interface CollisionMoveResult {
  position: Vec3
  velocity: Vec3
  grounded: boolean
  blocked: boolean
  contacts: readonly CollisionContact[]
}

export interface CollisionRayHit {
  point: Vec3
  distance: number
  wireable: boolean
}

export interface CollisionWireCandidate {
  point: Vec3
  wireable: boolean
}

export interface CollisionWorld {
  moveAabb(
    position: Vec3,
    velocity: Vec3,
    halfSize: Vec3,
    stepSeconds: number,
  ): CollisionMoveResult
  raycast(origin: Vec3, direction: Vec3, maximumDistance: number): CollisionRayHit | null
  sweepSphere(origin: Vec3, displacement: Vec3, radius: number): CollisionRayHit | null
  queryWireCandidates?(
    origin: Vec3,
    aimDirection: Vec3,
    maximumDistance: number,
  ): readonly CollisionWireCandidate[]
  queryFirstVisibleWireCandidate?(
    origin: Vec3,
    orderedCandidates: readonly CollisionWireCandidate[],
    maximumDistance: number,
    tolerance: number,
  ): CollisionWireCandidate | null
}

export function sweptSphereAabbDistance(
  origin: Vec3,
  displacement: Vec3,
  radius: number,
  collider: Aabb3,
): number | null {
  if (!finiteVec3(origin) || !finiteVec3(displacement) || !Number.isFinite(radius) || radius < 0) {
    return null
  }
  const radiusSquared = radius * radius
  if (squaredDistanceToAabb(origin, collider) <= radiusSquared + SPHERE_SWEEP_EPSILON) return 0
  const travelDistance = Math.hypot(displacement.x, displacement.y, displacement.z)
  if (travelDistance <= SPHERE_SWEEP_EPSILON) return null
  const breakpoints = [0, 1]
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(displacement[axis]) <= SPHERE_SWEEP_EPSILON) continue
    for (const boundary of [
      collider.center[axis] - collider.halfSize[axis],
      collider.center[axis] + collider.halfSize[axis],
    ]) {
      const time = (boundary - origin[axis]) / displacement[axis]
      if (time > 0 && time < 1) breakpoints.push(time)
    }
  }
  breakpoints.sort((first, second) => first - second)
  const uniqueBreakpoints = breakpoints.filter((value, index) => (
    index === 0
    || Math.abs(value - (breakpoints[index - 1] ?? value)) > SPHERE_SWEEP_EPSILON
  ))
  for (let index = 0; index < uniqueBreakpoints.length - 1; index += 1) {
    const start = uniqueBreakpoints[index] ?? 0
    const end = uniqueBreakpoints[index + 1] ?? 1
    const middle = (start + end) / 2
    let quadratic = 0
    let linear = 0
    let constant = -radiusSquared
    for (const axis of ['x', 'y', 'z'] as const) {
      const point = origin[axis] + displacement[axis] * middle
      const lower = collider.center[axis] - collider.halfSize[axis]
      const upper = collider.center[axis] + collider.halfSize[axis]
      const boundary = point < lower ? lower : point > upper ? upper : null
      if (boundary === null) continue
      const offset = origin[axis] - boundary
      quadratic += displacement[axis] * displacement[axis]
      linear += 2 * displacement[axis] * offset
      constant += offset * offset
    }
    const startValue = quadratic * start * start + linear * start + constant
    if (startValue <= SPHERE_SWEEP_EPSILON) return start * travelDistance
    if (quadratic <= SPHERE_SWEEP_EPSILON) continue
    const discriminant = linear * linear - 4 * quadratic * constant
    if (discriminant < -SPHERE_SWEEP_EPSILON) continue
    const root = (-linear - Math.sqrt(Math.max(0, discriminant))) / (2 * quadratic)
    if (root >= start - SPHERE_SWEEP_EPSILON && root <= end + SPHERE_SWEEP_EPSILON) {
      return Math.max(start, Math.min(end, root)) * travelDistance
    }
  }
  return null
}

function squaredDistanceToAabb(point: Vec3, collider: Aabb3): number {
  let result = 0
  for (const axis of ['x', 'y', 'z'] as const) {
    const lower = collider.center[axis] - collider.halfSize[axis]
    const upper = collider.center[axis] + collider.halfSize[axis]
    const offset = point[axis] < lower
      ? lower - point[axis]
      : point[axis] > upper ? point[axis] - upper : 0
    result += offset * offset
  }
  return result
}

function finiteVec3(value: Vec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}
