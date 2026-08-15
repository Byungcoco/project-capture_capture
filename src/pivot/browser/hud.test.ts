import { describe, expect, it } from 'vitest'

import type { PlacementPreview } from '../domain/placement'
import { placementFailureLabel } from './hud'
import * as hudModule from './hud'

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

describe('피벗 combat HUD', () => {
  it('HP enemy 수와 LMB FIRE 조작 안내를 표시한다', () => {
    const combatStatusText = (
      hudModule as unknown as Record<string, unknown>
    ).combatStatusText
    const combatControlLabel = (
      hudModule as unknown as Record<string, unknown>
    ).COMBAT_CONTROL_LABEL
    expect(typeof combatStatusText).toBe('function')
    if (typeof combatStatusText !== 'function') return

    expect(combatStatusText({
      playerHp: 100,
      enemies: Array.from({ length: 4 }, (_, index) => ({ id: `enemy-${index}`, alive: true })),
    })).toBe('HP 100 · ENEMY 4')
    expect(combatControlLabel).toContain('LMB FIRE')
  })
})
