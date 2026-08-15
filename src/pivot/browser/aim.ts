import type { CollisionWorld } from '../domain/collision-world'
import type { Vec3 } from '../domain/math'

export interface AimSolution {
  aimPoint: Vec3
  aimDirection: Vec3
}

export function solveCameraAim(
  _world: CollisionWorld,
  cameraOrigin: Vec3,
  cameraDirection: Vec3,
  _playerWireOrigin: Vec3,
  _maximumDistance: number,
): AimSolution {
  return { aimPoint: cameraOrigin, aimDirection: cameraDirection }
}
