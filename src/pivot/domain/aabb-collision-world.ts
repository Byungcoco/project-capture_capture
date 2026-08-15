import type {
  CollisionContact,
  CollisionMoveResult,
  CollisionRayHit,
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
  }
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
