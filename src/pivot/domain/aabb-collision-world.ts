import type {
  CollisionContact,
  CollisionMoveResult,
  CollisionRayHit,
  CollisionWireCandidate,
  CollisionWorld,
} from './collision-world'
import { normalizeVec3 } from './math'
import type { Vec3 } from './math'
import type { StaticCollider } from './player'

const EPSILON = 1e-8

export function createAabbCollisionWorld(colliders: readonly StaticCollider[]): CollisionWorld {
  return {
    moveAabb(positionValue, velocityValue, halfSize, stepSeconds): CollisionMoveResult {
      const position = { ...positionValue }
      const velocity = { ...velocityValue }
      let grounded = false
      let blocked = false
      const contacts: CollisionContact[] = []
      for (const axis of ['x', 'y', 'z'] as const) {
        const delta = velocity[axis] * stepSeconds
        position[axis] += delta
        for (const collider of colliders) {
          if (delta === 0 || !overlaps(position, halfSize, collider)) continue
          position[axis] = delta > 0
            ? collider.center[axis] - collider.halfSize[axis] - halfSize[axis]
            : collider.center[axis] + collider.halfSize[axis] + halfSize[axis]
          velocity[axis] = 0
          blocked = true
          contacts.push({ axis, normal: delta > 0 ? -1 : 1 })
          if (axis === 'y' && delta < 0) grounded = true
        }
      }
      return { position, velocity, grounded, blocked, contacts }
    },
    raycast(origin, directionValue, maximumDistance): CollisionRayHit | null {
      const direction = normalizeVec3(directionValue)
      let closest: CollisionRayHit | null = null
      for (const collider of colliders) {
        const distance = rayAabbDistance(origin, direction, collider)
        if (distance === null || distance > maximumDistance) continue
        if (closest === null || distance < closest.distance) {
          closest = {
            distance,
            wireable: collider.wireable,
            point: {
              x: origin.x + direction.x * distance,
              y: origin.y + direction.y * distance,
              z: origin.z + direction.z * distance,
            },
          }
        }
      }
      return closest
    },
    queryWireCandidates(origin, aimDirectionValue, maximumDistance): CollisionWireCandidate[] {
      const aimDirection = normalizeVec3(aimDirectionValue)
      const candidates: CollisionWireCandidate[] = []
      const candidateKeys = new Set<string>()
      for (const collider of colliders) {
        for (const point of aabbWireCandidatePoints(origin, aimDirection, collider)) {
          if (distanceVec3(origin, point) > maximumDistance + EPSILON) continue
          const key = `${point.x},${point.y},${point.z},${collider.wireable}`
          if (candidateKeys.has(key)) continue
          candidateKeys.add(key)
          candidates.push({ point, wireable: collider.wireable })
        }
      }
      return candidates.sort((first, second) => (
        comparePoint(first.point, second.point)
        || Number(first.wireable) - Number(second.wireable)
      ))
    },
  }
}

function aabbWireCandidatePoints(
  origin: Vec3,
  aimDirection: Vec3,
  collider: StaticCollider,
): Vec3[] {
  const points = [closestPointOnAabbSurface(origin, collider)]
  for (const axis of ['x', 'y', 'z'] as const) {
    for (const side of [-1, 1] as const) {
      const face = collider.center[axis] + collider.halfSize[axis] * side
      const directionComponent = aimDirection[axis]
      let alongRay = Math.abs(directionComponent) <= EPSILON
        ? dotVec3(subtractVec3(collider.center, origin), aimDirection)
        : (face - origin[axis]) / directionComponent
      if (alongRay < 0) continue
      if (!Number.isFinite(alongRay)) alongRay = 0
      const point = {
        x: origin.x + aimDirection.x * alongRay,
        y: origin.y + aimDirection.y * alongRay,
        z: origin.z + aimDirection.z * alongRay,
      }
      point[axis] = face
      for (const otherAxis of ['x', 'y', 'z'] as const) {
        if (otherAxis === axis) continue
        point[otherAxis] = clamp(
          point[otherAxis],
          collider.center[otherAxis] - collider.halfSize[otherAxis],
          collider.center[otherAxis] + collider.halfSize[otherAxis],
        )
      }
      points.push(point)
    }
  }
  return points
}

function closestPointOnAabbSurface(origin: Vec3, collider: StaticCollider): Vec3 {
  const point = {
    x: clamp(origin.x, collider.center.x - collider.halfSize.x, collider.center.x + collider.halfSize.x),
    y: clamp(origin.y, collider.center.y - collider.halfSize.y, collider.center.y + collider.halfSize.y),
    z: clamp(origin.z, collider.center.z - collider.halfSize.z, collider.center.z + collider.halfSize.z),
  }
  const originOutside = (['x', 'y', 'z'] as const).some((axis) => (
    origin[axis] < collider.center[axis] - collider.halfSize[axis]
    || origin[axis] > collider.center[axis] + collider.halfSize[axis]
  ))
  if (originOutside) return point

  let closestAxis: keyof Vec3 = 'x'
  let closestFace = collider.center.x - collider.halfSize.x
  let closestDistance = Math.abs(origin.x - closestFace)
  for (const axis of ['x', 'y', 'z'] as const) {
    for (const side of [-1, 1] as const) {
      const face = collider.center[axis] + collider.halfSize[axis] * side
      const faceDistance = Math.abs(origin[axis] - face)
      if (faceDistance < closestDistance) {
        closestAxis = axis
        closestFace = face
        closestDistance = faceDistance
      }
    }
  }
  point[closestAxis] = closestFace
  return point
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value))
}

function subtractVec3(first: Vec3, second: Vec3): Vec3 {
  return { x: first.x - second.x, y: first.y - second.y, z: first.z - second.z }
}

function dotVec3(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

function distanceVec3(first: Vec3, second: Vec3): number {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z)
}

function comparePoint(first: Vec3, second: Vec3): number {
  return first.x - second.x || first.y - second.y || first.z - second.z
}

function overlaps(position: Vec3, halfSize: Vec3, collider: StaticCollider): boolean {
  return Math.abs(position.x - collider.center.x) < halfSize.x + collider.halfSize.x
    && Math.abs(position.y - collider.center.y) < halfSize.y + collider.halfSize.y
    && Math.abs(position.z - collider.center.z) < halfSize.z + collider.halfSize.z
}

function rayAabbDistance(origin: Vec3, direction: Vec3, collider: StaticCollider): number | null {
  let minimum = 0
  let maximum = Number.POSITIVE_INFINITY
  for (const axis of ['x', 'y', 'z'] as const) {
    const lower = collider.center[axis] - collider.halfSize[axis]
    const upper = collider.center[axis] + collider.halfSize[axis]
    if (Math.abs(direction[axis]) <= EPSILON) {
      if (origin[axis] < lower || origin[axis] > upper) return null
      continue
    }
    const first = (lower - origin[axis]) / direction[axis]
    const second = (upper - origin[axis]) / direction[axis]
    minimum = Math.max(minimum, Math.min(first, second))
    maximum = Math.min(maximum, Math.max(first, second))
    if (maximum < minimum) return null
  }
  return minimum
}
