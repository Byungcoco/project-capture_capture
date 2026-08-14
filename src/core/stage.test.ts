import { describe, expect, it } from 'vitest'

import { stepPlayer } from './player'
import type { PlayerState } from './player'
import { PLAYER_SPAWN, STAGE_COLLIDERS } from './stage'

describe('마일스톤 2 스테이지', () => {
  it('플레이어가 시작 지형 위에 착지한다', () => {
    let state: PlayerState = {
      position: { ...PLAYER_SPAWN },
      velocity: { x: 0, y: 0 },
      grounded: false,
    }

    for (let tick = 0; tick < 180; tick += 1) {
      state = stepPlayer(
        state,
        { moveX: 0, jumpPressed: false },
        STAGE_COLLIDERS,
        1 / 60,
      )
    }

    expect(state.grounded).toBe(true)
    expect(state.position).toEqual({ x: -7, y: -2.35 })
  })

  it('달리며 점프하면 첫 번째 높은 박스를 넘는다', () => {
    let state: PlayerState = {
      position: { x: -7, y: -2.35 },
      velocity: { x: 0, y: 0 },
      grounded: true,
    }

    for (let tick = 0; tick < 120; tick += 1) {
      state = stepPlayer(
        state,
        { moveX: 1, jumpPressed: tick === 16 },
        STAGE_COLLIDERS,
        1 / 60,
      )
    }

    expect(state.position.x).toBeGreaterThan(-3)
  })
})
