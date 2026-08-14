import { describe, expect, it } from 'vitest'

import { stepSession } from './session'
import type { SessionState } from './session'

const createState = (mode: SessionState['gameMode']['mode']): SessionState => ({
  gameMode: { mode, selectedSlot: 0 },
  player: {
    position: { x: 1, y: 2 },
    velocity: { x: 3, y: 4 },
    grounded: false,
  },
})

describe('stepSession', () => {
  it.each(['capture-aim', 'paste'] as const)(
    '%s에서는 플레이어 월드 갱신을 멈춘다',
    (mode) => {
      const state = createState(mode)
      const next = stepSession(
        state,
        { moveX: 1, jumpPressed: true },
        [],
        1 / 60,
      )

      expect(next.player).toEqual(state.player)
    },
  )

  it('Platform에서는 플레이어를 갱신한다', () => {
    const state = createState('platform')
    const next = stepSession(
      state,
      { moveX: 1, jumpPressed: false },
      [],
      1 / 60,
    )

    expect(next.player).not.toEqual(state.player)
  })
})
