import { describe, expect, it } from 'vitest'

import { IDLE_PLAYER_COMMAND } from './commands'
import type { CollisionWorld } from './collision-world'
import { JUMP_SPEED, createPlayerState, stepPlayer } from './player'
import type { PlayerState, StaticCollider } from './player'
import { playerAabbRight, speedOf } from './session'

const STEP_SECONDS = 1 / 60
const GROUND: StaticCollider = {
  center: { x: 0, y: -0.5, z: 0 },
  halfSize: { x: 20, y: 0.5, z: 20 },
  wireable: false,
}

describe('피벗 플레이어', () => {
  it('공중에서는 두 번째 점프까지만 허용한다', () => {
    const firstJump = stepPlayer(
      createPlayerState(),
      { ...IDLE_PLAYER_COMMAND, jumpPressed: true },
      [GROUND],
      STEP_SECONDS,
    )
    const secondJump = stepPlayer(
      firstJump,
      { ...IDLE_PLAYER_COMMAND, jumpPressed: true },
      [GROUND],
      STEP_SECONDS,
    )
    const thirdJump = stepPlayer(
      secondJump,
      { ...IDLE_PLAYER_COMMAND, jumpPressed: true },
      [GROUND],
      STEP_SECONDS,
    )

    expect(firstJump.velocity.y).toBeGreaterThan(0)
    expect(secondJump.velocity.y).toBe(JUMP_SPEED)
    expect(thirdJump.velocity.y).toBeLessThan(JUMP_SPEED)
  })

  it('착지하면 공중 점프와 대시가 회복된다', () => {
    const exhausted: PlayerState = createPlayerState({
      position: { x: 0, y: 0.85, z: 0 },
      velocity: { x: 0, y: -2, z: 0 },
      grounded: false,
      airJumpsRemaining: 0,
      dashAvailable: false,
    })

    const landed = stepPlayer(exhausted, IDLE_PLAYER_COMMAND, [GROUND], STEP_SECONDS)

    expect(landed.grounded).toBe(true)
    expect(landed.airJumpsRemaining).toBe(1)
    expect(landed.dashAvailable).toBe(true)
  })

  it('대시는 벽을 통과하지 않는다', () => {
    const wall: StaticCollider = {
      center: { x: 2.5, y: 1, z: 0 },
      halfSize: { x: 0.5, y: 2, z: 3 },
      wireable: false,
    }
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
        [GROUND, wall],
        STEP_SECONDS,
      )
    }

    expect(playerAabbRight(player)).toBeLessThanOrEqual(2)
  })

  it('와이어 사거리 밖과 차폐된 표면은 거부한다', () => {
    const farAnchor: StaticCollider = {
      center: { x: 31.5, y: 0.9, z: 0 },
      halfSize: { x: 0.5, y: 0.5, z: 0.5 },
      wireable: true,
    }
    const wall: StaticCollider = {
      center: { x: 8, y: 0.9, z: 0 },
      halfSize: { x: 0.5, y: 2, z: 2 },
      wireable: false,
    }
    const hiddenAnchor: StaticCollider = {
      center: { x: 16, y: 0.9, z: 0 },
      halfSize: { x: 0.5, y: 0.5, z: 0.5 },
      wireable: true,
    }
    const wireCommand = {
      ...IDLE_PLAYER_COMMAND,
      aimDirection: { x: 1, y: 0, z: 0 },
      wirePressed: true,
    }

    const outOfRange = stepPlayer(
      createPlayerState(),
      wireCommand,
      [farAnchor],
      STEP_SECONDS,
    )
    const occluded = stepPlayer(
      createPlayerState(),
      wireCommand,
      [wall, hiddenAnchor],
      STEP_SECONDS,
    )

    expect(outOfRange.wire).toBeNull()
    expect(occluded.wire).toBeNull()
  })

  it('와이어 해제 후 속도를 보존한다', () => {
    const anchor: StaticCollider = {
      center: { x: 12, y: 4, z: 0 },
      halfSize: { x: 0.5, y: 0.5, z: 0.5 },
      wireable: true,
    }
    const aim = { x: 12, y: 3.1, z: 0 }
    const pulling = stepPlayer(
      createPlayerState(),
      {
        ...IDLE_PLAYER_COMMAND,
        aimDirection: aim,
        wirePressed: true,
      },
      [GROUND, anchor],
      STEP_SECONDS,
    )
    const released = stepPlayer(
      pulling,
      { ...IDLE_PLAYER_COMMAND, wireReleased: true },
      [GROUND, anchor],
      STEP_SECONDS,
    )

    expect(released.wire).toBeNull()
    expect(speedOf(released.velocity)).toBeGreaterThan(0)
    expect(speedOf(released.velocity)).toBeLessThanOrEqual(30)
  })

  it('카메라 yaw 기준으로 로컬 전진을 월드 이동으로 바꾼다', () => {
    let player = createPlayerState()
    for (let tick = 0; tick < 60; tick += 1) {
      player = stepPlayer(
        player,
        {
          ...IDLE_PLAYER_COMMAND,
          moveZ: 1,
          aimDirection: { x: 1, y: 0, z: 0 },
        },
        [GROUND],
        STEP_SECONDS,
      )
    }

    expect(player.position.x).toBeGreaterThan(5)
    expect(Math.abs(player.position.z)).toBeLessThan(0.01)
  })

  it('대각선 이동도 초속 8미터 상한을 지킨다', () => {
    let player = createPlayerState()
    for (let tick = 0; tick < 60; tick += 1) {
      player = stepPlayer(
        player,
        { ...IDLE_PLAYER_COMMAND, moveX: 1, moveZ: 1 },
        [GROUND],
        STEP_SECONDS,
      )
    }

    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z)
    expect(horizontalSpeed).toBeGreaterThan(7.5)
    expect(horizontalSpeed).toBeLessThanOrEqual(8)
  })

  it('중력은 초당 마이너스 24이고 낙하 속도는 마이너스 30으로 제한한다', () => {
    let player = createPlayerState({
      position: { x: 0, y: 1000, z: 0 },
      grounded: false,
    })
    player = stepPlayer(player, IDLE_PLAYER_COMMAND, [], STEP_SECONDS)
    expect(player.velocity.y).toBeCloseTo(-0.4, 8)

    for (let tick = 0; tick < 300; tick += 1) {
      player = stepPlayer(player, IDLE_PLAYER_COMMAND, [], STEP_SECONDS)
    }
    expect(player.velocity.y).toBe(-30)
  })

  it('대시는 9틱 뒤 끝나고 착지 전 재입력으로 충전되지 않는다', () => {
    let player = createPlayerState()
    for (let tick = 0; tick < 9; tick += 1) {
      player = stepPlayer(
        player,
        {
          ...IDLE_PLAYER_COMMAND,
          moveZ: 1,
          aimDirection: { x: 1, y: 0, z: 0 },
          dashPressed: tick === 0 || tick === 4,
        },
        [GROUND],
        STEP_SECONDS,
      )
    }
    const afterDashX = player.position.x
    player = stepPlayer(
      player,
      {
        ...IDLE_PLAYER_COMMAND,
        moveZ: 1,
        aimDirection: { x: 1, y: 0, z: 0 },
        dashPressed: true,
      },
      [GROUND],
      STEP_SECONDS,
    )

    expect(afterDashX).toBeCloseTo(2.7, 8)
    expect(player.dashAvailable).toBe(false)
    expect(player.velocity.x).toBeLessThan(18)
  })

  it('와이어는 48틱에 만료하고 1미터 도착 반경에서 끝난다', () => {
    const anchor: StaticCollider = {
      center: { x: 20, y: 8, z: 0 },
      halfSize: { x: 0.5, y: 0.5, z: 0.5 },
      wireable: true,
    }
    const aimDirection = { x: 20, y: 7.1, z: 0 }
    let player = stepPlayer(
      createPlayerState(),
      { ...IDLE_PLAYER_COMMAND, aimDirection, wirePressed: true },
      [anchor],
      STEP_SECONDS,
    )
    expect(player.wire).not.toBeNull()
    for (let tick = 1; tick < 48; tick += 1) {
      player = stepPlayer(player, { ...IDLE_PLAYER_COMMAND, aimDirection }, [], STEP_SECONDS)
    }
    expect(player.wire).toBeNull()

    const nearAnchor: StaticCollider = {
      center: { x: 1.4, y: 1.5, z: 0 },
      halfSize: { x: 0.5, y: 0.5, z: 0.5 },
      wireable: true,
    }
    const arrived = stepPlayer(
      createPlayerState(),
      {
        ...IDLE_PLAYER_COMMAND,
        aimDirection: { x: 1, y: 0.6, z: 0 },
        wirePressed: true,
      },
      [nearAnchor],
      STEP_SECONDS,
    )
    expect(arrived.wire).toBeNull()
  })

  it('와이어 이동은 CollisionWorld 충돌에서 끝난다', () => {
    const blockingWorld: CollisionWorld = {
      raycast: () => ({
        point: { x: 10, y: 4, z: 0 },
        distance: 10,
        wireable: true,
      }),
      moveAabb: (position, velocity) => ({
        position,
        velocity: { x: 0, y: velocity.y, z: velocity.z },
        grounded: false,
        blockedHorizontally: true,
      }),
    }
    const player = stepPlayer(
      createPlayerState(),
      {
        ...IDLE_PLAYER_COMMAND,
        aimDirection: { x: 1, y: 0.3, z: 0 },
        wirePressed: true,
      },
      blockingWorld,
      STEP_SECONDS,
    )

    expect(player.wire).toBeNull()
    expect(speedOf(player.velocity)).toBeGreaterThan(0)
  })

  it('와이어 당김 중 카메라 로컬 횡조향을 적용한다', () => {
    const openWorld: CollisionWorld = {
      raycast: () => ({
        point: { x: 12, y: 4, z: 0 },
        distance: 12,
        wireable: true,
      }),
      moveAabb: (position, velocity, _halfSize, stepSeconds) => ({
        position: {
          x: position.x + velocity.x * stepSeconds,
          y: position.y + velocity.y * stepSeconds,
          z: position.z + velocity.z * stepSeconds,
        },
        velocity,
        grounded: false,
        blockedHorizontally: false,
      }),
    }
    const neutral = stepPlayer(
      createPlayerState(),
      {
        ...IDLE_PLAYER_COMMAND,
        aimDirection: { x: 1, y: 0.3, z: 0 },
        wirePressed: true,
      },
      openWorld,
      STEP_SECONDS,
    )
    const steered = stepPlayer(
      createPlayerState(),
      {
        ...IDLE_PLAYER_COMMAND,
        moveX: 1,
        aimDirection: { x: 1, y: 0.3, z: 0 },
        wirePressed: true,
      },
      openWorld,
      STEP_SECONDS,
    )

    expect(steered.velocity.z).toBeGreaterThan(neutral.velocity.z)
  })
})
