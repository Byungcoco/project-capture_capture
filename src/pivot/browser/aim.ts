import type { CollisionWorld } from '../domain/collision-world'
import { normalizeVec3 } from '../domain/math'
import type { Vec3 } from '../domain/math'

export interface AimSolution {
  aimPoint: Vec3
  aimDirection: Vec3
}

export function solveCameraAim(
  world: CollisionWorld,
  cameraOrigin: Vec3,
  cameraDirection: Vec3,
  playerWireOrigin: Vec3,
  maximumDistance: number,
): AimSolution {
  const direction = normalizeVec3(cameraDirection)
  const hit = world.raycast(cameraOrigin, direction, maximumDistance)
  const aimPoint = hit?.point ?? {
    x: cameraOrigin.x + direction.x * maximumDistance,
    y: cameraOrigin.y + direction.y * maximumDistance,
    z: cameraOrigin.z + direction.z * maximumDistance,
  }
  return {
    aimPoint,
    aimDirection: normalizeVec3({
      x: aimPoint.x - playerWireOrigin.x,
      y: aimPoint.y - playerWireOrigin.y,
      z: aimPoint.z - playerWireOrigin.z,
    }),
  }
}
