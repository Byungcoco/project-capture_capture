import type { CollisionWorld } from '../domain/collision-world'
import { normalizeVec3 } from '../domain/math'
import type { Vec3 } from '../domain/math'

export interface AimSolution {
  aimPoint: Vec3
  wireAimDirection: Vec3
}

export function solveCameraAim(
  world: CollisionWorld,
  cameraOrigin: Vec3,
  cameraDirection: Vec3,
  playerWireOrigin: Vec3,
  maximumDistance: number,
): AimSolution {
  const direction = normalizeVec3(cameraDirection)
  const shoulderDistance = Math.hypot(
    cameraOrigin.x - playerWireOrigin.x,
    cameraOrigin.y - playerWireOrigin.y,
    cameraOrigin.z - playerWireOrigin.z,
  )
  const cameraQueryDistance = maximumDistance + shoulderDistance
  const hit = world.raycast(cameraOrigin, direction, cameraQueryDistance)
  const candidate = hit?.point ?? pointOnPlayerRange(
    cameraOrigin,
    direction,
    playerWireOrigin,
    maximumDistance,
  )
  const candidatePlayerDistance = Math.hypot(
    candidate.x - playerWireOrigin.x,
    candidate.y - playerWireOrigin.y,
    candidate.z - playerWireOrigin.z,
  )
  const aimPoint = candidatePlayerDistance <= maximumDistance
    ? candidate
    : pointOnPlayerRange(cameraOrigin, direction, playerWireOrigin, maximumDistance)
  return {
    aimPoint,
    wireAimDirection: normalizeVec3({
      x: aimPoint.x - playerWireOrigin.x,
      y: aimPoint.y - playerWireOrigin.y,
      z: aimPoint.z - playerWireOrigin.z,
    }),
  }
}

function pointOnPlayerRange(
  rayOrigin: Vec3,
  rayDirection: Vec3,
  playerOrigin: Vec3,
  radius: number,
): Vec3 {
  const offset = {
    x: rayOrigin.x - playerOrigin.x,
    y: rayOrigin.y - playerOrigin.y,
    z: rayOrigin.z - playerOrigin.z,
  }
  const projection = offset.x * rayDirection.x
    + offset.y * rayDirection.y
    + offset.z * rayDirection.z
  const discriminant = projection * projection
    - (offset.x * offset.x + offset.y * offset.y + offset.z * offset.z - radius * radius)
  const distance = discriminant < 0
    ? radius
    : Math.max(0, -projection + Math.sqrt(discriminant))
  return {
    x: rayOrigin.x + rayDirection.x * distance,
    y: rayOrigin.y + rayDirection.y * distance,
    z: rayOrigin.z + rayDirection.z * distance,
  }
}
