import { describe, expect, it } from 'vitest'

import { IDLE_PLAYER_COMMAND } from './commands'
import type { TerrainCell } from './cell-world'
import { createPlayerState } from './player'
import { createPivotSession, stepPivotSession } from './session'

const CAPTURE_COMMAND = {
  ...IDLE_PLAYER_COMMAND,
  capturePressed: true,
  captureOrigin: { x: 0.25, y: 0.75, z: 2 },
  captureDirection: { x: 0, y: 0, z: -1 },
  captureBasis: {
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
  },
}

describe('셀 지형 session 통합', () => {
  it('같은 초기 셀과 command는 같은 chunk id 순서 snapshot을 만든다', () => {
    const terrain = captureWall()
    let first = createPivotSession({ terrain })
    let second = createPivotSession({ terrain })

    first = stepPivotSession(first, CAPTURE_COMMAND)
    second = stepPivotSession(second, CAPTURE_COMMAND)

    expect(first.snapshot).toEqual(second.snapshot)
    expect(first.snapshot.captureStack.map((chunk) => chunk.id)).toEqual(['capture-1'])
    expect(first.snapshot.terrain.length).toBeLessThan(terrain.length)
  })

  it('캡처는 같은 tick의 플레이어 이동 전에 적용된다', () => {
    const player = createPlayerState({
      position: { x: 0.25, y: 0.9, z: 1 },
    })
    const session = createPivotSession({ terrain: captureWall(), player })

    const next = stepPivotSession(session, {
      ...CAPTURE_COMMAND,
      dashPressed: true,
    })

    expect(next.snapshot.terrain).toHaveLength(0)
    expect(next.state.player.position.z).toBeCloseTo(0.7, 10)
  })
})

function captureWall(): TerrainCell[] {
  return [{
    index: { x: 0, y: 1, z: 0 },
    material: 'rock',
    collidable: true,
    wireable: true,
    capturable: true,
    destructible: true,
    owner: 'level',
  }]
}
