import { describe, expect, it } from 'vitest'

import type { CapturedCell, CapturedChunk, CaptureState } from './capture'
import type { CellIndex, TerrainCell } from './cell-world'
import { worldToCellIndex } from './cell-world'
import {
  CELL_INDEX_MAX,
  PLACEMENT_RANGE,
  placeChunk,
  previewPlacement,
} from './placement'
import type { PlacementRequest } from './placement'

describe('공중 청크 배치', () => {
  it('빈 stack은 EMPTY_STACK이며 상태가 불변이다', () => {
    const state = placementState([], [])
    const before = structuredClone(state)

    const result = placeChunk(state, request())

    expect(result).toMatchObject({ ok: false, code: 'EMPTY_STACK' })
    expect(result.state).toBe(state)
    expect(result.state).toEqual(before)
  })

  it('ray hit 표면 법선 바깥 첫 빈 셀을 anchor로 삼아 top chunk 형상을 배치한다', () => {
    const bottom = chunk('bottom', [capturedCell({ x: 0, y: 0, z: 0 }, 'wood')])
    const top = chunk('top', [
      capturedCell({ x: 0, y: 0, z: 0 }, 'rock'),
      capturedCell({ x: 1, y: 0, z: 0 }, 'soil'),
    ])
    const state = placementState([terrainCell({ x: 0, y: 0, z: 0 })], [bottom, top])

    const result = placeChunk(state, request())

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`배치 성공이 필요합니다: ${result.code}`)
    expect(result.state.stack.map((entry) => entry.id)).toEqual(['bottom'])
    expect(result.cells.map((cell) => cell.index)).toEqual([
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
    ])
    expect(result.cells).toEqual([
      expect.objectContaining({
        material: 'rock', owner: 'player', chunkId: 'top',
        collidable: true, wireable: true, capturable: true, destructible: true,
      }),
      expect.objectContaining({
        material: 'soil', owner: 'player', chunkId: 'top',
        collidable: true, wireable: true, capturable: true, destructible: true,
      }),
    ])
  })

  it('no-hit은 normalized 20m 끝점을 0.5m floor grid로 양자화한다', () => {
    const direction = { x: -1, y: 0, z: -1 }
    const origin = { x: 0.1, y: 0.1, z: 0.1 }
    const endpointScale = PLACEMENT_RANGE / Math.hypot(direction.x, direction.z)
    const expectedAnchor = worldToCellIndex({
      x: origin.x + direction.x * endpointScale,
      y: origin.y,
      z: origin.z + direction.z * endpointScale,
    })
    const state = placementState([], [chunk('air')])

    const preview = previewPlacement(state, {
      ...request(), origin, direction,
    })

    expect(preview).toMatchObject({ valid: true, failureCode: null })
    expect(preview.anchor).toEqual(expectedAnchor)
    expect(preview.cells[0]?.index).toEqual(expectedAnchor)
  })

  it('중복 지형 player 겹침 사거리 경계 중복 target은 원자적으로 거부한다', () => {
    const commonState = placementState([], [chunk('top')])
    const blockedTarget = { x: 40, y: 0, z: 0 }
    const cases = [
      {
        code: 'BLOCKED_PLACEMENT',
        state: placementState([terrainCell(blockedTarget)], [chunk('top')]),
        request: { ...request(), origin: { x: 0.25, y: 0.25, z: 0.25 }, direction: { x: 1, y: 0, z: 0 } },
      },
      {
        code: 'PLAYER_OVERLAP',
        state: commonState,
        request: {
          ...request(),
          origin: { x: 0.25, y: 0.25, z: 0.25 },
          direction: { x: 1, y: 0, z: 0 },
          playerPosition: { x: 20.25, y: 0.25, z: 0.25 },
        },
      },
      {
        code: 'OUT_OF_RANGE',
        state: placementState([terrainCell({ x: 50, y: 0, z: 0 })], [chunk('top')]),
        request: { ...request(), origin: { x: 0.25, y: 0.25, z: 0.25 }, direction: { x: 1, y: 0, z: 0 } },
      },
      {
        code: 'OUT_OF_BOUNDS',
        state: commonState,
        request: {
          ...request(),
          origin: { x: CELL_INDEX_MAX * 0.5, y: 0.25, z: 0.25 },
          direction: { x: 1, y: 0, z: 0 },
        },
      },
      {
        code: 'DUPLICATE_TARGET',
        state: placementState([], [chunk('duplicate', [
          capturedCell({ x: 0, y: 0, z: 0 }),
          capturedCell({ x: 0, y: 0, z: 0 }),
        ])]),
        request: request(),
      },
    ]

    for (const entry of cases) {
      const before = structuredClone(entry.state)
      const result = placeChunk(entry.state, entry.request)
      expect(result).toMatchObject({ ok: false, code: entry.code })
      expect(result.state).toBe(entry.state)
      expect(result.state).toEqual(before)
    }
  })

  it('preview와 transaction은 같은 failure code와 target cell을 쓰고 성공 시 총량을 보존한다', () => {
    const blocked = placementState(
      [terrainCell({ x: 40, y: 0, z: 0 })],
      [chunk('blocked')],
    )
    const blockedRequest = {
      ...request(), origin: { x: 0.25, y: 0.25, z: 0.25 }, direction: { x: 1, y: 0, z: 0 },
    }
    const blockedPreview = previewPlacement(blocked, blockedRequest)
    const blockedResult = placeChunk(blocked, blockedRequest)
    expect(blockedPreview.failureCode).toBe('BLOCKED_PLACEMENT')
    expect(blockedResult).toMatchObject({ ok: false, code: blockedPreview.failureCode })
    expect(blockedPreview.cells.map((cell) => cell.index)).toEqual([{ x: 40, y: 0, z: 0 }])

    const state = placementState([], [chunk('shape', [
      capturedCell({ x: 0, y: 0, z: 0 }),
      capturedCell({ x: 1, y: 0, z: 0 }),
    ])])
    const totalBefore = state.terrain.length + state.stack.reduce((sum, entry) => sum + entry.cells.length, 0)
    const preview = previewPlacement(state, request())
    const result = placeChunk(state, request())
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`배치 성공이 필요합니다: ${result.code}`)
    expect(preview.cells.map((cell) => cell.index)).toEqual(result.cells.map((cell) => cell.index))
    expect(result.state.terrain).toHaveLength(state.terrain.length + 2)
    expect(result.state.stack).toHaveLength(state.stack.length - 1)
    const totalAfter = result.state.terrain.length
      + result.state.stack.reduce((sum, entry) => sum + entry.cells.length, 0)
    expect(totalAfter).toBe(totalBefore)
  })
})

function request(): PlacementRequest {
  return {
    origin: { x: 0.25, y: 0.25, z: 2 },
    direction: { x: 0, y: 0, z: -1 },
    playerPosition: { x: 10, y: 10, z: 10 },
    playerHalfSize: { x: 0.4, y: 0.9, z: 0.4 },
  }
}

function placementState(
  terrain: readonly TerrainCell[],
  stack: readonly CapturedChunk[],
): CaptureState {
  return { terrain, stack }
}

function chunk(
  id: string,
  cells: readonly CapturedCell[] = [capturedCell({ x: 0, y: 0, z: 0 })],
): CapturedChunk {
  return {
    id,
    source: 'terrain',
    captureBasis: {
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      forward: { x: 0, y: 0, z: -1 },
    },
    cells,
  }
}

function capturedCell(
  gridOffset: CellIndex,
  material: CapturedCell['material'] = 'rock',
): CapturedCell {
  return { gridOffset, material, collidable: false, wireable: false }
}

function terrainCell(index: CellIndex): TerrainCell {
  return {
    index,
    material: 'rock',
    collidable: true,
    wireable: true,
    capturable: true,
    destructible: true,
    owner: 'level',
  }
}
