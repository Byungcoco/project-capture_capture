import type { PlayerCommand } from './commands'
import { TICK_SECONDS } from '../../core/constants'
import { createAabbCollisionWorld } from './aabb-collision-world'
import { captureCells } from './capture'
import type { CapturedChunk } from './capture'
import { createCellCollisionWorld, sortTerrainCells } from './cell-world'
import type { TerrainCell } from './cell-world'
import type { CollisionWorld } from './collision-world'
import { createPlayerState, stepPlayer } from './player'
import type { PlayerState, StaticCollider } from './player'

export interface WorldState {
  tick: number
  player: PlayerState
  colliders: readonly StaticCollider[]
  terrain: readonly TerrainCell[]
  captureStack: readonly CapturedChunk[]
}

export interface GameSnapshot {
  tick: number
  player: PlayerState
  colliders: readonly StaticCollider[]
  terrain: readonly TerrainCell[]
  captureStack: readonly CapturedChunk[]
}

export interface PivotSession {
  state: WorldState
  snapshot: GameSnapshot
  world: CollisionWorld
  snapshotColliders: readonly StaticCollider[]
  usesCellTerrain: boolean
}

export interface PivotSessionOptions {
  player?: PlayerState
  colliders?: readonly StaticCollider[]
  world?: CollisionWorld
  terrain?: readonly TerrainCell[]
  captureStack?: readonly CapturedChunk[]
}

export function createPivotSession(
  options: PivotSessionOptions = {},
): PivotSession {
  const authorityColliders = cloneColliders(options.colliders ?? [])
  const usesCellTerrain = options.terrain !== undefined
  const snapshotColliders = freezeColliders(authorityColliders)
  const state: WorldState = {
    tick: 0,
    player: structuredClone(options.player ?? createPlayerState()),
    colliders: authorityColliders,
    terrain: cloneTerrain(options.terrain ?? []),
    captureStack: structuredClone(options.captureStack ?? []),
  }
  return {
    state,
    snapshot: toSnapshot(state, snapshotColliders),
    world: options.world ?? (usesCellTerrain
      ? createCellCollisionWorld(state.terrain)
      : createAabbCollisionWorld(state.colliders)),
    snapshotColliders,
    usesCellTerrain,
  }
}

export function stepPivotSession(
  session: PivotSession,
  command: PlayerCommand,
): PivotSession {
  const tick = session.state.tick + 1
  const captureResult = command.capturePressed && session.usesCellTerrain
    ? captureCells(
        {
          terrain: session.state.terrain,
          stack: session.state.captureStack,
        },
        {
          tick,
          origin: command.captureOrigin,
          direction: command.captureDirection,
          basis: command.captureBasis,
        },
      )
    : null
  const terrain = captureResult?.state.terrain ?? session.state.terrain
  const captureStack = captureResult?.state.stack ?? session.state.captureStack
  const world = captureResult?.ok
    ? createCellCollisionWorld(terrain)
    : session.world
  const state: WorldState = {
    ...session.state,
    tick,
    terrain,
    captureStack,
    player: stepPlayer(session.state.player, command, world, TICK_SECONDS),
  }
  return {
    state,
    snapshot: toSnapshot(state, session.snapshotColliders),
    world,
    snapshotColliders: session.snapshotColliders,
    usesCellTerrain: session.usesCellTerrain,
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
    terrain: freezeTerrain(state.terrain),
    captureStack: freezeCaptureStack(state.captureStack),
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

function cloneTerrain(terrain: readonly TerrainCell[]): TerrainCell[] {
  return sortTerrainCells(terrain).map((cell) => structuredClone(cell))
}

function freezeTerrain(terrain: readonly TerrainCell[]): readonly TerrainCell[] {
  return Object.freeze(terrain.map((cell) => Object.freeze({
    ...cell,
    index: Object.freeze({ ...cell.index }),
  })))
}

function freezeCaptureStack(stack: readonly CapturedChunk[]): readonly CapturedChunk[] {
  return Object.freeze(stack.map((chunk) => Object.freeze({
    ...chunk,
    captureBasis: Object.freeze({
      right: Object.freeze({ ...chunk.captureBasis.right }),
      up: Object.freeze({ ...chunk.captureBasis.up }),
      forward: Object.freeze({ ...chunk.captureBasis.forward }),
    }),
    cells: Object.freeze(chunk.cells.map((cell) => Object.freeze({
      ...cell,
      gridOffset: Object.freeze({ ...cell.gridOffset }),
    }))),
  })))
}
