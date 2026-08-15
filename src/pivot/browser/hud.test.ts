import { describe, expect, it } from 'vitest'

import type { PlacementPreview } from '../domain/placement'
import { placementFailureLabel } from './hud'

describe('피벗 배치 HUD', () => {
  it('invalid placement preview는 transaction failure code를 그대로 표시한다', () => {
    const preview = {
      valid: false,
      failureCode: 'OUT_OF_BOUNDS',
      anchor: { x: 300, y: 0, z: 0 },
      cells: [],
    } satisfies PlacementPreview

    expect(placementFailureLabel(preview)).toBe('OUT_OF_BOUNDS')
    expect(placementFailureLabel(null)).toBeNull()
  })
})
