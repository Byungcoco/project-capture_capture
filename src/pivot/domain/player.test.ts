import { describe, expect, it } from 'vitest'

import { IDLE_PLAYER_COMMAND } from './commands'
import { createAabbCollisionWorld } from './aabb-collision-world'
import type {
  CollisionContact,
  CollisionRayHit,
  CollisionWorld,
} from './collision-world'
import {
  JUMP_SPEED,
  MAX_WIRE_RELEASE_SPEED,
  WIRE_RELEASE_UP_SPEED,
  WIRE_SWING_STEERING_ACCELERATION,
  createPlayerState,
  playerWireOrigin,
  stepPlayer,
} from './player'
import type { PlayerState, StaticCollider } from './player'
import { lengthVec3 } from './math'
import type { Vec3 } from './math'

const STEP_SECONDS = 1 / 60
const VALID_WIRE_HIT: CollisionRayHit = {
  point: { x: 12, y: 4, z: 0 },
  distance: 12,
  wireable: true,
}

describe('피벗 플레이어', () => {
  it('공중에서는 두 번째 점프까지만 허용한다', () => {
    const world = integratingWorld()
    const firstJump = stepPlayer(
      createPlayerState(),
      { ...IDLE_PLAYER_COMMAND, jumpPressed: true },
      world,
      STEP_SECONDS,
    )
    const secondJump = stepPlayer(
      firstJump,
      { ...IDLE_PLAYER_COMMAND, jumpPressed: true },
      world,
      STEP_SECONDS,
    )
    const thirdJump = stepPlayer(
      secondJump,
      { ...IDLE_PLAYER_COMMAND, jumpPressed: true },
      world,
      STEP_SECONDS,
    )

    expect(firstJump.velocity.y).toBe(JUMP_SPEED)
    expect(secondJump.velocity.y).toBe(JUMP_SPEED)
    expect(secondJump.airJumpsRemaining).toBe(0)
    expect(thirdJump.velocity.y).toBeLessThan(JUMP_SPEED)
  })

  it('착지하면 공중 점프와 대시가 회복된다', () => {
    const exhausted: PlayerState = createPlayerState({
      velocity: { x: 0, y: -2, z: 0 },
      grounded: false,
      airJumpsRemaining: 0,
      dashAvailable: false,
    })
    const landed = stepPlayer(
      exhausted,
      IDLE_PLAYER_COMMAND,
      integratingWorld({ grounded: true }),
      STEP_SECONDS,
    )

    expect(landed.grounded).toBe(true)
    expect(landed.airJumpsRemaining).toBe(1)
    expect(landed.dashAvailable).toBe(true)
  })

  it('대시는 실제 이동하면서 벽 왼쪽을 넘지 않는다', () => {
    const wallLeft = 2
    const world = integratingWorld({ maximumPlayerX: wallLeft - 0.4 })
    let player = createPlayerState()
    for (let tick = 0; tick < 9; tick += 1) {
      player = stepPlayer(
        player,
        {
          ...IDLE_PLAYER_COMMAND,
          moveZ: 1,
          cameraForward: { x: 1, y: 0, z: 0 },
          dashPressed: tick === 0,
        },
        world,
        STEP_SECONDS,
      )
    }

    expect(player.position.x).toBeGreaterThan(0)
    expect(player.position.x + player.halfSize.x).toBeLessThanOrEqual(wallLeft)
  })

  it('와이어 유효 표면은 연결하고 사거리 밖과 차폐 표면은 거부한다', () => {
    const queriedRanges: number[] = []
    const valid = stepPlayer(
      createPlayerState(),
      {
        ...IDLE_PLAYER_COMMAND,
        wireAimDirection: { x: 1, y: 0.2, z: 0 },
        wireEdges: ['press'],
      },
      queryWorld(VALID_WIRE_HIT, queriedRanges),
      STEP_SECONDS,
    )
    const outOfRange = stepPlayer(
      createPlayerState(),
      {
        ...IDLE_PLAYER_COMMAND,
        wireAimDirection: { x: 1, y: 0, z: 0 },
        wireEdges: ['press'],
      },
      queryWorld({ ...VALID_WIRE_HIT, distance: 30.01 }),
      STEP_SECONDS,
    )
    const occluded = stepPlayer(
      createPlayerState(),
      {
        ...IDLE_PLAYER_COMMAND,
        wireAimDirection: { x: 1, y: 0, z: 0 },
        wireEdges: ['press'],
      },
      queryWorld({
        point: { x: 4, y: 1.5, z: 0 },
        distance: 4,
        wireable: false,
      }),
      STEP_SECONDS,
    )

    expect(valid.wire).not.toBeNull()
    expect(valid.wire?.ropeLength).toBeCloseTo(Math.hypot(12, 2.5), 10)
    expect(queriedRanges).toEqual([30])
    expect(outOfRange.wire).toBeNull()
    expect(occluded.wire).toBeNull()
  })

  it('정확한 direct wireable hit는 cone과 overhead 후보보다 우선한다', () => {
    const direct = collider({ x: 5, y: 1.5, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 })
    const cone = collider({ x: 8, y: 1.5, z: 0.8 }, { x: 0.25, y: 0.25, z: 0.25 })
    const overhead = collider({ x: 0, y: 6, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 })

    const player = pressWire(createAabbCollisionWorld([overhead, cone, direct]), { x: 1, y: 0, z: 0 })

    expect(player.wire?.anchor).toEqual({ x: 4.5, y: 1.5, z: 0 })
  })

  it('direct miss는 8도 cone 안의 최소 각도 표면에 붙고 8도 밖과 뒤에는 붙지 않는다', () => {
    const lessAligned = collider(
      { x: 6, y: 1.5, z: 0.7 },
      { x: 0.25, y: 0.25, z: 0.25 },
    )
    const moreAligned = collider(
      { x: 10, y: 1.5, z: 0.5 },
      { x: 0.25, y: 0.25, z: 0.25 },
    )
    const assisted = pressWire(
      createAabbCollisionWorld([lessAligned, moreAligned]),
      { x: 1, y: 0, z: 0 },
    )
    const outsideCone = pressWire(
      createAabbCollisionWorld([
        collider({ x: 8, y: 1.5, z: 1.5 }, { x: 0.25, y: 0.25, z: 0.25 }),
        collider({ x: -3, y: 1.5, z: 0 }, { x: 0.25, y: 0.25, z: 0.25 }),
      ]),
      { x: 1, y: 0, z: 0 },
    )

    expect(assisted.wire).not.toBeNull()
    expect(assisted.wire?.anchor.x).toBeGreaterThan(9)
    expect(assisted.wire?.ropeLength).toBeCloseTo(
      distance(playerWireOrigin(createPlayerState().position), assisted.wire?.anchor ?? { x: 0, y: 0, z: 0 }),
      10,
    )
    expect(outsideCone.wire).toBeNull()
  })

  it('overhead는 aim 반대여도 5m 수평 12m 1m 높이 안에서 정렬하고 경계 밖은 거부한다', () => {
    const fartherHorizontal = collider(
      { x: 3, y: 6, z: 0 },
      { x: 0.5, y: 0.5, z: 0.5 },
    )
    const nearerHorizontal = collider(
      { x: -2, y: 7, z: 0 },
      { x: 0.5, y: 0.5, z: 0.5 },
    )
    const assisted = pressWire(
      createAabbCollisionWorld([fartherHorizontal, nearerHorizontal]),
      { x: 0, y: 0, z: -1 },
    )
    const invalid = pressWire(
      createAabbCollisionWorld([
        collider({ x: 5.6, y: 6, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 }),
        collider({ x: 0, y: 14.5, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 }),
        collider({ x: 0, y: 2.4, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 }),
        collider({ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 }),
      ]),
      { x: 0, y: 0, z: -1 },
    )

    expect(assisted.wire).not.toBeNull()
    expect(assisted.wire?.anchor.x).toBeLessThan(0)
    expect(invalid.wire).toBeNull()
  })

  it('non-wireable 앞 장애물이 cone과 overhead anchor를 가리면 assist하지 않는다', () => {
    const coneBlocked = pressWire(
      createAabbCollisionWorld([
        collider({ x: 4, y: 1.5, z: 0.4 }, { x: 0.5, y: 1, z: 0.5 }, false),
        collider({ x: 8, y: 1.5, z: 0.8 }, { x: 0.5, y: 0.5, z: 0.5 }),
      ]),
      { x: 1, y: 0, z: 0 },
    )
    const overheadBlocked = pressWire(
      createAabbCollisionWorld([
        collider({ x: 0, y: 4, z: 0 }, { x: 1, y: 0.5, z: 1 }, false),
        collider({ x: 0, y: 7, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 }),
      ]),
      { x: 1, y: 0, z: 0 },
    )

    expect(coneBlocked.wire).toBeNull()
    expect(overheadBlocked.wire).toBeNull()
  })

  it('동률 cone과 overhead 후보는 collider 입력 순서와 무관하게 같은 anchor를 고른다', () => {
    const upper = collider({ x: 8, y: 1.5, z: 1 }, { x: 0.25, y: 0.25, z: 0.25 })
    const lower = collider({ x: 8, y: 1.5, z: -1 }, { x: 0.25, y: 0.25, z: 0.25 })
    const firstCone = pressWire(createAabbCollisionWorld([upper, lower]), { x: 1, y: 0, z: 0 })
    const secondCone = pressWire(createAabbCollisionWorld([lower, upper]), { x: 1, y: 0, z: 0 })
    const left = collider({ x: -3, y: 7, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 })
    const right = collider({ x: 3, y: 7, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 })
    const firstOverhead = pressWire(createAabbCollisionWorld([right, left]), { x: 0, y: 0, z: -1 })
    const secondOverhead = pressWire(createAabbCollisionWorld([left, right]), { x: 0, y: 0, z: -1 })

    expect(firstCone.wire).not.toBeNull()
    expect(secondCone.wire).not.toBeNull()
    expect(firstCone.wire?.anchor).toEqual(secondCone.wire?.anchor)
    expect(firstCone.wire?.anchor.z).toBeLessThan(0)
    expect(firstOverhead.wire).not.toBeNull()
    expect(secondOverhead.wire).not.toBeNull()
    expect(firstOverhead.wire?.anchor).toEqual(secondOverhead.wire?.anchor)
    expect(firstOverhead.wire?.anchor.x).toBeLessThan(0)
  })

  it('정렬 상위 32개가 차폐되어도 33번째 가시 cone 후보에 연결한다', () => {
    const origin = playerWireOrigin(createPlayerState().position)
    const candidates = Array.from({ length: 33 }, (_, index) => {
      const angle = (index + 1) * 0.1 * Math.PI / 180
      return {
        point: {
          x: Math.sin(angle) * 10,
          y: origin.y,
          z: -Math.cos(angle) * 10,
        },
        wireable: true,
      }
    })
    let raycastCalls = 0
    const world: CollisionWorld = {
      ...integratingWorld(),
      queryWireCandidates: () => candidates,
      raycast(rayOrigin, direction) {
        raycastCalls += 1
        const length = lengthVec3(direction)
        const normalized = {
          x: direction.x / length,
          y: direction.y / length,
          z: direction.z / length,
        }
        const angle = Math.atan2(normalized.x, -normalized.z) * 180 / Math.PI
        if (Math.abs(angle) < 1e-8) return null
        const visible = angle > 3.25
        const distance = visible ? 10 : 5
        return {
          point: {
            x: rayOrigin.x + normalized.x * distance,
            y: rayOrigin.y + normalized.y * distance,
            z: rayOrigin.z + normalized.z * distance,
          },
          distance,
          wireable: visible,
        }
      },
    }

    const player = pressWire(world, { x: 0, y: 0, z: -1 })

    expect(player.wire?.anchor).toEqual(candidates[32]?.point)
    expect(raycastCalls).toBe(34)
  })

  it('와이어 해제 후 속도를 보존하되 초속 30으로 제한한다', () => {
    const released = stepPlayer(
      createPlayerState({
        grounded: false,
        velocity: { x: 20, y: 0, z: 0 },
        wire: { anchor: { x: 20, y: 4, z: 0 }, ropeLength: 20 },
      }),
      { ...IDLE_PLAYER_COMMAND, wireEdges: ['release'] },
      integratingWorld(),
      STEP_SECONDS,
    )

    expect(released.wire).toBeNull()
    expect(released.velocity.x).toBeGreaterThan(0)
    expect(released.velocity.y).toBeGreaterThan(10)
    expect(lengthVec3(released.velocity)).toBeLessThanOrEqual(MAX_WIRE_RELEASE_SPEED)
  })

  it('카메라 yaw 기준 로컬 이동과 수직 조준 fallback을 월드 방향으로 바꾼다', () => {
    const yawed = stepPlayer(
      createPlayerState(),
      { ...IDLE_PLAYER_COMMAND, moveZ: 1, cameraForward: { x: 1, y: 0, z: 0 } },
      integratingWorld({ grounded: true }),
      STEP_SECONDS,
    )
    const verticalAim = stepPlayer(
      createPlayerState(),
      { ...IDLE_PLAYER_COMMAND, moveZ: 1, cameraForward: { x: 0, y: 1, z: 0 } },
      integratingWorld({ grounded: true }),
      STEP_SECONDS,
    )

    expect(yawed.velocity.x).toBeGreaterThan(0)
    expect(Math.abs(yawed.velocity.z)).toBeLessThan(1e-10)
    expect(verticalAim.velocity.z).toBeLessThan(0)
  })

  it('대각선 한 tick 지상 가속 벡터 크기는 정확히 초당 40이다', () => {
    const player = stepPlayer(
      createPlayerState(),
      { ...IDLE_PLAYER_COMMAND, moveX: 1, moveZ: 1 },
      integratingWorld({ grounded: true }),
      STEP_SECONDS,
    )

    expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeCloseTo(40 / 60, 10)
  })

  it('대각선 한 tick 공중 가속 벡터 크기는 정확히 초당 16이다', () => {
    const player = stepPlayer(
      createPlayerState({ grounded: false }),
      { ...IDLE_PLAYER_COMMAND, moveX: 1, moveZ: 1 },
      integratingWorld(),
      STEP_SECONDS,
    )

    expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeCloseTo(16 / 60, 10)
  })

  it('대각선 이동도 초속 8미터 상한을 지킨다', () => {
    let player = createPlayerState()
    const world = integratingWorld({ grounded: true })
    for (let tick = 0; tick < 60; tick += 1) {
      player = stepPlayer(
        player,
        { ...IDLE_PLAYER_COMMAND, moveX: 1, moveZ: 1 },
        world,
        STEP_SECONDS,
      )
    }
    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z)

    expect(horizontalSpeed).toBeGreaterThan(7.5)
    expect(horizontalSpeed).toBeLessThanOrEqual(8)
  })

  it('중력은 초당 마이너스 24이고 낙하 속도는 마이너스 30으로 제한한다', () => {
    let player = createPlayerState({ grounded: false })
    const world = integratingWorld()
    player = stepPlayer(player, IDLE_PLAYER_COMMAND, world, STEP_SECONDS)
    expect(player.velocity.y).toBeCloseTo(-24 / 60, 10)

    for (let tick = 0; tick < 300; tick += 1) {
      player = stepPlayer(player, IDLE_PLAYER_COMMAND, world, STEP_SECONDS)
    }
    expect(player.velocity.y).toBe(-30)
  })

  it('대시는 정확히 9틱이고 같은 충전에서 재입력해도 다시 시작하지 않는다', () => {
    let player = createPlayerState()
    const world = integratingWorld({ grounded: true })
    player = stepPlayer(
      player,
      {
        ...IDLE_PLAYER_COMMAND,
        moveZ: 1,
        cameraForward: { x: 1, y: 0, z: 0 },
        dashPressed: true,
      },
      world,
      STEP_SECONDS,
    )
    expect(player.dashTicksRemaining).toBe(8)
    expect(Math.hypot(player.velocity.x, player.velocity.z)).toBe(18)

    for (let tick = 1; tick < 9; tick += 1) {
      player = stepPlayer(
        player,
        {
          ...IDLE_PLAYER_COMMAND,
          moveZ: 1,
          cameraForward: { x: 1, y: 0, z: 0 },
          dashPressed: tick === 4,
        },
        world,
        STEP_SECONDS,
      )
    }
    expect(player.position.x).toBeCloseTo(18 * 9 / 60, 10)
    expect(player.dashTicksRemaining).toBe(0)
    expect(player.dashAvailable).toBe(false)

    player = stepPlayer(
      player,
      {
        ...IDLE_PLAYER_COMMAND,
        moveZ: 1,
        cameraForward: { x: 1, y: 0, z: 0 },
        dashPressed: true,
      },
      world,
      STEP_SECONDS,
    )
    expect(player.dashTicksRemaining).toBe(0)
    expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeLessThan(18)
  })

  it('wire release 다음 press면 새 anchor에 연결한다', () => {
    const command = {
      ...IDLE_PLAYER_COMMAND,
      wireAimDirection: { x: 1, y: 0.2, z: 0 },
      wireEdges: ['release', 'press'] as const,
    }
    const player = stepPlayer(
      createPlayerState({
        wire: { anchor: { x: -5, y: 3, z: 0 }, ropeLength: 5 },
      }),
      command,
      queryWorld(VALID_WIRE_HIT),
      STEP_SECONDS,
    )

    expect(player.wire?.anchor).toEqual(VALID_WIRE_HIT.point)
  })

  it('wire press 다음 release면 최종 상태는 해제다', () => {
    const player = stepPlayer(
      createPlayerState({
        wire: { anchor: { x: -5, y: 3, z: 0 }, ropeLength: 5 },
      }),
      {
        ...IDLE_PLAYER_COMMAND,
        wireAimDirection: { x: 1, y: 0.2, z: 0 },
        wireEdges: ['press', 'release'],
      },
      queryWorld(VALID_WIRE_HIT),
      STEP_SECONDS,
    )

    expect(player.wire).toBeNull()
  })

  it('E hold 중 wire는 48 tick과 arrival radius로 자동 회수되지 않는다', () => {
    let far = stepPlayer(
      createPlayerState({ grounded: false }),
      {
        ...IDLE_PLAYER_COMMAND,
        wireAimDirection: { x: 1, y: 0, z: 0 },
        wireEdges: ['press'],
      },
      queryWorld(VALID_WIRE_HIT),
      STEP_SECONDS,
    )
    for (let tick = 0; tick < 60; tick += 1) {
      far = stepPlayer(far, IDLE_PLAYER_COMMAND, integratingWorld(), STEP_SECONDS)
    }
    const near = stepPlayer(
      createPlayerState({
        grounded: false,
        wire: { anchor: { x: 0.8, y: 1.5, z: 0 }, ropeLength: 0.8 },
      }),
      IDLE_PLAYER_COMMAND,
      integratingWorld(),
      STEP_SECONDS,
    )

    expect(far.wire).not.toBeNull()
    expect(near.wire).not.toBeNull()
  })

  it('와이어는 수평과 수직을 포함한 모든 이동 차단에서 끝난다', () => {
    const verticallyBlocked = integratingWorld({
      blocked: true,
      zeroVelocity: true,
      contacts: [{ axis: 'y', normal: -1 }],
    })
    const player = stepPlayer(
      createPlayerState({
        grounded: false,
        wire: { anchor: { x: 0, y: 20, z: 0 }, ropeLength: 18.5 },
      }),
      IDLE_PLAYER_COMMAND,
      verticallyBlocked,
      STEP_SECONDS,
    )

    expect(player.wire).toBeNull()
  })

  it('production AABB ground 지지는 수평 wire를 끊지 않는다', () => {
    const ground: StaticCollider = {
      center: { x: 0, y: -0.5, z: 0 },
      halfSize: { x: 20, y: 0.5, z: 20 },
      wireable: false,
    }
    const player = stepPlayer(
      createPlayerState({
        wire: { anchor: { x: 12, y: 1.5, z: 0 }, ropeLength: 12 },
      }),
      IDLE_PLAYER_COMMAND,
      createAabbCollisionWorld([ground]),
      STEP_SECONDS,
    )

    expect(player.grounded).toBe(true)
    expect(player.wire).not.toBeNull()
  })

  it('production AABB 접선 벽이 실제 swing 이동을 막으면 wire를 끝낸다', () => {
    const wall: StaticCollider = {
      center: { x: 1, y: 5, z: 0 },
      halfSize: { x: 0.5, y: 5, z: 10 },
      wireable: true,
    }
    const player = stepPlayer(
      createPlayerState({
        position: { x: 0, y: 0.9, z: 0 },
        velocity: { x: 10, y: 0, z: 0 },
        grounded: false,
        wire: { anchor: { x: 0, y: 10, z: 0 }, ropeLength: 8.5 },
      }),
      IDLE_PLAYER_COMMAND,
      createAabbCollisionWorld([wall]),
      STEP_SECONDS,
    )

    expect(player.position.x).toBeLessThanOrEqual(0.10001)
    expect(player.wire).toBeNull()
  })

  it('rope 보정은 production AABB가 확정한 벽 경계를 다시 침범하지 않는다', () => {
    const wallLeft = 0
    const wall: StaticCollider = {
      center: { x: 0.5, y: 5, z: 0 },
      halfSize: { x: 0.5, y: 5, z: 10 },
      wireable: true,
    }
    const anchor = { x: wallLeft, y: 8, z: 0 }
    let player = createPlayerState({
      position: { x: -6, y: 7.4, z: 0 },
      velocity: { x: 0, y: 0, z: 8 },
      grounded: false,
      wire: { anchor, ropeLength: 6 },
    })
    const world = createAabbCollisionWorld([wall])

    for (let tick = 0; tick < 180 && player.wire !== null; tick += 1) {
      player = stepPlayer(player, IDLE_PLAYER_COMMAND, world, STEP_SECONDS)
      expect(player.position.x + player.halfSize.x).toBeLessThanOrEqual(wallLeft + 1e-10)
    }

    expect(player.wire).toBeNull()
  })

  it('와이어 당김 중 카메라 로컬 횡조향을 적용한다', () => {
    const base = createPlayerState({
      grounded: false,
      wire: { anchor: { x: 12, y: 4, z: 0 }, ropeLength: Math.hypot(12, 2.5) },
    })
    const world = integratingWorld()
    const neutral = stepPlayer(base, IDLE_PLAYER_COMMAND, world, STEP_SECONDS)
    const steered = stepPlayer(
      base,
      { ...IDLE_PLAYER_COMMAND, moveX: 1, cameraForward: { x: 1, y: 0, z: 0 } },
      world,
      STEP_SECONDS,
    )

    expect(steered.velocity.z).toBeGreaterThan(neutral.velocity.z)
  })

  it('wire 중력과 WASD 조향은 rope 접평면에서 감쇠 없이 가속한다', () => {
    const anchor = { x: 0, y: 10, z: 0 }
    const position = { x: 5, y: 4.4, z: 0 }
    const ropeLength = Math.hypot(5, -5)
    const base = createPlayerState({
      position,
      velocity: { x: 0, y: 0, z: 0 },
      grounded: false,
      wire: { anchor, ropeLength },
    })
    const neutral = stepPlayer(base, IDLE_PLAYER_COMMAND, integratingWorld(), STEP_SECONDS)
    const steered = stepPlayer(
      base,
      { ...IDLE_PLAYER_COMMAND, moveX: 1, cameraForward: { x: 1, y: 0, z: 0 } },
      integratingWorld(),
      STEP_SECONDS,
    )
    const radial = normalizeFrom(anchor, playerWireOrigin(position))

    expect(neutral.velocity.x).toBeLessThan(0)
    expect(neutral.velocity.y).toBeLessThan(0)
    expect(neutral.velocity.x).toBeCloseTo(-12 / 60, 3)
    expect(neutral.velocity.y).toBeCloseTo(-12 / 60, 3)
    expect(dot(neutral.velocity, radial)).toBeLessThanOrEqual(0)
    expect(dot(neutral.velocity, radial)).toBeGreaterThan(-0.001)
    expect(steered.velocity.z - neutral.velocity.z).toBeCloseTo(
      WIRE_SWING_STEERING_ACCELERATION * STEP_SECONDS,
      3,
    )
  })

  it('rope 장력은 바깥 radial 속도만 제거하고 inward와 tangent는 보존한다', () => {
    const anchor = { x: 0, y: 1.5, z: 0 }
    const outward = stepPlayer(
      createPlayerState({
        position: { x: 10, y: 0.9, z: 0 },
        velocity: { x: 5, y: 0, z: 3 },
        grounded: false,
        wire: { anchor, ropeLength: 10 },
      }),
      IDLE_PLAYER_COMMAND,
      integratingWorld(),
      STEP_SECONDS,
    )
    const inward = stepPlayer(
      createPlayerState({
        position: { x: 9, y: 0.9, z: 0 },
        velocity: { x: -5, y: 0, z: 3 },
        grounded: false,
        wire: { anchor, ropeLength: 10 },
      }),
      IDLE_PLAYER_COMMAND,
      integratingWorld(),
      STEP_SECONDS,
    )

    expect(outward.velocity.x).toBeLessThanOrEqual(0)
    expect(outward.velocity.x).toBeGreaterThan(-0.05)
    expect(outward.velocity.z).toBeCloseTo(3, 3)
    expect(inward.velocity.x).toBeCloseTo(-5, 8)
    expect(inward.velocity.z).toBeCloseTo(3, 8)
  })

  it('60Hz 여러 tick 동안 wire origin은 ropeLength 바깥으로 벗어나지 않는다', () => {
    const anchor = { x: 0, y: 8, z: 0 }
    let player = createPlayerState({
      position: { x: 6, y: 7.4, z: 0 },
      velocity: { x: 0, y: 0, z: 8 },
      grounded: false,
      wire: { anchor, ropeLength: 6 },
    })
    for (let tick = 0; tick < 180; tick += 1) {
      player = stepPlayer(player, IDLE_PLAYER_COMMAND, integratingWorld(), STEP_SECONDS)
      expect(distance(playerWireOrigin(player.position), anchor)).toBeLessThanOrEqual(6 + 1e-8)
      expect(player.wire).not.toBeNull()
    }
  })

  it('무입력 10초 swing은 projection 수치 감쇠로 기계 에너지를 잃지 않는다', () => {
    const anchor = { x: 0, y: 8, z: 0 }
    let player = createPlayerState({
      position: { x: 6, y: 7.4, z: 0 },
      velocity: { x: 0, y: 0, z: 8 },
      grounded: false,
      wire: { anchor, ropeLength: 6 },
    })
    const initialEnergy = mechanicalEnergy(player)

    for (let tick = 0; tick < 600; tick += 1) {
      player = stepPlayer(player, IDLE_PLAYER_COMMAND, integratingWorld(), STEP_SECONDS)
    }

    expect(player.wire).not.toBeNull()
    expect(Math.abs(mechanicalEnergy(player) - initialEnergy)).toBeLessThan(initialEnergy * 0.05)
  })

  it('release는 수평 운동량을 보존해 상향 포물선으로 anchor 위를 지난 뒤 하강한다', () => {
    const anchor = { x: 0, y: 3, z: 0 }
    let player = stepPlayer(
      createPlayerState({
        position: { x: 0, y: 0.9, z: 0 },
        velocity: { x: 8, y: 0, z: 2 },
        grounded: false,
        wire: { anchor, ropeLength: 1.5 },
      }),
      { ...IDLE_PLAYER_COMMAND, wireEdges: ['release'] },
      integratingWorld(),
      STEP_SECONDS,
    )
    expect(player.wire).toBeNull()
    expect(player.velocity.x).toBeGreaterThan(0)
    expect(player.velocity.z).toBeGreaterThan(0)
    expect(player.velocity.y).toBeCloseTo(WIRE_RELEASE_UP_SPEED - 24 / 60, 8)

    let maximumOriginY = playerWireOrigin(player.position).y
    let descended = false
    for (let tick = 0; tick < 90; tick += 1) {
      player = stepPlayer(player, IDLE_PLAYER_COMMAND, integratingWorld(), STEP_SECONDS)
      maximumOriginY = Math.max(maximumOriginY, playerWireOrigin(player.position).y)
      descended ||= player.velocity.y < 0
      expect(player.wire).toBeNull()
    }
    expect(maximumOriginY).toBeGreaterThan(anchor.y)
    expect(descended).toBe(true)
  })

  it('release는 더 큰 양의 y를 낮추지 않고 총속도 30을 넘지 않는다', () => {
    const released = stepPlayer(
      createPlayerState({
        velocity: { x: 20, y: 15, z: 10 },
        grounded: false,
        wire: { anchor: { x: 0, y: 10, z: 0 }, ropeLength: 8.5 },
      }),
      { ...IDLE_PLAYER_COMMAND, wireEdges: ['release'] },
      integratingWorld(),
      STEP_SECONDS,
    )

    expect(released.velocity.x).toBeCloseTo(20, 10)
    expect(released.velocity.y).toBeCloseTo(15 + (-24 * STEP_SECONDS), 10)
    expect(released.velocity.z).toBeCloseTo(10, 10)
    expect(lengthVec3(released.velocity)).toBeLessThanOrEqual(MAX_WIRE_RELEASE_SPEED)
  })
})

interface IntegratingWorldOptions {
  grounded?: boolean
  blocked?: boolean
  zeroVelocity?: boolean
  maximumPlayerX?: number
  contacts?: readonly CollisionContact[]
}

function integratingWorld(options: IntegratingWorldOptions = {}): CollisionWorld {
  return {
    raycast: () => null,
    moveAabb(position, velocity, _halfSize, stepSeconds) {
      const nextPosition = {
        x: position.x + velocity.x * stepSeconds,
        y: position.y + velocity.y * stepSeconds,
        z: position.z + velocity.z * stepSeconds,
      }
      let blocked = options.blocked ?? false
      if (options.maximumPlayerX !== undefined && nextPosition.x > options.maximumPlayerX) {
        nextPosition.x = options.maximumPlayerX
        blocked = true
      }
      return {
        position: nextPosition,
        velocity: options.zeroVelocity ? { x: 0, y: 0, z: 0 } : { ...velocity },
        grounded: options.grounded ?? false,
        blocked,
        contacts: options.contacts ?? [],
      }
    },
  }
}

function queryWorld(hit: CollisionRayHit | null, ranges?: number[]): CollisionWorld {
  const world = integratingWorld()
  return {
    ...world,
    raycast(_origin: Vec3, _direction: Vec3, maximumDistance: number) {
      ranges?.push(maximumDistance)
      return hit
    },
  }
}

function collider(
  center: Vec3,
  halfSize: Vec3,
  wireable = true,
): StaticCollider {
  return { center, halfSize, wireable }
}

function pressWire(world: CollisionWorld, wireAimDirection: Vec3): PlayerState {
  return stepPlayer(
    createPlayerState(),
    { ...IDLE_PLAYER_COMMAND, wireAimDirection, wireEdges: ['press'] },
    world,
    STEP_SECONDS,
  )
}

function distance(first: Vec3, second: Vec3): number {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z)
}

function normalizeFrom(origin: Vec3, target: Vec3): Vec3 {
  const length = distance(origin, target)
  return {
    x: (target.x - origin.x) / length,
    y: (target.y - origin.y) / length,
    z: (target.z - origin.z) / length,
  }
}

function dot(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

function mechanicalEnergy(player: PlayerState): number {
  return 0.5 * lengthVec3(player.velocity) ** 2 + 24 * playerWireOrigin(player.position).y
}
