import type { PlayerCommand } from './commands'
import { TICK_SECONDS } from '../../core/constants'
import { createAabbCollisionWorld } from './aabb-collision-world'
import type { CollisionWorld } from './collision-world'
import { createPlayerState, stepPlayer } from './player'
import type { PlayerState, StaticCollider } from './player'

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
  snapshotColliders: readonly StaticCollider[]
}

export interface PivotSessionOptions {
  player?: PlayerState
  colliders?: readonly StaticCollider[]
  world?: CollisionWorld
}

export function createPivotSession(
  options: PivotSessionOptions = {},
): PivotSession {
  const authorityColliders = cloneColliders(options.colliders ?? [])
  const snapshotColliders = freezeColliders(authorityColliders)
  const state: WorldState = {
    tick: 0,
    player: structuredClone(options.player ?? createPlayerState()),
    colliders: authorityColliders,
  }
  return {
    state,
    snapshot: toSnapshot(state, snapshotColliders),
    world: options.world ?? createAabbCollisionWorld(state.colliders),
    snapshotColliders,
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
  return {
    state,
    snapshot: toSnapshot(state, session.snapshotColliders),
    world: session.world,
    snapshotColliders: session.snapshotColliders,
  }
}

function toSnapshot(
  state: WorldState,
  snapshotColliders: readonly StaticCollider[],
): GameSnapshot {
  return {
    tick: state.tick,
    player: structuredClone(state.player),
    colliders: snapshotColliders,
  }
}

function cloneColliders(colliders: readonly StaticCollider[]): StaticCollider[] {
  return colliders.map((collider) => ({
    center: { ...collider.center },
    halfSize: { ...collider.halfSize },
    wireable: collider.wireable,
  }))
}

function freezeColliders(
  colliders: readonly StaticCollider[],
): readonly StaticCollider[] {
  const frozen = colliders.map((collider) => Object.freeze({
    center: Object.freeze({ ...collider.center }),
    halfSize: Object.freeze({ ...collider.halfSize }),
    wireable: collider.wireable,
  }))
  return Object.freeze(frozen)
}
