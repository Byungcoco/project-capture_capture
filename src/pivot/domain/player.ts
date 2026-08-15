import type { PlayerCommand } from './commands'
import type { CollisionWorld } from './collision-world'
import type { Aabb3, Vec3 } from './math'

export const PLAYER_HALF_SIZE: Readonly<Vec3> = { x: 0.4, y: 0.9, z: 0.4 }
export const JUMP_SPEED = 10
export const MAX_WIRE_RELEASE_SPEED = 30

export interface StaticCollider extends Aabb3 {
  wireable: boolean
}

export interface WirePullState {
  anchor: Vec3
  ticksRemaining: number
}

export interface PlayerState {
  position: Vec3
  velocity: Vec3
  halfSize: Vec3
  grounded: boolean
  airJumpsRemaining: number
  dashAvailable: boolean
  dashTicksRemaining: number
  wire: WirePullState | null
}

export function createPlayerState(
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    position: { x: 0, y: PLAYER_HALF_SIZE.y, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    halfSize: { ...PLAYER_HALF_SIZE },
    grounded: true,
    airJumpsRemaining: 1,
    dashAvailable: true,
    dashTicksRemaining: 0,
    wire: null,
    ...overrides,
  }
}

export function stepPlayer(
  state: PlayerState,
  _command: PlayerCommand,
  _world: readonly StaticCollider[] | CollisionWorld,
  _stepSeconds: number,
): PlayerState {
  return structuredClone(state)
}
