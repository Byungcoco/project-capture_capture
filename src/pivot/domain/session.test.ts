import { describe, expect, it } from 'vitest'

import { IDLE_PLAYER_COMMAND } from './commands'
import { createPivotSession, stepPivotSession } from './session'

describe('피벗 세션', () => {
  it('같은 초기 상태와 600틱 명령은 같은 snapshot을 만든다', () => {
    const commands = Array.from({ length: 600 }, (_, tick) => ({
      ...IDLE_PLAYER_COMMAND,
      moveX: tick % 120 < 60 ? 1 : -1,
      moveZ: tick % 90 < 45 ? 0.5 : -0.5,
      jumpPressed: tick % 150 === 0,
      dashPressed: tick % 200 === 10,
    }))
    let first = createPivotSession()
    let second = createPivotSession()

    for (const command of commands) {
      first = stepPivotSession(first, command)
      second = stepPivotSession(second, command)
    }

    expect(first.snapshot).toEqual(second.snapshot)
    expect(first.snapshot.tick).toBe(600)
    expect(first.snapshot.player.position.z).not.toBe(0)
  })
})
