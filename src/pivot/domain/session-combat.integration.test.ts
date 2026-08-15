import { describe, expect, it } from 'vitest'

import type { CapturedChunk } from './capture'
import { IDLE_PLAYER_COMMAND } from './commands'
import { createPlayerState } from './player'
import { createPivotSession, stepPivotSession } from './session'
import type { PivotSessionOptions } from './session'

describe('전투 session 순서 통합', () => {
  it('same-tick placement terrain은 player shot을 뒤 enemy보다 먼저 차폐한다', () => {
    let session = createPivotSession({
      terrain: [],
      captureStack: [wallChunk()],
      enemies: [{
        id: 'enemy-behind-wall',
        position: { x: 0.25, y: 0.25, z: -22 },
        halfSize: { x: 0.55, y: 0.75, z: 0.55 },
        hp: 75,
        maxHp: 75,
        nextShotTick: 999,
        alive: true,
      }],
      player: createPlayerState({ position: { x: 0.25, y: 0.25, z: 0 } }),
    } as unknown as PivotSessionOptions)

    session = stepPivotSession(session, {
      ...IDLE_PLAYER_COMMAND,
      placeReleased: true,
      placementOrigin: { x: 0.25, y: 0.25, z: 0 },
      placementDirection: { x: 0, y: 0, z: -1 },
      shootPressed: true,
      shootOrigin: { x: 0.25, y: 0.25, z: 0 },
      shootDirection: { x: 0, y: 0, z: -1 },
    } as typeof IDLE_PLAYER_COMMAND)
    for (let tick = 0; tick < 30; tick += 1) {
      session = stepPivotSession(session, IDLE_PLAYER_COMMAND)
    }
    const snapshot = session.snapshot as unknown as {
      enemies: readonly { hp: number }[]
      projectiles: readonly unknown[]
    }

    expect(session.snapshot.terrain.some(({ chunkId }) => chunkId === 'same-tick-wall')).toBe(true)
    expect(snapshot.enemies[0]?.hp).toBe(75)
    expect(snapshot.projectiles).toEqual([])
  })

  it('same-tick placement terrain은 첫 swept segment 안의 injected projectile을 즉시 차폐한다', () => {
    let session = createPivotSession({
      terrain: [],
      captureStack: [wallChunk()],
      enemies: [{
        id: 'enemy-first-tick',
        position: { x: 0.25, y: 0.25, z: -20.5 },
        halfSize: { x: 0.55, y: 0.75, z: 0.55 },
        hp: 75,
        maxHp: 75,
        nextShotTick: 999,
        alive: true,
      }],
      projectiles: [{
        id: 'placement-order',
        owner: 'player',
        position: { x: 0.25, y: 0.25, z: -18.5 },
        velocity: { x: 0, y: 0, z: -120 },
        damage: 25,
        ttl: 108,
        radius: 0.12,
      }],
      player: createPlayerState({ position: { x: 0.25, y: 0.25, z: 0 } }),
    } as unknown as PivotSessionOptions)

    session = stepPivotSession(session, {
      ...IDLE_PLAYER_COMMAND,
      placeReleased: true,
      placementOrigin: { x: 0.25, y: 0.25, z: 0 },
      placementDirection: { x: 0, y: 0, z: -1 },
    })
    const snapshot = session.snapshot as unknown as {
      enemies: readonly { hp: number }[]
      projectiles: readonly unknown[]
    }

    expect(session.snapshot.terrain.some(({ chunkId }) => chunkId === 'same-tick-wall')).toBe(true)
    expect(snapshot.enemies[0]?.hp).toBe(75)
    expect(snapshot.projectiles).toEqual([])
  })

  it('기존 capture placement wire movement 명령과 combat snapshot 결정론을 함께 유지한다', () => {
    const options = {
      terrain: [],
      enemies: [{
        id: 'enemy-stable',
        position: { x: 4, y: 2, z: -10 },
        halfSize: { x: 0.55, y: 0.75, z: 0.55 },
        hp: 75,
        maxHp: 75,
        nextShotTick: 30,
        alive: true,
      }],
    } as unknown as PivotSessionOptions
    let first = createPivotSession(options)
    let second = createPivotSession(options)
    for (let tick = 0; tick < 180; tick += 1) {
      const command = {
        ...IDLE_PLAYER_COMMAND,
        moveX: tick % 40 < 20 ? 1 : -1,
        wireEdges: tick === 10 ? ['press'] as const : tick === 20 ? ['release'] as const : [],
        shootPressed: tick % 8 === 0,
        shootOrigin: { x: 0, y: 0, z: 0 },
        shootDirection: { x: 0, y: 0, z: -1 },
      } as typeof IDLE_PLAYER_COMMAND
      first = stepPivotSession(first, command)
      second = stepPivotSession(second, command)
    }
    expect(first.snapshot).toEqual(second.snapshot)
  })
})

function wallChunk(): CapturedChunk {
  return {
    id: 'same-tick-wall',
    source: 'terrain',
    captureBasis: {
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      forward: { x: 0, y: 0, z: -1 },
    },
    cells: [{
      gridOffset: { x: 0, y: 0, z: 0 },
      material: 'rock',
      collidable: true,
      wireable: true,
    }],
  }
}
