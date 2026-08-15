import type { CapturedChunk, CaptureState } from './capture'
import {
  CELL_SIZE,
  assertValidTerrainOnce,
  cellCenter,
  cellKey,
  compareCellIndices,
  worldToCellIndex,
} from './cell-world'
import type { CellIndex, TerrainCell } from './cell-world'
import { normalizeVec3 } from './math'
import type { Vec3 } from './math'

export const PLACEMENT_RANGE = 20
export const CELL_INDEX_MIN = -256
export const CELL_INDEX_MAX = 256

export type PlacementFailureCode =
  | 'EMPTY_STACK'
  | 'OUT_OF_RANGE'
  | 'OUT_OF_BOUNDS'
  | 'BLOCKED_PLACEMENT'
  | 'PLAYER_OVERLAP'
  | 'DUPLICATE_TARGET'

export interface PlacementRequest {
  origin: Vec3
  direction: Vec3
  playerPosition: Vec3
  playerHalfSize: Vec3
}

export interface PlacementPreview {
  valid: boolean
  failureCode: PlacementFailureCode | null
  anchor: CellIndex | null
  cells: readonly TerrainCell[]
}

export type PlacementResult =
  | { ok: true; state: CaptureState; chunk: CapturedChunk; cells: readonly TerrainCell[] }
  | { ok: false; state: CaptureState; code: PlacementFailureCode }

export function previewPlacement(
  state: CaptureState,
  request: PlacementRequest,
): PlacementPreview {
  assertValidTerrainOnce(state.terrain)
  const plan = planPlacement(state, request)
  return {
    valid: plan.ok,
    failureCode: plan.ok ? null : plan.code,
    anchor: plan.anchor,
    cells: plan.cells,
  }
}

export function placeChunk(state: CaptureState, request: PlacementRequest): PlacementResult {
  assertValidTerrainOnce(state.terrain)
  const plan = planPlacement(state, request)
  if (!plan.ok) return { ok: false, state, code: plan.code }
  return {
    ok: true,
    chunk: plan.chunk,
    cells: plan.cells,
    state: {
      terrain: [...state.terrain, ...plan.cells],
      stack: state.stack.slice(0, -1),
    },
  }
}

type PlacementPlan =
  | {
      ok: true
      anchor: CellIndex
      cells: readonly TerrainCell[]
      chunk: CapturedChunk
    }
  | {
      ok: false
      code: PlacementFailureCode
      anchor: CellIndex | null
      cells: readonly TerrainCell[]
    }

function planPlacement(state: CaptureState, request: PlacementRequest): PlacementPlan {
  const chunk = state.stack.at(-1)
  if (chunk === undefined) {
    return { ok: false, code: 'EMPTY_STACK', anchor: null, cells: [] }
  }
  const direction = normalizeVec3(request.direction)
  const hit = nearestCollidableCell(state.terrain, request.origin, direction)
  if (hit !== null && hit.distance > PLACEMENT_RANGE) {
    return { ok: false, code: 'OUT_OF_RANGE', anchor: null, cells: [] }
  }
  const anchor = hit === null
    ? worldToCellIndex({
        x: request.origin.x + direction.x * PLACEMENT_RANGE,
        y: request.origin.y + direction.y * PLACEMENT_RANGE,
        z: request.origin.z + direction.z * PLACEMENT_RANGE,
      })
    : {
        x: hit.cell.index.x + hit.normal.x,
        y: hit.cell.index.y + hit.normal.y,
        z: hit.cell.index.z + hit.normal.z,
      }
  const cells = chunk.cells.map((cell): TerrainCell => ({
    index: {
      x: anchor.x + cell.gridOffset.x,
      y: anchor.y + cell.gridOffset.y,
      z: anchor.z + cell.gridOffset.z,
    },
    material: cell.material,
    owner: 'player',
    chunkId: chunk.id,
    collidable: true,
    wireable: true,
    capturable: true,
    destructible: true,
  }))
  const targetKeys = new Set<string>()
  for (const cell of cells) {
    const key = cellKey(cell.index)
    if (targetKeys.has(key)) {
      return { ok: false, code: 'DUPLICATE_TARGET', anchor, cells }
    }
    targetKeys.add(key)
  }
  if (cells.some((cell) => !isInBounds(cell.index))) {
    return { ok: false, code: 'OUT_OF_BOUNDS', anchor, cells }
  }
  const terrainKeys = new Set(state.terrain.map((cell) => cellKey(cell.index)))
  if (cells.some((cell) => terrainKeys.has(cellKey(cell.index)))) {
    return { ok: false, code: 'BLOCKED_PLACEMENT', anchor, cells }
  }
  if (cells.some((cell) => overlapsPlayer(cell, request))) {
    return { ok: false, code: 'PLAYER_OVERLAP', anchor, cells }
  }
  return { ok: true, anchor, cells, chunk }
}

function isInBounds(index: CellIndex): boolean {
  return (['x', 'y', 'z'] as const).every((axis) => (
    index[axis] >= CELL_INDEX_MIN && index[axis] <= CELL_INDEX_MAX
  ))
}

function overlapsPlayer(cell: TerrainCell, request: PlacementRequest): boolean {
  const center = cellCenter(cell.index)
  const cellHalfSize = CELL_SIZE / 2
  return Math.abs(center.x - request.playerPosition.x) < cellHalfSize + request.playerHalfSize.x
    && Math.abs(center.y - request.playerPosition.y) < cellHalfSize + request.playerHalfSize.y
    && Math.abs(center.z - request.playerPosition.z) < cellHalfSize + request.playerHalfSize.z
}

interface CellRayHit {
  cell: TerrainCell
  distance: number
  normal: CellIndex
}

function nearestCollidableCell(
  terrain: readonly TerrainCell[],
  origin: Vec3,
  direction: Vec3,
): CellRayHit | null {
  let closest: CellRayHit | null = null
  for (const cell of terrain) {
    if (!cell.collidable) continue
    const rayHit = rayCellHit(origin, direction, cell)
    if (rayHit === null) continue
    if (
      closest === null
      || rayHit.distance < closest.distance
      || (
        rayHit.distance === closest.distance
        && compareCellIndices(cell, closest.cell) < 0
      )
    ) {
      closest = { cell, ...rayHit }
    }
  }
  return closest
}

function rayCellHit(
  origin: Vec3,
  direction: Vec3,
  cell: TerrainCell,
): { distance: number; normal: CellIndex } | null {
  const center = cellCenter(cell.index)
  const halfSize = CELL_SIZE / 2
  let minimum = 0
  let maximum = Number.POSITIVE_INFINITY
  let normal: CellIndex = { x: 0, y: 0, z: 0 }
  for (const axis of ['x', 'y', 'z'] as const) {
    const lower = center[axis] - halfSize
    const upper = center[axis] + halfSize
    if (Math.abs(direction[axis]) <= Number.EPSILON) {
      if (origin[axis] < lower || origin[axis] > upper) return null
      continue
    }
    const lowerDistance = (lower - origin[axis]) / direction[axis]
    const upperDistance = (upper - origin[axis]) / direction[axis]
    const nearDistance = Math.min(lowerDistance, upperDistance)
    const farDistance = Math.max(lowerDistance, upperDistance)
    if (
      nearDistance > minimum
      || (
        nearDistance === minimum
        && normal.x === 0 && normal.y === 0 && normal.z === 0
      )
    ) {
      minimum = nearDistance
      normal = { x: 0, y: 0, z: 0 }
      normal[axis] = direction[axis] > 0 ? -1 : 1
    }
    maximum = Math.min(maximum, farDistance)
    if (maximum < minimum) return null
  }
  return { distance: minimum, normal }
}
