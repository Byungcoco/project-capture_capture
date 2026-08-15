import { describe, expect, it } from 'vitest'

import { createAabbCollisionWorld } from './aabb-collision-world'
import { createCellCollisionWorld } from './cell-world'
import { sweptSphereAabbDistance } from './collision-world'
import type { CollisionWorld } from './collision-world'
import { IDLE_PLAYER_COMMAND } from './commands'
import type { Vec3 } from './math'
import { createPlayerState, playerWireOrigin, stepPlayer } from './player'
import type { StaticCollider } from './player'
import { MOVEMENT_SPAWN, MOVEMENT_TERRAIN } from '../demo/movement-course'

interface CandidateWorld extends CollisionWorld {
  queryWireCandidates?: (
    origin: Vec3,
    aimDirection: Vec3,
    maximumDistance: number,
  ) => readonly { point: Vec3; wireable: boolean }[]
}

describe('exact sphere sweep', () => {
  it('1e-5m 저속 segment도 같은 tick 안의 face 접촉을 놓치지 않는다', () => {
    const distance = sweptSphereAabbDistance(
      { x: -0.120005, y: 0.5, z: 0.5 },
      { x: 0.00001, y: 0, z: 0 },
      0.12,
      {
        center: { x: 0.5, y: 0.5, z: 0.5 },
        halfSize: { x: 0.5, y: 0.5, z: 0.5 },
      },
    )

    expect(distance).not.toBeNull()
    expect(distance).toBeCloseTo(0.000005, 10)
  })
})

describe('AABB wire assist query', () => {
  it('생성 뒤 source collider와 배열을 변경해도 raycast move 후보가 같은 snapshot geometry를 사용한다', () => {
    const collider: StaticCollider = {
      center: { x: 0, y: 0, z: -5 },
      halfSize: { x: 1, y: 1, z: 1 },
      wireable: true,
    }
    const source = [collider]
    const world = createAabbCollisionWorld(source)

    collider.center.x = 5
    collider.center.z = 0
    source.splice(0, 1, {
      center: { x: 10, y: 0, z: 0 },
      halfSize: { x: 1, y: 1, z: 1 },
      wireable: false,
    })

    expect(world.raycast({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, 30)?.point.z)
      .toBeCloseTo(-4)
    expect(world.raycast({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 30)).toBeNull()
    expect(world.queryWireCandidates?.(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: -1 },
      30,
    )).toContainEqual({ point: { x: 0, y: 0, z: -4 }, wireable: true })
    expect(world.moveAabb(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: -5 },
      { x: 0.5, y: 0.5, z: 0.5 },
      1,
    )).toMatchObject({
      position: { x: 0, y: 0, z: -3.5 },
      velocity: { x: 0, y: 0, z: 0 },
      blocked: true,
    })
  })

  it('결정론적인 collider 표면 후보를 제공한다', () => {
    const collider: StaticCollider = {
      center: { x: 8, y: 2, z: 1 },
      halfSize: { x: 0.5, y: 1, z: 0.5 },
      wireable: true,
    }
    const world = createAabbCollisionWorld([collider]) as CandidateWorld

    expect(typeof world.queryWireCandidates).toBe('function')
    const candidates = world.queryWireCandidates?.(
      { x: 0, y: 1.5, z: 0 },
      { x: 1, y: 0, z: 0 },
      30,
    ) ?? []

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every(({ point }) => pointOnSurface(point, collider))).toBe(true)
    expect(candidates.every(({ wireable }) => wireable)).toBe(true)
  })

  it('30m sphere와 교차하는 AABB edge의 실제 7.4도 가시 표면을 cone 후보로 선택한다', () => {
    const player = createPlayerState({
      position: { x: 0, y: -0.6, z: 0 },
      grounded: false,
    })
    const world = createAabbCollisionWorld([{
      center: { x: -3.9, y: 0.85, z: -26 },
      halfSize: { x: 0.1, y: 0.15, z: 4 },
      wireable: true,
    }])
    const next = stepPlayer(
      player,
      { ...IDLE_PLAYER_COMMAND, wireAimDirection: { x: 0, y: 0, z: -1 }, wireEdges: ['press'] },
      world,
      1 / 60,
    )
    const origin = playerWireOrigin(player.position)
    const anchor = next.wire?.anchor

    expect(anchor).toBeDefined()
    const offset = anchor === undefined
      ? { x: 0, y: 0, z: 0 }
      : { x: anchor.x - origin.x, y: anchor.y - origin.y, z: anchor.z - origin.z }
    const distance = Math.hypot(offset.x, offset.y, offset.z)
    const angle = Math.acos(-offset.z / distance) * 180 / Math.PI
    expect(distance).toBeLessThanOrEqual(30 + 1e-8)
    expect(angle).toBeCloseTo(7.4, 1)
  })

  it('30m sphere와 교차하는 AABB face 내부의 실제 7.277도 가시 표면을 선택한다', () => {
    const player = createPlayerState({ grounded: false })
    const world = createAabbCollisionWorld([{
      center: { x: -3.9, y: 1.5, z: -25 },
      halfSize: { x: 0.1, y: 5, z: 8 },
      wireable: true,
    }])
    const next = stepPlayer(
      player,
      { ...IDLE_PLAYER_COMMAND, wireAimDirection: { x: 0, y: 0, z: -1 }, wireEdges: ['press'] },
      world,
      1 / 60,
    )
    const origin = playerWireOrigin(player.position)
    const anchor = next.wire?.anchor

    expect(anchor).toBeDefined()
    const offset = anchor === undefined
      ? { x: 0, y: 0, z: 0 }
      : { x: anchor.x - origin.x, y: anchor.y - origin.y, z: anchor.z - origin.z }
    const distance = Math.hypot(offset.x, offset.y, offset.z)
    const angle = Math.acos(-offset.z / distance) * 180 / Math.PI
    expect(distance).toBeCloseTo(30, 8)
    expect(angle).toBeCloseTo(7.277, 2)
    expect(anchor?.x).toBeCloseTo(-3.8, 8)
    expect(anchor?.y).toBeCloseTo(1.5, 8)
  })

  it('동거리 mixed-wireable ray는 collider 순서와 무관하게 non-wireable 차폐를 우선한다', () => {
    const wireable: StaticCollider = {
      center: { x: 0, y: 1.5, z: -5 },
      halfSize: { x: 1, y: 1, z: 1 },
      wireable: true,
    }
    const blocker = { ...wireable, wireable: false }
    const first = press(createAabbCollisionWorld([wireable, blocker]))
    const second = press(createAabbCollisionWorld([blocker, wireable]))

    expect(first.wire).toBeNull()
    expect(second.wire).toBeNull()
  })

  it('1896셀 direct-miss press는 assist LOS raycast를 현실적 상한 안에서 수행한다', () => {
    const base = createCellCollisionWorld(MOVEMENT_TERRAIN)
    let raycastCalls = 0
    const counted: CollisionWorld = {
      ...base,
      raycast(origin, direction, maximumDistance) {
        raycastCalls += 1
        return base.raycast(origin, direction, maximumDistance)
      },
    }

    stepPlayer(
      createPlayerState({ position: { ...MOVEMENT_SPAWN } }),
      { ...IDLE_PLAYER_COMMAND, wireAimDirection: { x: 0, y: 1, z: 0 }, wireEdges: ['press'] },
      counted,
      1 / 60,
    )

    expect(MOVEMENT_TERRAIN).toHaveLength(1_896)
    expect(raycastCalls).toBeLessThanOrEqual(65)
  })

  it('NaN과 zero ray는 비유한 hit를 만들지 않고 zero 후보는 유한 표면만 반환한다', () => {
    const collider: StaticCollider = {
      center: { x: 0, y: 0, z: 0 },
      halfSize: { x: 1, y: 1, z: 1 },
      wireable: true,
    }
    const world = createAabbCollisionWorld([collider]) as CandidateWorld

    expect(world.raycast({ x: 0, y: 0, z: 0 }, { x: Number.NaN, y: 0, z: 0 }, 30)).toBeNull()
    expect(world.raycast({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 30)).toBeNull()
    expect(world.queryWireCandidates?.(
      { x: 0, y: 0, z: 0 },
      { x: Number.NaN, y: 0, z: 0 },
      30,
    )).toEqual([])
    const zeroCandidates = world.queryWireCandidates?.(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      30,
    ) ?? []
    expect(zeroCandidates.length).toBeGreaterThan(0)
    expect(zeroCandidates.every(({ point }) => (
      Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)
    ))).toBe(true)
    expect(zeroCandidates.every(({ point }) => pointOnSurface(point, collider))).toBe(true)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'batch visibility는 non-finite maximumDistance %s를 거부한다',
    (maximumDistance) => {
      const world = createAabbCollisionWorld([{
        center: { x: 0, y: 0, z: -5 },
        halfSize: { x: 1, y: 1, z: 1 },
        wireable: true,
      }])

      expect(world.queryFirstVisibleWireCandidate?.(
        { x: 0, y: 0, z: 0 },
        [{ point: { x: 0, y: 0, z: -4 }, wireable: true }],
        maximumDistance,
        1e-5,
      )).toBeNull()
    },
  )
})

function press(world: CollisionWorld) {
  return stepPlayer(
    createPlayerState(),
    { ...IDLE_PLAYER_COMMAND, wireAimDirection: { x: 0, y: 0, z: -1 }, wireEdges: ['press'] },
    world,
    1 / 60,
  )
}

function pointOnSurface(point: Vec3, collider: StaticCollider): boolean {
  const inside = (['x', 'y', 'z'] as const).every((axis) => (
    point[axis] >= collider.center[axis] - collider.halfSize[axis] - 1e-10
    && point[axis] <= collider.center[axis] + collider.halfSize[axis] + 1e-10
  ))
  const onFace = (['x', 'y', 'z'] as const).some((axis) => (
    Math.abs(Math.abs(point[axis] - collider.center[axis]) - collider.halfSize[axis]) <= 1e-10
  ))
  return inside && onFace
}
