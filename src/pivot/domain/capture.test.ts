import { describe, expect, it } from 'vitest'

import type { CaptureBasis } from './commands'
import {
  CAPTURE_MAX_CELLS,
  CAPTURE_STACK_LIMIT,
  captureCells,
  chooseCaptureAnchor,
  selectCaptureCells,
  previewCapture,
} from './capture'
import type { CaptureRequest, CapturedChunk, CaptureState } from './capture'
import { cellKey } from './cell-world'
import type { CellIndex, TerrainCell } from './cell-world'
import { normalizeVec3 } from './math'

const BASIS: CaptureBasis = {
  right: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  forward: { x: 0, y: 0, z: -1 },
}

describe('정육면체 절취 캡처', () => {
  it('가장 가까운 collidable 비캡처 셀은 뒤 지형 캡처를 차폐한다', () => {
    const state = captureState([
      terrainCell({ x: 0, y: 0, z: 4 }, { capturable: false }),
      terrainCell({ x: 0, y: 0, z: 0 }),
    ])
    const before = structuredClone(state)

    const result = captureCells(state, request())

    expect(result).toMatchObject({ ok: false, code: 'BLOCKED_CAPTURE' })
    expect(result.state).toEqual(before)
  })

  it('시선 정렬 3m cube 안의 셀만 선택한다', () => {
    const center = { x: 0.25, y: 0.25, z: 0.25 }
    const insideBoundary = terrainCell({ x: 3, y: 0, z: 0 })
    const outside = terrainCell({ x: 4, y: 0, z: 0 })

    const selected = selectCaptureCells(
      [outside, insideBoundary, terrainCell({ x: 0, y: 0, z: 0 })],
      center,
      BASIS,
    )

    expect(selected.map((cell) => cellKey(cell.index))).toEqual(['0,0,0', '3,0,0'])
  })

  it('임의 yaw pitch에서도 셀 수와 고유 offset을 보존한다', () => {
    const forward = normalizeVec3({ x: 0.3, y: -0.2, z: -1 })
    const right = normalizeVec3({ x: -forward.z, y: 0, z: forward.x })
    const up = normalizeVec3({
      x: forward.y * right.z - forward.z * right.y,
      y: forward.z * right.x - forward.x * right.z,
      z: forward.x * right.y - forward.y * right.x,
    })
    const basis = { right, up, forward }
    const targetCenter = { x: 0.25, y: 0.25, z: 0.25 }
    const terrain = cubeCells(-3, 3)
    const state = captureState(terrain)

    const result = captureCells(state, {
      tick: 7,
      origin: {
        x: targetCenter.x - forward.x * 5,
        y: targetCenter.y - forward.y * 5,
        z: targetCenter.z - forward.z * 5,
      },
      direction: forward,
      basis,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`캡처 성공이 필요합니다: ${result.code}`)
    const removedCount = terrain.length - result.state.terrain.length
    const offsetKeys = result.chunk.cells.map((cell) => cellKey(cell.gridOffset))
    expect(result.chunk.cells).toHaveLength(removedCount)
    expect(new Set(offsetKeys).size).toBe(offsetKeys.length)
  })

  it('anchor 동률은 world y z x 정렬의 첫 셀이다', () => {
    const cells = [
      terrainCell({ x: 1, y: 0, z: 1 }),
      terrainCell({ x: 0, y: 1, z: 0 }),
      terrainCell({ x: 1, y: 0, z: 0 }),
      terrainCell({ x: 0, y: 0, z: 1 }),
    ]

    const anchor = chooseCaptureAnchor(cells, { x: 0.5, y: 0.5, z: 0.5 })

    expect(anchor?.index).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('캡처 성공은 제거와 stack push가 원자적이다', () => {
    const terrain = [
      terrainCell({ x: 0, y: 0, z: 0 }),
      terrainCell({ x: 1, y: 0, z: 0 }),
      terrainCell({ x: 0, y: 1, z: 0 }),
    ]
    const state = captureState(terrain)

    const result = captureCells(state, request())

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`캡처 성공이 필요합니다: ${result.code}`)
    expect(result.state.terrain.length).toBe(terrain.length - result.chunk.cells.length)
    expect(result.state.stack.at(-1)?.cells).toHaveLength(result.chunk.cells.length)
    expect(result.state.terrain.length + result.chunk.cells.length).toBe(terrain.length)
  })

  it('빈 캡처 사거리 초과 stack full 216셀 초과는 상태를 바꾸지 않는다', () => {
    const validTerrain = [terrainCell({ x: 0, y: 0, z: 0 })]
    const fullStack = Array.from(
      { length: CAPTURE_STACK_LIMIT },
      (_, index) => capturedChunk(`existing-${index}`),
    )
    const tooLargeTerrain = tooLargeCaptureCells()
    expect(tooLargeTerrain.length).toBeGreaterThan(CAPTURE_MAX_CELLS)
    const cases: Array<{
      state: CaptureState
      request: CaptureRequest
      code: string
    }> = [
      { state: captureState([]), request: request(), code: 'EMPTY_CAPTURE' },
      {
        state: captureState(validTerrain),
        request: { ...request(), origin: { x: 0.25, y: 0.25, z: 20 } },
        code: 'OUT_OF_RANGE',
      },
      {
        state: captureState(validTerrain, fullStack),
        request: request(),
        code: 'STACK_FULL',
      },
      {
        state: captureState(tooLargeTerrain),
        request: request(),
        code: 'CAPTURE_TOO_LARGE',
      },
    ]

    for (const entry of cases) {
      const before = structuredClone(entry.state)
      const result = captureCells(entry.state, entry.request)
      expect(result).toMatchObject({ ok: false, code: entry.code })
      expect(result.state).toEqual(before)
    }
  })

  it('preview는 stack full과 216셀 초과를 transaction과 같은 실패로 표시한다', () => {
    const validTerrain = [terrainCell({ x: 0, y: 0, z: 0 })]
    const fullStack = Array.from(
      { length: CAPTURE_STACK_LIMIT },
      (_, index) => capturedChunk(`existing-${index}`),
    )
    const tooLargeTerrain = tooLargeCaptureCells()

    const fullPreview = previewCapture(validTerrain, request(), fullStack)
    const largePreview = previewCapture(tooLargeTerrain, request(), [])

    expect(fullPreview).toMatchObject({
      valid: false,
      failureCode: 'STACK_FULL',
      cells: [],
    })
    expect(largePreview).toMatchObject({
      valid: false,
      failureCode: 'CAPTURE_TOO_LARGE',
      cells: [],
    })
  })
})

function request(): CaptureRequest {
  return {
    tick: 1,
    origin: { x: 0.25, y: 0.25, z: 5 },
    direction: BASIS.forward,
    basis: BASIS,
  }
}

function terrainCell(
  index: CellIndex,
  overrides: Partial<TerrainCell> = {},
): TerrainCell {
  return {
    index,
    material: 'soil',
    collidable: true,
    wireable: true,
    capturable: true,
    destructible: true,
    owner: 'level',
    ...overrides,
  }
}

function captureState(
  terrain: readonly TerrainCell[],
  stack: readonly CapturedChunk[] = [],
): CaptureState {
  return { terrain, stack }
}

function capturedChunk(id: string): CapturedChunk {
  return { id, cells: [], source: 'terrain', captureBasis: BASIS }
}

function cubeCells(minimum: number, maximum: number): TerrainCell[] {
  const cells: TerrainCell[] = []
  for (let y = minimum; y <= maximum; y += 1) {
    for (let z = minimum; z <= maximum; z += 1) {
      for (let x = minimum; x <= maximum; x += 1) {
        cells.push(terrainCell({ x, y, z }))
      }
    }
  }
  return cells
}

function tooLargeCaptureCells(): TerrainCell[] {
  const cells: TerrainCell[] = []
  for (let y = -3; y <= 3; y += 1) {
    for (let z = -2; z <= 3; z += 1) {
      for (let x = -3; x <= 3; x += 1) {
        if (x === 0 && y === 0 && z > 0) continue
        cells.push(terrainCell({ x, y, z }))
      }
    }
  }
  return cells
}
