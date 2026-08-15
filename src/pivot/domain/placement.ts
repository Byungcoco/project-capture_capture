import type { CapturedChunk, CaptureState } from './capture'
import type { CellIndex, TerrainCell } from './cell-world'
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
  _state: CaptureState,
  _request: PlacementRequest,
): PlacementPreview {
  return { valid: false, failureCode: 'BLOCKED_PLACEMENT', anchor: null, cells: [] }
}

export function placeChunk(state: CaptureState, _request: PlacementRequest): PlacementResult {
  return { ok: false, state, code: 'BLOCKED_PLACEMENT' }
}
