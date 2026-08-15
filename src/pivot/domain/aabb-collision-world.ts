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
      if (
        !finiteVec3(origin)
        || !finiteVec3(directionValue)
        || lengthSquared(directionValue) <= EPSILON * EPSILON
        || !Number.isFinite(maximumDistance)
        || maximumDistance < 0
      ) return null
      const direction = normalizeVec3(directionValue)
      let closest: CollisionRayHit | null = null
      for (const collider of colliders) {
        const distance = rayAabbDistance(origin, direction, collider)
        if (distance === null || !Number.isFinite(distance) || distance > maximumDistance) continue
        if (
          closest === null
          || distance < closest.distance - EPSILON
          || (
            Math.abs(distance - closest.distance) <= EPSILON
            && !collider.wireable
            && closest.wireable
          )
        ) {
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
      if (
        !finiteVec3(origin)
        || !finiteVec3(aimDirectionValue)
        || !Number.isFinite(maximumDistance)
        || maximumDistance < 0
      ) return []
      const aimDirection = lengthSquared(aimDirectionValue) <= EPSILON * EPSILON
        ? { x: 0, y: 0, z: 0 }
        : normalizeVec3(aimDirectionValue)
      const candidates: CollisionWireCandidate[] = []
      const candidateKeys = new Set<string>()
      for (const collider of colliders) {
        const points = aabbWireCandidatePoints(
          origin,
          aimDirection,
          collider,
          maximumDistance,
        ).filter((point) => distanceVec3(origin, point) <= maximumDistance + EPSILON)
        const closestPoint = closestPointOnAabbSurface(origin, collider)
        const selected = distanceVec3(origin, closestPoint) <= maximumDistance + EPSILON
          ? [closestPoint]
          : []
        const bestAimPoint = lengthSquared(aimDirection) <= EPSILON * EPSILON
          ? undefined
          : points.sort((first, second) => compareAimPoint(
              origin,
              aimDirection,
              first,
              second,
            ))[0]
        if (bestAimPoint !== undefined) selected.push(bestAimPoint)
        for (const point of selected) {
          const key = `${point.x},${point.y},${point.z},${collider.wireable}`
          if (candidateKeys.has(key)) continue
          candidateKeys.add(key)
          candidates.push({ point, wireable: collider.wireable })
        }
      }
      return candidates
    },
  }
}

function aabbWireCandidatePoints(
  origin: Vec3,
  aimDirection: Vec3,
  collider: StaticCollider,
  maximumDistance: number,
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
  points.push(...sphereAabbEdgeIntersections(origin, maximumDistance, collider))
  return points
}

function sphereAabbEdgeIntersections(
  origin: Vec3,
  radius: number,
  collider: StaticCollider,
): Vec3[] {
  const points: Vec3[] = []
  for (const variableAxis of ['x', 'y', 'z'] as const) {
    const fixedAxes = (['x', 'y', 'z'] as const).filter((axis) => axis !== variableAxis)
    const firstAxis = fixedAxes[0]
    const secondAxis = fixedAxes[1]
    if (firstAxis === undefined || secondAxis === undefined) continue
    for (const firstSide of [-1, 1] as const) {
      for (const secondSide of [-1, 1] as const) {
        const firstValue = collider.center[firstAxis]
          + collider.halfSize[firstAxis] * firstSide
        const secondValue = collider.center[secondAxis]
          + collider.halfSize[secondAxis] * secondSide
        const remainingSquared = radius * radius
          - (firstValue - origin[firstAxis]) ** 2
          - (secondValue - origin[secondAxis]) ** 2
        if (remainingSquared < -EPSILON) continue
        const variableOffset = Math.sqrt(Math.max(0, remainingSquared))
        for (const direction of [-1, 1] as const) {
          const variableValue = origin[variableAxis] + variableOffset * direction
          const lower = collider.center[variableAxis] - collider.halfSize[variableAxis]
          const upper = collider.center[variableAxis] + collider.halfSize[variableAxis]
          if (variableValue < lower - EPSILON || variableValue > upper + EPSILON) continue
          const point = { ...origin }
          point[firstAxis] = firstValue
          point[secondAxis] = secondValue
          point[variableAxis] = clamp(variableValue, lower, upper)
          points.push(point)
        }
      }
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

function finiteVec3(value: Vec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function lengthSquared(value: Vec3): number {
  return value.x * value.x + value.y * value.y + value.z * value.z
}

function compareAimPoint(
  origin: Vec3,
  aimDirection: Vec3,
  first: Vec3,
  second: Vec3,
): number {
  const firstOffset = subtractVec3(first, origin)
  const secondOffset = subtractVec3(second, origin)
  const firstDistance = distanceVec3(origin, first)
  const secondDistance = distanceVec3(origin, second)
  const firstCosine = firstDistance <= EPSILON
    ? Number.NEGATIVE_INFINITY
    : dotVec3(firstOffset, aimDirection) / firstDistance
  const secondCosine = secondDistance <= EPSILON
    ? Number.NEGATIVE_INFINITY
    : dotVec3(secondOffset, aimDirection) / secondDistance
  return secondCosine - firstCosine
    || firstDistance - secondDistance
    || comparePoint(first, second)
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
