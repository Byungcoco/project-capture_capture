import { describe, expect, it } from 'vitest'

import { IDLE_PLAYER_COMMAND } from './commands'
import type { StaticCollider } from './player'
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

  it('snapshot과 source collider 변경은 authority state와 query를 바꾸지 않는다', () => {
    const source: StaticCollider[] = [{
      center: { x: 5, y: 0, z: 0 },
      halfSize: { x: 0.5, y: 1, z: 1 },
      wireable: true,
    }]
    const session = createPivotSession({ colliders: source })
    const snapshotCollider = session.snapshot.colliders[0]
    if (snapshotCollider === undefined) throw new Error('snapshot collider가 필요합니다.')

    expect(() => {
      snapshotCollider.center.x = 50
    }).toThrow(TypeError)
    source[0]!.center.x = 60

    expect(session.state.colliders[0]?.center.x).toBe(5)
    expect(session.world.raycast(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      30,
    )?.distance).toBeCloseTo(4.5, 10)
  })
})
