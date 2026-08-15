import { describe, expect, it } from 'vitest'

import { CELL_SIZE, worldToCellIndex } from './cell-world'

describe('sparse 셀 월드', () => {
  it('셀 key 변환은 음수 좌표에서도 floor 규칙을 사용한다', () => {
    expect(CELL_SIZE).toBe(0.5)
    expect(worldToCellIndex({ x: -0.01, y: 0, z: 0 }).x).toBe(-1)
    expect(worldToCellIndex({ x: 0.49, y: 0, z: 0 }).x).toBe(0)
    expect(worldToCellIndex({ x: 0.5, y: 0, z: 0 }).x).toBe(1)
  })
})
