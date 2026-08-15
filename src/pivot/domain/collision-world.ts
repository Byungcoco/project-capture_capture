import type { Vec3 } from './math'

export interface CollisionMoveResult {
  position: Vec3
  velocity: Vec3
  grounded: boolean
  blockedHorizontally: boolean
}

export interface CollisionRayHit {
  point: Vec3
  distance: number
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
}
