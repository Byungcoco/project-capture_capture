import { describe, expect, it } from 'vitest'

import {
  CELL_SIZE,
  TerrainValidationError,
  createCellCollisionWorld,
  worldToCellIndex,
} from './cell-world'
import type { CellIndex, TerrainCell } from './cell-world'
import { captureCells } from './capture'
import { IDLE_PLAYER_COMMAND } from './commands'
import { createPlayerState, stepPlayer } from './player'
import { createPivotSession } from './session'

describe('sparse 셀 월드', () => {
  it('셀 key 변환은 음수 좌표에서도 floor 규칙을 사용한다', () => {
    expect(CELL_SIZE).toBe(0.5)
    expect(worldToCellIndex({ x: -0.01, y: 0, z: 0 }).x).toBe(-1)
    expect(worldToCellIndex({ x: 0.49, y: 0, z: 0 }).x).toBe(0)
    expect(worldToCellIndex({ x: 0.5, y: 0, z: 0 }).x).toBe(1)
  })

  it('중복 소수 NaN Infinity cell index를 안정 error code로 거부한다', () => {
    const invalidTerrain: Array<{
      cells: TerrainCell[]
      code: string
    }> = [
      {
        cells: [terrainCell({ x: 0, y: 0, z: 0 }), terrainCell({ x: 0, y: 0, z: 0 })],
        code: 'DUPLICATE_CELL_KEY',
      },
      { cells: [terrainCell({ x: 0.5, y: 0, z: 0 })], code: 'INVALID_CELL_INDEX' },
      { cells: [terrainCell({ x: Number.NaN, y: 0, z: 0 })], code: 'INVALID_CELL_INDEX' },
      { cells: [terrainCell({ x: 0, y: Number.POSITIVE_INFINITY, z: 0 })], code: 'INVALID_CELL_INDEX' },
    ]

    for (const entry of invalidTerrain) {
      expect(() => createPivotSession({ terrain: entry.cells })).toThrowError(
        expect.objectContaining({ code: entry.code }),
      )
    }
  })

  it('capture 경계도 중복 key를 거부해 gridOffset 고유성을 지킨다', () => {
    const duplicate = [
      terrainCell({ x: 0, y: 0, z: 0 }),
      terrainCell({ x: 0, y: 0, z: 0 }, { material: 'wood' }),
    ]

    expect(() => captureCells(
      { terrain: duplicate, stack: [] },
      {
        tick: 1,
        origin: { x: 0.25, y: 0.25, z: 5 },
        direction: { x: 0, y: 0, z: -1 },
        basis: {
          right: { x: 1, y: 0, z: 0 },
          up: { x: 0, y: 1, z: 0 },
          forward: { x: 0, y: 0, z: -1 },
        },
      },
    )).toThrowError(TerrainValidationError)
  })

  it('cell terrain도 legacy AABB와 같은 8도 wire assist 계약을 제공한다', () => {
    const terrain = [terrainCell(
      { x: 15, y: 2, z: 1 },
      { wireable: true },
    )]
    const player = stepPlayer(
      createPlayerState(),
      {
        ...IDLE_PLAYER_COMMAND,
        wireAimDirection: { x: 1, y: 0, z: 0 },
        wireEdges: ['press'],
      },
      createCellCollisionWorld(terrain),
      1 / 60,
    )

    expect(player.wire).not.toBeNull()
    expect(player.wire?.anchor.z).toBeGreaterThan(0)
  })
})

function terrainCell(
  index: CellIndex,
  overrides: Partial<TerrainCell> = {},
): TerrainCell {
  return {
    index,
    material: 'soil',
    collidable: true,
    wireable: false,
    capturable: true,
    destructible: true,
    owner: 'level',
    ...overrides,
  }
}
