import type { CaptureBasis } from './commands'
import {
  CELL_SIZE,
  assertValidTerrainOnce,
  cellCenter,
  cellKey,
  compareCellIndices,
} from './cell-world'
import type { CellIndex, TerrainCell, TerrainMaterial } from './cell-world'
import { normalizeVec3 } from './math'
import type { Vec3 } from './math'

export const CAPTURE_CUBE_SIZE = 3
export const CAPTURE_CUBE_HALF_EXTENT = 1.5
export const CAPTURE_RANGE = 18
export const CAPTURE_MAX_CELLS = 216
export const CAPTURE_STACK_LIMIT = 5
export type CaptureStackValidationErrorCode =
  | 'CAPTURE_STACK_LIMIT_EXCEEDED'
  | 'INVALID_CAPTURE_CELL_OFFSET'
  | 'DUPLICATE_CAPTURE_CELL_OFFSET'
  | 'CAPTURE_CHUNK_TOO_LARGE'

export class CaptureStackValidationError extends Error {
  constructor(
    public readonly code: CaptureStackValidationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CaptureStackValidationError'
  }
}

export function assertValidCaptureStack(stack: readonly CapturedChunk[]): void {
  if (stack.length > CAPTURE_STACK_LIMIT) {
    throw new CaptureStackValidationError(
      'CAPTURE_STACK_LIMIT_EXCEEDED',
      `capture stack은 ${CAPTURE_STACK_LIMIT}개를 초과할 수 없습니다.`,
    )
  }
  for (const chunk of stack) {
    if (chunk.cells.length > CAPTURE_MAX_CELLS) {
      throw new CaptureStackValidationError(
        'CAPTURE_CHUNK_TOO_LARGE',
        `capture chunk는 ${CAPTURE_MAX_CELLS}셀을 초과할 수 없습니다.`,
      )
    }
    const offsetKeys = new Set<string>()
    for (const cell of chunk.cells) {
      for (const axis of ['x', 'y', 'z'] as const) {
        const value = cell.gridOffset[axis]
        if (!Number.isFinite(value) || !Number.isInteger(value)) {
          throw new CaptureStackValidationError(
            'INVALID_CAPTURE_CELL_OFFSET',
            `capture cell gridOffset ${axis}는 유한 정수여야 합니다.`,
          )
        }
      }
      const key = cellKey(cell.gridOffset)
      if (offsetKeys.has(key)) {
        throw new CaptureStackValidationError(
          'DUPLICATE_CAPTURE_CELL_OFFSET',
          `capture chunk에 중복 gridOffset을 사용할 수 없습니다: ${key}`,
        )
      }
      offsetKeys.add(key)
    }
  }
}

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

export interface CapturePreview {
  valid: boolean
  failureCode: CaptureFailureCode | null
  cubeCenter: Vec3
  cells: readonly TerrainCell[]
  basis: CaptureBasis
}

export type CaptureResult =
  | { ok: true; state: CaptureState; chunk: CapturedChunk }
  | { ok: false; state: CaptureState; code: CaptureFailureCode }

export function previewCapture(
  terrain: readonly TerrainCell[],
  request: CaptureRequest,
  stack: readonly CapturedChunk[] = [],
): CapturePreview | null {
  assertValidTerrainOnce(terrain)
  const plan = planCapture({ terrain, stack }, request)
  if (plan.cubeCenter === null) return null
  return {
    valid: plan.ok,
    failureCode: plan.ok ? null : plan.code,
    cubeCenter: plan.cubeCenter,
    cells: plan.ok ? plan.cells : [],
    basis: structuredClone(request.basis),
  }
}

export function selectCaptureCells(
  terrain: readonly TerrainCell[],
  cubeCenter: Vec3,
  basis: CaptureBasis,
): TerrainCell[] {
  return terrain.filter((cell) => {
    if (!cell.capturable || !cell.destructible) return false
    const center = cellCenter(cell.index)
    const offset = {
      x: center.x - cubeCenter.x,
      y: center.y - cubeCenter.y,
      z: center.z - cubeCenter.z,
    }
    return Math.abs(dot(offset, basis.right)) <= CAPTURE_CUBE_HALF_EXTENT + Number.EPSILON
      && Math.abs(dot(offset, basis.up)) <= CAPTURE_CUBE_HALF_EXTENT + Number.EPSILON
      && Math.abs(dot(offset, basis.forward)) <= CAPTURE_CUBE_HALF_EXTENT + Number.EPSILON
  }).sort(compareCellIndices)
}

export function chooseCaptureAnchor(
  cells: readonly TerrainCell[],
  cubeCenter: Vec3,
): TerrainCell | null {
  let closest: TerrainCell | null = null
  let closestDistanceSquared = Number.POSITIVE_INFINITY
  for (const cell of cells) {
    const center = cellCenter(cell.index)
    const distanceSquared = (center.x - cubeCenter.x) ** 2
      + (center.y - cubeCenter.y) ** 2
      + (center.z - cubeCenter.z) ** 2
    if (
      distanceSquared < closestDistanceSquared
      || (
        distanceSquared === closestDistanceSquared
        && closest !== null
        && compareCellIndices(cell, closest) < 0
      )
    ) {
      closest = cell
      closestDistanceSquared = distanceSquared
    }
  }
  return closest
}

export function captureCells(state: CaptureState, request: CaptureRequest): CaptureResult {
  assertValidTerrainOnce(state.terrain)
  const plan = planCapture(state, request)
  if (!plan.ok) return failure(state, plan.code)
  const { anchor, cells: selected } = plan

  const selectedKeys = new Set(selected.map((cell) => cellKey(cell.index)))
  const chunk: CapturedChunk = {
    id: `capture-${request.tick}`,
    source: 'terrain',
    captureBasis: structuredClone(request.basis),
    cells: selected.map((cell) => ({
      gridOffset: {
        x: cell.index.x - anchor.index.x,
        y: cell.index.y - anchor.index.y,
        z: cell.index.z - anchor.index.z,
      },
      material: cell.material,
      collidable: cell.collidable,
      wireable: cell.wireable,
    })),
  }
  return {
    ok: true,
    chunk,
    state: {
      terrain: state.terrain.filter((cell) => !selectedKeys.has(cellKey(cell.index))),
      stack: [...state.stack, chunk],
    },
  }
}

type CapturePlan =
  | {
      ok: true
      cubeCenter: Vec3
      cells: readonly TerrainCell[]
      anchor: TerrainCell
    }
  | {
      ok: false
      code: CaptureFailureCode
      cubeCenter: Vec3 | null
    }

function planCapture(state: CaptureState, request: CaptureRequest): CapturePlan {
  const direction = normalizeVec3(request.direction)
  const target = nearestCollidableCell(state.terrain, request.origin, direction)
  if (target === null) return { ok: false, code: 'EMPTY_CAPTURE', cubeCenter: null }
  if (target.distance > CAPTURE_RANGE) {
    return { ok: false, code: 'OUT_OF_RANGE', cubeCenter: null }
  }
  if (!target.cell.capturable || !target.cell.destructible) {
    return { ok: false, code: 'BLOCKED_CAPTURE', cubeCenter: null }
  }
  const cubeCenter = {
    x: request.origin.x + direction.x * target.distance,
    y: request.origin.y + direction.y * target.distance,
    z: request.origin.z + direction.z * target.distance,
  }
  if (state.stack.length >= CAPTURE_STACK_LIMIT) {
    return { ok: false, code: 'STACK_FULL', cubeCenter }
  }
  const selected = selectCaptureCells(state.terrain, cubeCenter, request.basis)
  if (selected.length === 0) return { ok: false, code: 'EMPTY_CAPTURE', cubeCenter }
  if (selected.length > CAPTURE_MAX_CELLS) {
    return { ok: false, code: 'CAPTURE_TOO_LARGE', cubeCenter }
  }
  const anchor = chooseCaptureAnchor(selected, cubeCenter)
  if (anchor === null) return { ok: false, code: 'EMPTY_CAPTURE', cubeCenter }
  return { ok: true, cubeCenter, cells: selected, anchor }
}

interface CellRayHit {
  cell: TerrainCell
  distance: number
}

function nearestCollidableCell(
  terrain: readonly TerrainCell[],
  origin: Vec3,
  direction: Vec3,
): CellRayHit | null {
  let closest: CellRayHit | null = null
  for (const cell of terrain) {
    if (!cell.collidable) continue
    const distance = rayCellDistance(origin, direction, cell)
    if (distance === null) continue
    if (
      closest === null
      || distance < closest.distance
      || (distance === closest.distance && compareCellIndices(cell, closest.cell) < 0)
    ) {
      closest = { cell, distance }
    }
  }
  return closest
}

function rayCellDistance(origin: Vec3, direction: Vec3, cell: TerrainCell): number | null {
  const center = cellCenter(cell.index)
  const halfSize = CELL_SIZE / 2
  let minimum = 0
  let maximum = Number.POSITIVE_INFINITY
  for (const axis of ['x', 'y', 'z'] as const) {
    const lower = center[axis] - halfSize
    const upper = center[axis] + halfSize
    if (Math.abs(direction[axis]) <= 1e-8) {
      if (origin[axis] < lower || origin[axis] > upper) return null
      continue
    }
    const first = (lower - origin[axis]) / direction[axis]
    const second = (upper - origin[axis]) / direction[axis]
    minimum = Math.max(minimum, Math.min(first, second))
    maximum = Math.min(maximum, Math.max(first, second))
    if (maximum < minimum) return null
  }
  return minimum
}

function dot(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

function failure(state: CaptureState, code: CaptureFailureCode): CaptureResult {
  return { ok: false, state, code }
}
