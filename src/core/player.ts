import type { Collider, Vec2 } from './types'
import {
  PLAYER_AIR_ACCELERATION,
  PLAYER_AIR_DECELERATION,
  PLAYER_GRAVITY,
  PLAYER_GROUND_ACCELERATION,
  PLAYER_GROUND_DECELERATION,
  PLAYER_HALF_SIZE,
  PLAYER_JUMP_SPEED,
  PLAYER_MAX_FALL_SPEED,
  PLAYER_MAX_SPEED,
} from './constants'
import { resolvePlayerMotion } from './collision'

export interface PlayerInput {
  moveX: -1 | 0 | 1
  jumpPressed: boolean
}

export interface PlayerState {
  position: Vec2
  velocity: Vec2
  grounded: boolean
}

export function stepPlayer(
  state: PlayerState,
  input: PlayerInput,
  colliders: readonly Collider[],
  stepSeconds: number,
): PlayerState {
  let velocityX = state.velocity.x

  if (input.moveX === 0) {
    const deceleration = state.grounded
      ? PLAYER_GROUND_DECELERATION
      : PLAYER_AIR_DECELERATION
    velocityX = approach(
      velocityX,
      0,
      deceleration * stepSeconds,
    )
  } else {
    const acceleration = state.grounded
      ? PLAYER_GROUND_ACCELERATION
      : PLAYER_AIR_ACCELERATION
    velocityX = clamp(
      velocityX + input.moveX * acceleration * stepSeconds,
      -PLAYER_MAX_SPEED,
      PLAYER_MAX_SPEED,
    )
  }

  let velocityY = state.velocity.y
  if (input.jumpPressed && state.grounded) {
    velocityY = PLAYER_JUMP_SPEED
  }
  velocityY = Math.max(
    velocityY + PLAYER_GRAVITY * stepSeconds,
    PLAYER_MAX_FALL_SPEED,
  )

  return resolvePlayerMotion(
    state.position,
    { x: velocityX, y: velocityY },
    PLAYER_HALF_SIZE,
    colliders,
    stepSeconds,
  )
}

function approach(value: number, target: number, amount: number): number {
  if (value < target) return Math.min(value + amount, target)
  if (value > target) return Math.max(value - amount, target)
  return target
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
