import type { Vec3 } from './math'

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
  queryWireCandidates?(
    origin: Vec3,
    aimDirection: Vec3,
    maximumDistance: number,
  ): readonly CollisionWireCandidate[]
}
