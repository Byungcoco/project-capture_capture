import { describe, expect, it } from 'vitest'

import { IDLE_PLAYER_COMMAND } from './commands'
import type { CollisionRayHit, CollisionWorld } from './collision-world'
import {
  JUMP_SPEED,
  MAX_WIRE_RELEASE_SPEED,
  createPlayerState,
  stepPlayer,
} from './player'
import type { PlayerState } from './player'
import { speedOf } from './session'
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
          aimDirection: { x: 1, y: 0, z: 0 },
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
      { ...IDLE_PLAYER_COMMAND, aimDirection: { x: 1, y: 0.2, z: 0 }, wirePressed: true },
      queryWorld(VALID_WIRE_HIT, queriedRanges),
      STEP_SECONDS,
    )
    const outOfRange = stepPlayer(
      createPlayerState(),
      { ...IDLE_PLAYER_COMMAND, aimDirection: { x: 1, y: 0, z: 0 }, wirePressed: true },
      queryWorld({ ...VALID_WIRE_HIT, distance: 30.01 }),
      STEP_SECONDS,
    )
    const occluded = stepPlayer(
      createPlayerState(),
      { ...IDLE_PLAYER_COMMAND, aimDirection: { x: 1, y: 0, z: 0 }, wirePressed: true },
      queryWorld({
        point: { x: 4, y: 1.5, z: 0 },
        distance: 4,
        wireable: false,
      }),
      STEP_SECONDS,
    )

    expect(valid.wire).not.toBeNull()
    expect(queriedRanges).toEqual([30])
    expect(outOfRange.wire).toBeNull()
    expect(occluded.wire).toBeNull()
  })

  it('와이어 해제 후 속도를 보존하되 초속 30으로 제한한다', () => {
    const released = stepPlayer(
      createPlayerState({
        grounded: false,
        velocity: { x: 40, y: 0, z: 0 },
        wire: { anchor: { x: 20, y: 4, z: 0 }, ticksRemaining: 30 },
      }),
      { ...IDLE_PLAYER_COMMAND, wireReleased: true },
      integratingWorld(),
      STEP_SECONDS,
    )

    expect(released.wire).toBeNull()
    expect(speedOf(released.velocity)).toBeGreaterThan(0)
    expect(speedOf(released.velocity)).toBeLessThanOrEqual(MAX_WIRE_RELEASE_SPEED)
  })

  it('카메라 yaw 기준 로컬 이동과 수직 조준 fallback을 월드 방향으로 바꾼다', () => {
    const yawed = stepPlayer(
      createPlayerState(),
      { ...IDLE_PLAYER_COMMAND, moveZ: 1, aimDirection: { x: 1, y: 0, z: 0 } },
      integratingWorld({ grounded: true }),
      STEP_SECONDS,
    )
    const verticalAim = stepPlayer(
      createPlayerState(),
      { ...IDLE_PLAYER_COMMAND, moveZ: 1, aimDirection: { x: 0, y: 1, z: 0 } },
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
        aimDirection: { x: 1, y: 0, z: 0 },
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
          aimDirection: { x: 1, y: 0, z: 0 },
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
        aimDirection: { x: 1, y: 0, z: 0 },
        dashPressed: true,
      },
      world,
      STEP_SECONDS,
    )
    expect(player.dashTicksRemaining).toBe(0)
    expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeLessThan(18)
  })

  it('wire press와 release가 같은 tick이면 release가 최종 우선한다', () => {
    const command = {
      ...IDLE_PLAYER_COMMAND,
      aimDirection: { x: 1, y: 0.2, z: 0 },
      wirePressed: true,
      wireReleased: true,
    }
    const newlyTapped = stepPlayer(
      createPlayerState(),
      command,
      queryWorld(VALID_WIRE_HIT),
      STEP_SECONDS,
    )
    const alreadyPulling = stepPlayer(
      createPlayerState({ wire: { anchor: VALID_WIRE_HIT.point, ticksRemaining: 20 } }),
      command,
      queryWorld(VALID_WIRE_HIT),
      STEP_SECONDS,
    )

    expect(newlyTapped.wire).toBeNull()
    expect(alreadyPulling.wire).toBeNull()
  })

  it('와이어는 47번째 tick까지 유지되고 정확히 48번째 tick에 끝난다', () => {
    let player = createPlayerState({
      grounded: false,
      wire: { anchor: { x: 100, y: 20, z: 0 }, ticksRemaining: 48 },
    })
    const world = integratingWorld()
    for (let tick = 0; tick < 47; tick += 1) {
      player = stepPlayer(player, IDLE_PLAYER_COMMAND, world, STEP_SECONDS)
    }
    expect(player.wire?.ticksRemaining).toBe(1)

    player = stepPlayer(player, IDLE_PLAYER_COMMAND, world, STEP_SECONDS)
    expect(player.wire).toBeNull()
  })

  it('와이어는 권위 origin에서 anchor가 1미터 이내면 끝난다', () => {
    const player = stepPlayer(
      createPlayerState({
        wire: { anchor: { x: 0.8, y: 1.5, z: 0 }, ticksRemaining: 30 },
      }),
      IDLE_PLAYER_COMMAND,
      integratingWorld(),
      STEP_SECONDS,
    )

    expect(player.wire).toBeNull()
  })

  it('와이어는 수평과 수직을 포함한 모든 이동 차단에서 끝난다', () => {
    const verticallyBlocked = integratingWorld({ blocked: true, zeroVelocity: true })
    const player = stepPlayer(
      createPlayerState({
        grounded: false,
        wire: { anchor: { x: 0, y: 20, z: 0 }, ticksRemaining: 30 },
      }),
      IDLE_PLAYER_COMMAND,
      verticallyBlocked,
      STEP_SECONDS,
    )

    expect(player.wire).toBeNull()
  })

  it('와이어 당김 중 카메라 로컬 횡조향을 적용한다', () => {
    const base = createPlayerState({
      grounded: false,
      wire: { anchor: { x: 12, y: 4, z: 0 }, ticksRemaining: 30 },
    })
    const world = integratingWorld()
    const neutral = stepPlayer(base, IDLE_PLAYER_COMMAND, world, STEP_SECONDS)
    const steered = stepPlayer(
      base,
      { ...IDLE_PLAYER_COMMAND, moveX: 1, aimDirection: { x: 1, y: 0, z: 0 } },
      world,
      STEP_SECONDS,
    )

    expect(steered.velocity.z).toBeGreaterThan(neutral.velocity.z)
  })
})

interface IntegratingWorldOptions {
  grounded?: boolean
  blocked?: boolean
  zeroVelocity?: boolean
  maximumPlayerX?: number
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
