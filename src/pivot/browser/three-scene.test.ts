import { describe, expect, it } from 'vitest'

import type { CapturePreview } from '../domain/capture'
import type { TerrainCell } from '../domain/cell-world'
import { capturePreviewCellCount, terrainNeedsSync } from './three-scene'

describe('피벗 terrain renderer cache', () => {
  it('같은 frozen terrain 참조는 renderer 재동기화를 요구하지 않는다', () => {
    const terrain = Object.freeze(Array.from(
      { length: 2_000 },
      (_, x): TerrainCell => ({
        index: { x, y: 0, z: 0 },
        material: 'rock',
        collidable: true,
        wireable: false,
        capturable: true,
        destructible: true,
        owner: 'level',
      }),
    ))

    expect(terrainNeedsSync(null, terrain)).toBe(true)
    expect(terrainNeedsSync(terrain, terrain)).toBe(false)
  })

  it('실패 preview는 성공 셀 highlight를 표시하지 않는다', () => {
    const invalidPreview = {
      valid: false,
      failureCode: 'STACK_FULL',
      cubeCenter: { x: 0, y: 0, z: 0 },
      basis: {
        right: { x: 1, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        forward: { x: 0, y: 0, z: -1 },
      },
      cells: [{
        index: { x: 0, y: 0, z: 0 },
        material: 'rock',
        collidable: true,
        wireable: false,
        capturable: true,
        destructible: true,
        owner: 'level',
      }],
    } satisfies CapturePreview

    expect(capturePreviewCellCount(invalidPreview)).toBe(0)
  })
})
