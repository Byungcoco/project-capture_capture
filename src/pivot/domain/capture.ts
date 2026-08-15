import type { CaptureBasis } from './commands'
import type { CellIndex, TerrainCell, TerrainMaterial } from './cell-world'
import type { Vec3 } from './math'

export const CAPTURE_CUBE_SIZE = 3
export const CAPTURE_CUBE_HALF_EXTENT = 1.5
export const CAPTURE_RANGE = 18
export const CAPTURE_MAX_CELLS = 216
export const CAPTURE_STACK_LIMIT = 5

export type CapturedChunkSource = 'terrain' | 'boss-terrain-projectile' | 'boss-orb'
export type CaptureFailureCode =
  | 'BLOCKED_CAPTURE'
  | 'EMPTY_CAPTURE'
  | 'OUT_OF_RANGE'
  | 'STACK_FULL'
  | 'CAPTURE_TOO_LARGE'

export interface CapturedCell {
  gridOffset: CellIndex
  material: TerrainMaterial
  collidable: boolean
  wireable: boolean
}

export interface CapturedChunk {
  id: string
  cells: readonly CapturedCell[]
  source: CapturedChunkSource
  captureBasis: CaptureBasis
}

export interface CaptureState {
  terrain: readonly TerrainCell[]
  stack: readonly CapturedChunk[]
}

export interface CaptureRequest {
  tick: number
  origin: Vec3
  direction: Vec3
  basis: CaptureBasis
}

export type CaptureResult =
  | { ok: true; state: CaptureState; chunk: CapturedChunk }
  | { ok: false; state: CaptureState; code: CaptureFailureCode }

export function selectCaptureCells(
  _terrain: readonly TerrainCell[],
  _cubeCenter: Vec3,
  _basis: CaptureBasis,
): TerrainCell[] {
  return []
}

export function chooseCaptureAnchor(
  _cells: readonly TerrainCell[],
  _cubeCenter: Vec3,
): TerrainCell | null {
  return null
}

export function captureCells(state: CaptureState, _request: CaptureRequest): CaptureResult {
  return { ok: false, state, code: 'EMPTY_CAPTURE' }
}
