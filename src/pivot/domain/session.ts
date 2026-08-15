import type { PlayerCommand } from './commands'
import { TICK_SECONDS } from '../../core/constants'
import { createAabbCollisionWorld } from './aabb-collision-world'
import type { CollisionWorld } from './collision-world'
import { createPlayerState, stepPlayer } from './player'
import type { PlayerState, StaticCollider } from './player'
import type { Vec3 } from './math'

export interface WorldState {
  tick: number
  player: PlayerState
  colliders: readonly StaticCollider[]
}

export interface GameSnapshot {
  tick: number
  player: PlayerState
  colliders: readonly StaticCollider[]
}

export interface PivotSession {
  state: WorldState
  snapshot: GameSnapshot
  world: CollisionWorld
}

export interface PivotSessionOptions {
  player?: PlayerState
  colliders?: readonly StaticCollider[]
  world?: CollisionWorld
}

export function createPivotSession(
  options: PivotSessionOptions = {},
): PivotSession {
  const state: WorldState = {
    tick: 0,
    player: options.player ?? createPlayerState(),
    colliders: options.colliders ?? [],
  }
  return {
    state,
    snapshot: toSnapshot(state),
    world: options.world ?? createAabbCollisionWorld(state.colliders),
  }
}

export function stepPivotSession(
  session: PivotSession,
  command: PlayerCommand,
): PivotSession {
  const state: WorldState = {
    ...session.state,
    tick: session.state.tick + 1,
    player: stepPlayer(session.state.player, command, session.world, TICK_SECONDS),
  }
  return { state, snapshot: toSnapshot(state), world: session.world }
}

function toSnapshot(state: WorldState): GameSnapshot {
  return {
    tick: state.tick,
    player: structuredClone(state.player),
    colliders: state.colliders,
  }
}

export function playerAabbRight(player: PlayerState): number {
  return player.position.x + player.halfSize.x
}

export function speedOf(velocity: Vec3): number {
  return Math.hypot(velocity.x, velocity.y, velocity.z)
}
