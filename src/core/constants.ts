export const TICK_RATE = 60
export const TICK_SECONDS = 1 / TICK_RATE
export const MAX_STEPS_PER_FRAME = 5
export const CAMERA_AIM_SPEED_DEGREES = 90

export const PLAYER_HALF_SIZE = { x: 0.4, y: 0.65 } as const
export const PLAYER_MAX_SPEED = 6
export const PLAYER_GROUND_ACCELERATION = 36
export const PLAYER_AIR_ACCELERATION =
  PLAYER_GROUND_ACCELERATION * 0.4
export const PLAYER_AIR_DECELERATION = 8
export const PLAYER_GROUND_DECELERATION = 36
export const PLAYER_GRAVITY = -24
export const PLAYER_JUMP_SPEED = 11
export const PLAYER_MAX_FALL_SPEED = -18
