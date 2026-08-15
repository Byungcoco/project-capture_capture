import type { PlayerCommand } from './commands'
import { TICK_SECONDS } from '../../core/constants'
import { createAabbCollisionWorld } from './aabb-collision-world'
import { assertValidCaptureStack, captureCells } from './capture'
import type { CapturedChunk } from './capture'
import {
  assertValidTerrainOnce,
  createCellCollisionWorld,
  sortTerrainCells,
} from './cell-world'
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

interface PivotSessionBaseOptions {
  player?: PlayerState
}

export interface TerrainPivotSessionOptions extends PivotSessionBaseOptions {
  terrain: readonly TerrainCell[]
  captureStack?: readonly CapturedChunk[]
  colliders?: never
  world?: never
}

export interface LegacyPivotSessionOptions extends PivotSessionBaseOptions {
  colliders?: readonly StaticCollider[]
  world?: CollisionWorld
  terrain?: never
  captureStack?: never
}

export type PivotSessionOptions = TerrainPivotSessionOptions | LegacyPivotSessionOptions

export function createPivotSession(
  options: PivotSessionOptions = {},
): PivotSession {
  const terrainOption = options.terrain
  const usesCellTerrain = terrainOption !== undefined
  if (usesCellTerrain && (options.world !== undefined || options.colliders !== undefined)) {
    throw new PivotSessionConfigurationError(
      'terrain 모드에서는 colliders 또는 custom world를 함께 사용할 수 없습니다.',
    )
  }
  if (!usesCellTerrain && options.captureStack !== undefined) {
    throw new PivotSessionConfigurationError(
      'capture stack은 terrain 모드에서만 사용할 수 있습니다.',
    )
  }
  const authorityColliders = cloneColliders(options.colliders ?? [])
  const snapshotColliders = freezeColliders(authorityColliders)
  assertValidCaptureStack(options.captureStack ?? [])
  const terrain = freezeTerrain(terrainOption ?? [])
  const captureStack = freezeCaptureStack(options.captureStack ?? [])
  const state: WorldState = {
    tick: 0,
    player: structuredClone(options.player ?? createPlayerState()),
    colliders: authorityColliders,
    terrain,
    captureStack,
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
  const terrain = captureResult?.ok
    ? freezeTerrain(captureResult.state.terrain)
    : session.state.terrain
  const captureStack = captureResult?.ok
    ? freezeCaptureStack(captureResult.state.stack)
    : session.state.captureStack
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

export class PivotSessionConfigurationError extends Error {
  readonly code = 'INVALID_SESSION_MODE'

  constructor(message: string) {
    super(message)
    this.name = 'PivotSessionConfigurationError'
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
    terrain: state.terrain,
    captureStack: state.captureStack,
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

function freezeTerrain(terrain: readonly TerrainCell[]): readonly TerrainCell[] {
  const frozen = Object.freeze(sortTerrainCells(terrain).map((cell) => Object.freeze({
    ...cell,
    index: Object.freeze({ ...cell.index }),
  })))
  assertValidTerrainOnce(frozen)
  return frozen
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
