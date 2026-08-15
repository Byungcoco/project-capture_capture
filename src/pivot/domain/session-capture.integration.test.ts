import { describe, expect, it } from 'vitest'

import { IDLE_PLAYER_COMMAND } from './commands'
import type { TerrainCell } from './cell-world'
import { createPlayerState } from './player'
import { createPivotSession, stepPivotSession } from './session'
import type { CollisionWorld } from './collision-world'
import type { CapturedChunk } from './capture'
import { CAPTURE_STACK_LIMIT } from './capture'

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

  it('terrain 모드와 custom world 모드를 함께 구성하면 안정 code로 거부한다', () => {
    expect(() => createPivotSession({
      terrain: captureWall(),
      world: emptyWorld(),
    } as never)).toThrowError(expect.objectContaining({ code: 'INVALID_SESSION_MODE' }))
  })

  it('변경 없는 큰 terrain tick은 frozen terrain과 stack snapshot 참조를 재사용한다', () => {
    const terrain = Array.from({ length: 2_000 }, (_, x) => terrainCellAt(x))
    const session = createPivotSession({ terrain })
    const terrainSnapshot = session.snapshot.terrain
    const stackSnapshot = session.snapshot.captureStack

    const next = stepPivotSession(session, IDLE_PLAYER_COMMAND)

    expect(Object.isFrozen(terrainSnapshot)).toBe(true)
    expect(next.snapshot.terrain).toBe(terrainSnapshot)
    expect(next.snapshot.captureStack).toBe(stackSnapshot)
  })

  it('source와 snapshot의 terrain stack nested 변경은 authority와 query를 바꾸지 않는다', () => {
    const sourceTerrain = captureWall()
    const sourceStack: CapturedChunk[] = [{
      id: 'source',
      source: 'terrain',
      captureBasis: structuredClone(CAPTURE_COMMAND.captureBasis),
      cells: [{
        gridOffset: { x: 0, y: 0, z: 0 },
        material: 'rock',
        collidable: true,
        wireable: true,
      }],
    }]
    const session = createPivotSession({ terrain: sourceTerrain, captureStack: sourceStack })
    sourceTerrain[0]!.index.z = 20
    sourceStack[0]!.captureBasis.forward.z = 1
    sourceStack[0]!.cells[0]!.gridOffset.x = 10

    expect(() => {
      session.snapshot.terrain[0]!.index.z = 30
    }).toThrow(TypeError)
    expect(() => {
      session.snapshot.captureStack[0]!.cells[0]!.gridOffset.x = 30
    }).toThrow(TypeError)
    expect(session.state.terrain[0]?.index.z).toBe(0)
    expect(session.state.captureStack[0]?.captureBasis.forward.z).toBe(-1)
    expect(session.state.captureStack[0]?.cells[0]?.gridOffset.x).toBe(0)
    expect(session.world.raycast(
      { x: 0.25, y: 0.75, z: 2 },
      { x: 0, y: 0, z: -1 },
      10,
    )?.distance).toBeCloseTo(1.5, 10)
  })

  it('초기 capture stack은 5개를 허용하고 6개를 안정 code로 거부한다', () => {
    const fiveChunks = Array.from(
      { length: CAPTURE_STACK_LIMIT },
      (_, index) => capturedChunk(`initial-${index}`),
    )
    const accepted = createPivotSession({ terrain: captureWall(), captureStack: fiveChunks })

    expect(accepted.state.captureStack).toHaveLength(5)
    expect(() => createPivotSession({
      terrain: captureWall(),
      captureStack: [...fiveChunks, capturedChunk('initial-5')],
    })).toThrowError(expect.objectContaining({ code: 'CAPTURE_STACK_LIMIT_EXCEEDED' }))
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

function terrainCellAt(x: number): TerrainCell {
  return {
    ...captureWall()[0]!,
    index: { x, y: 1, z: 0 },
  }
}

function emptyWorld(): CollisionWorld {
  return {
    sweepSphere: () => null,
    raycast: () => null,
    moveAabb: (position, velocity) => ({
      position,
      velocity,
      grounded: false,
      blocked: false,
      contacts: [],
    }),
  }
}

function capturedChunk(id: string): CapturedChunk {
  return {
    id,
    source: 'terrain',
    captureBasis: structuredClone(CAPTURE_COMMAND.captureBasis),
    cells: [],
  }
}
