import { describe, expect, it } from 'vitest'

import type { CapturedChunk } from './capture'
import type { TerrainCell } from './cell-world'
import { IDLE_PLAYER_COMMAND } from './commands'
import { createPlayerState, playerWireOrigin } from './player'
import { createPivotSession, stepPivotSession } from './session'

describe('배치 지형 session 통합', () => {
  it('배치 성공 tick은 새 collision world를 movement 전에 사용한다', () => {
    const player = createPlayerState({
      position: { x: 0.25, y: 1.25, z: 0.95 },
      velocity: { x: 0, y: 0, z: 0 },
      grounded: false,
    })
    const session = createPivotSession({
      terrain: [terrainCell({ x: 0, y: 2, z: -1 })],
      captureStack: [chunk('wall')],
      player,
    })

    const next = stepPivotSession(session, {
      ...IDLE_PLAYER_COMMAND,
      dashPressed: true,
      placeReleased: true,
      placementOrigin: { x: 0.25, y: 1.25, z: 2 },
      placementDirection: { x: 0, y: 0, z: -1 },
    })

    expect(next.snapshot.terrain.some((cell) => (
      cell.index.x === 0 && cell.index.y === 2 && cell.index.z === 0
    ))).toBe(true)
    expect(next.state.player.position.z).toBeCloseTo(0.9, 10)
    expect(next.snapshot.captureStack).toHaveLength(0)
  })

  it('공중 배치 셀은 즉시 wireable ray hit이고 다음 E press에서 wire가 활성화된다', () => {
    const player = createPlayerState({ position: { x: 0, y: 0.9, z: 0 } })
    let session = createPivotSession({
      terrain: [],
      captureStack: [chunk('air-anchor')],
      player,
    })
    session = stepPivotSession(session, {
      ...IDLE_PLAYER_COMMAND,
      placeReleased: true,
      placementOrigin: { x: 0.25, y: 1.5, z: 10.25 },
      placementDirection: { x: 0, y: 0, z: -1 },
    })
    const origin = playerWireOrigin(session.state.player.position)
    const placed = session.snapshot.terrain.find((cell) => cell.chunkId === 'air-anchor')
    expect(placed).toBeDefined()
    const center = placed === undefined
      ? { x: 0, y: 0, z: -1 }
      : {
          x: (placed.index.x + 0.5) * 0.5,
          y: (placed.index.y + 0.5) * 0.5,
          z: (placed.index.z + 0.5) * 0.5,
        }
    const direction = {
      x: center.x - origin.x,
      y: center.y - origin.y,
      z: center.z - origin.z,
    }

    expect(session.world.raycast(origin, direction, 30)).toMatchObject({ wireable: true })
    session = stepPivotSession(session, {
      ...IDLE_PLAYER_COMMAND,
      wireEdges: ['press'],
      wireAimDirection: direction,
    })
    expect(session.state.player.wire).not.toBeNull()
  })

  it('capture와 placement release가 같은 tick이면 capture만 실행한다', () => {
    const session = createPivotSession({
      terrain: [terrainCell({ x: 0, y: 1, z: 0 })],
      captureStack: [chunk('existing')],
    })

    const next = stepPivotSession(session, {
      ...IDLE_PLAYER_COMMAND,
      capturePressed: true,
      captureOrigin: { x: 0.25, y: 0.75, z: 2 },
      captureDirection: { x: 0, y: 0, z: -1 },
      placeReleased: true,
      placementOrigin: { x: 0.25, y: 0.75, z: 2 },
      placementDirection: { x: 0, y: 0, z: -1 },
    })

    expect(next.snapshot.captureStack.map((entry) => entry.id)).toEqual([
      'existing',
      'capture-1',
    ])
    expect(next.snapshot.terrain).toHaveLength(0)
  })
})

function chunk(id: string): CapturedChunk {
  return {
    id,
    source: 'terrain',
    captureBasis: {
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      forward: { x: 0, y: 0, z: -1 },
    },
    cells: [{
      gridOffset: { x: 0, y: 0, z: 0 },
      material: 'wood',
      collidable: false,
      wireable: false,
    }],
  }
}

function terrainCell(index: TerrainCell['index']): TerrainCell {
  return {
    index,
    material: 'rock',
    collidable: true,
    wireable: true,
    capturable: true,
    destructible: true,
    owner: 'level',
  }
}
