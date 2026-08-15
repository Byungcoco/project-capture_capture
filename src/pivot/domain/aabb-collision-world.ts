import type {
  CollisionContact,
  CollisionMoveResult,
  CollisionRayHit,
  CollisionWireCandidate,
  CollisionWorld,
} from './collision-world'
import { normalizeVec3 } from './math'
import type { Aabb3, Vec3 } from './math'
import type { StaticCollider } from './player'

const EPSILON = 1e-8

export function createAabbCollisionWorld(colliders: readonly StaticCollider[]): CollisionWorld {
  const authority = Object.freeze(colliders.map(snapshotCollider))
  const raycastIndex = buildRaycastBvh(authority)
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
        for (const collider of authority) {
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
      return raycastBvh(raycastIndex, origin, direction, maximumDistance)
    },
    sweepSphere(origin, displacement, radius): CollisionRayHit | null {
      if (
        !finiteVec3(origin)
        || !finiteVec3(displacement)
        || lengthSquared(displacement) <= EPSILON * EPSILON
        || !Number.isFinite(radius)
        || radius < 0
      ) return null
      return sweepSphereBvh(raycastIndex, origin, displacement, radius)
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
      for (const collider of authority) {
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
    queryFirstVisibleWireCandidate(
      origin,
      orderedCandidates,
      maximumDistance,
      tolerance,
    ): CollisionWireCandidate | null {
      if (
        !finiteVec3(origin)
        || !Number.isFinite(maximumDistance)
        || maximumDistance < 0
        || !Number.isFinite(tolerance)
        || tolerance < 0
      ) return null
      for (const candidate of orderedCandidates) {
        if (!candidate.wireable || !finiteVec3(candidate.point)) continue
        const offset = subtractVec3(candidate.point, origin)
        const distance = distanceVec3(origin, candidate.point)
        if (distance <= EPSILON || distance > maximumDistance + EPSILON) continue
        const direction = normalizeVec3(offset)
        const hit = raycastBvh(raycastIndex, origin, direction, distance + tolerance)
        if (
          hit !== null
          && hit.wireable
          && distanceVec3(hit.point, candidate.point) <= tolerance
        ) return candidate
      }
      return null
    },
  }
}

function snapshotCollider(collider: StaticCollider): StaticCollider {
  return Object.freeze({
    center: Object.freeze({ ...collider.center }),
    halfSize: Object.freeze({ ...collider.halfSize }),
    wireable: collider.wireable,
  })
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
  points.push(...sphereAabbFaceIntersections(
    origin,
    aimDirection,
    maximumDistance,
    collider,
  ))
  return points
}

function sphereAabbFaceIntersections(
  origin: Vec3,
  aimDirection: Vec3,
  radius: number,
  collider: StaticCollider,
): Vec3[] {
  const points: Vec3[] = []
  for (const faceAxis of ['x', 'y', 'z'] as const) {
    const tangentAxes = (['x', 'y', 'z'] as const).filter((axis) => axis !== faceAxis)
    const firstAxis = tangentAxes[0]
    const secondAxis = tangentAxes[1]
    if (firstAxis === undefined || secondAxis === undefined) continue
    for (const side of [-1, 1] as const) {
      const faceValue = collider.center[faceAxis] + collider.halfSize[faceAxis] * side
      const faceOffset = faceValue - origin[faceAxis]
      const circleSquared = radius * radius - faceOffset * faceOffset
      if (circleSquared < -EPSILON) continue
      const circleRadius = Math.sqrt(Math.max(0, circleSquared))
      const tangentLength = Math.hypot(
        aimDirection[firstAxis],
        aimDirection[secondAxis],
      )
      const directions = tangentLength <= EPSILON
        ? [
            { first: -1, second: 0 },
            { first: 0, second: -1 },
            { first: 0, second: 1 },
            { first: 1, second: 0 },
          ]
        : [{
            first: aimDirection[firstAxis] / tangentLength,
            second: aimDirection[secondAxis] / tangentLength,
          }]
      for (const direction of directions) {
        const firstValue = origin[firstAxis] + direction.first * circleRadius
        const secondValue = origin[secondAxis] + direction.second * circleRadius
        if (!withinAabbAxis(firstValue, firstAxis, collider)) continue
        if (!withinAabbAxis(secondValue, secondAxis, collider)) continue
        const point = { ...origin }
        point[faceAxis] = faceValue
        point[firstAxis] = firstValue
        point[secondAxis] = secondValue
        points.push(point)
      }
    }
  }
  return points
}

function withinAabbAxis(
  value: number,
  axis: keyof Vec3,
  collider: StaticCollider,
): boolean {
  return value >= collider.center[axis] - collider.halfSize[axis] - EPSILON
    && value <= collider.center[axis] + collider.halfSize[axis] + EPSILON
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

interface RaycastBvhNode {
  bounds: Aabb3
  colliders?: readonly StaticCollider[]
  left?: RaycastBvhNode
  right?: RaycastBvhNode
}

const RAYCAST_BVH_LEAF_SIZE = 8

function buildRaycastBvh(colliders: readonly StaticCollider[]): RaycastBvhNode | null {
  if (colliders.length === 0) return null
  const bounds = colliderBounds(colliders)
  if (colliders.length <= RAYCAST_BVH_LEAF_SIZE) return { bounds, colliders: [...colliders] }
  const axis = longestAxis(bounds.halfSize)
  const sorted = [...colliders].sort((first, second) => (
    first.center[axis] - second.center[axis] || compareCollider(first, second)
  ))
  const middle = Math.floor(sorted.length / 2)
  const left = buildRaycastBvh(sorted.slice(0, middle))
  const right = buildRaycastBvh(sorted.slice(middle))
  if (left === null || right === null) return { bounds, colliders: sorted }
  return { bounds, left, right }
}

function raycastBvh(
  root: RaycastBvhNode | null,
  origin: Vec3,
  direction: Vec3,
  maximumDistance: number,
): CollisionRayHit | null {
  if (root === null) return null
  let closest: CollisionRayHit | null = null
  const stack = [root]
  while (stack.length > 0) {
    const node = stack.pop()
    if (node === undefined) continue
    const nodeDistance = rayAabbDistance(origin, direction, node.bounds)
    const searchLimit = Math.min(maximumDistance, closest?.distance ?? maximumDistance)
    if (nodeDistance === null || nodeDistance > searchLimit + EPSILON) continue
    if (node.colliders !== undefined) {
      for (const collider of node.colliders) {
        const distance = rayAabbDistance(origin, direction, collider)
        if (
          distance === null
          || !Number.isFinite(distance)
          || distance > maximumDistance + EPSILON
        ) continue
        if (!shouldReplaceHit(closest, distance, collider.wireable)) continue
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
      continue
    }
    if (node.left !== undefined) stack.push(node.left)
    if (node.right !== undefined) stack.push(node.right)
  }
  return closest
}

function sweepSphereBvh(
  root: RaycastBvhNode | null,
  origin: Vec3,
  displacement: Vec3,
  radius: number,
): CollisionRayHit | null {
  if (root === null) return null
  const maximumDistance = Math.sqrt(lengthSquared(displacement))
  const direction = normalizeVec3(displacement)
  let closest: CollisionRayHit | null = null
  const stack = [root]
  while (stack.length > 0) {
    const node = stack.pop()
    if (node === undefined) continue
    const nodeDistance = rayAabbDistance(origin, direction, expandAabb(node.bounds, radius))
    const searchLimit = Math.min(maximumDistance, closest?.distance ?? maximumDistance)
    if (nodeDistance === null || nodeDistance > searchLimit + EPSILON) continue
    if (node.colliders !== undefined) {
      for (const collider of node.colliders) {
        const distance = sweptSphereAabbDistance(origin, displacement, radius, collider)
        if (
          distance === null
          || !Number.isFinite(distance)
          || distance > maximumDistance + EPSILON
          || !shouldReplaceHit(closest, distance, collider.wireable)
        ) continue
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
      continue
    }
    if (node.left !== undefined) stack.push(node.left)
    if (node.right !== undefined) stack.push(node.right)
  }
  return closest
}

function sweptSphereAabbDistance(
  origin: Vec3,
  displacement: Vec3,
  radius: number,
  collider: Aabb3,
): number | null {
  const radiusSquared = radius * radius
  if (squaredDistanceToAabb(origin, collider) <= radiusSquared + EPSILON) return 0
  const breakpoints = [0, 1]
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(displacement[axis]) <= EPSILON) continue
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
    index === 0 || Math.abs(value - (breakpoints[index - 1] ?? value)) > EPSILON
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
    if (startValue <= EPSILON) return start * Math.sqrt(lengthSquared(displacement))
    if (quadratic <= EPSILON) continue
    const discriminant = linear * linear - 4 * quadratic * constant
    if (discriminant < -EPSILON) continue
    const root = (-linear - Math.sqrt(Math.max(0, discriminant))) / (2 * quadratic)
    if (root >= start - EPSILON && root <= end + EPSILON) {
      return Math.max(start, Math.min(end, root)) * Math.sqrt(lengthSquared(displacement))
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

function expandAabb(collider: Aabb3, radius: number): Aabb3 {
  return {
    center: collider.center,
    halfSize: {
      x: collider.halfSize.x + radius,
      y: collider.halfSize.y + radius,
      z: collider.halfSize.z + radius,
    },
  }
}

function shouldReplaceHit(
  closest: CollisionRayHit | null,
  distance: number,
  wireable: boolean,
): boolean {
  return closest === null
    || distance < closest.distance - EPSILON
    || (
      Math.abs(distance - closest.distance) <= EPSILON
      && !wireable
      && closest.wireable
    )
}

function colliderBounds(colliders: readonly StaticCollider[]): Aabb3 {
  const minimum = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY }
  const maximum = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY }
  for (const collider of colliders) {
    for (const axis of ['x', 'y', 'z'] as const) {
      minimum[axis] = Math.min(minimum[axis], collider.center[axis] - collider.halfSize[axis])
      maximum[axis] = Math.max(maximum[axis], collider.center[axis] + collider.halfSize[axis])
    }
  }
  return {
    center: {
      x: (minimum.x + maximum.x) / 2,
      y: (minimum.y + maximum.y) / 2,
      z: (minimum.z + maximum.z) / 2,
    },
    halfSize: {
      x: (maximum.x - minimum.x) / 2,
      y: (maximum.y - minimum.y) / 2,
      z: (maximum.z - minimum.z) / 2,
    },
  }
}

function longestAxis(halfSize: Vec3): keyof Vec3 {
  if (halfSize.y > halfSize.x && halfSize.y >= halfSize.z) return 'y'
  if (halfSize.z > halfSize.x && halfSize.z > halfSize.y) return 'z'
  return 'x'
}

function compareCollider(first: StaticCollider, second: StaticCollider): number {
  return compareVec3Values(first.center, second.center)
    || compareVec3Values(first.halfSize, second.halfSize)
    || Number(first.wireable) - Number(second.wireable)
}

function compareVec3Values(first: Vec3, second: Vec3): number {
  return first.x - second.x || first.y - second.y || first.z - second.z
}

function overlaps(position: Vec3, halfSize: Vec3, collider: StaticCollider): boolean {
  return Math.abs(position.x - collider.center.x) < halfSize.x + collider.halfSize.x
    && Math.abs(position.y - collider.center.y) < halfSize.y + collider.halfSize.y
    && Math.abs(position.z - collider.center.z) < halfSize.z + collider.halfSize.z
}

function rayAabbDistance(origin: Vec3, direction: Vec3, collider: Aabb3): number | null {
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
