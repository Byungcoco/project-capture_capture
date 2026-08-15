import { describe, expect, it } from 'vitest'

import { IDLE_PLAYER_COMMAND } from './commands'
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
          moveX: 1,
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
})
