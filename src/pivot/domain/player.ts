import type { PlayerCommand } from './commands'
import { createAabbCollisionWorld } from './aabb-collision-world'
import type { CollisionWorld } from './collision-world'
import { clampVec3Length, lengthVec3, normalizeVec3 } from './math'
import type { Aabb3, Vec3 } from './math'

export const PLAYER_HALF_SIZE: Readonly<Vec3> = { x: 0.4, y: 0.9, z: 0.4 }
export const JUMP_SPEED = 10
export const MAX_WIRE_RELEASE_SPEED = 30
export const GRAVITY = -24
export const MAX_FALL_SPEED = -30
export const MOVE_SPEED = 8
export const GROUND_ACCELERATION = 40
export const AIR_ACCELERATION = 16
export const DASH_SPEED = 18
export const DASH_TICKS = 9
export const WIRE_RANGE = 30
export const WIRE_TARGET_SPEED = 24
export const WIRE_TICKS = 48
export const WIRE_ARRIVAL_RADIUS = 1
export const WIRE_GRAVITY_SCALE = 0.35
export const WIRE_STEERING_SCALE = 0.3

const WIRE_ACCELERATION = 72
const EPSILON = 1e-8
const WIRE_ORIGIN_HEIGHT = 0.6

export interface StaticCollider extends Aabb3 {
  wireable: boolean
}

export interface WirePullState {
  anchor: Vec3
  ticksRemaining: number
}

export interface PlayerState {
  position: Vec3
  velocity: Vec3
  halfSize: Vec3
  grounded: boolean
  airJumpsRemaining: number
  dashAvailable: boolean
  dashTicksRemaining: number
  wire: WirePullState | null
}

export function createPlayerState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    position: { x: 0, y: PLAYER_HALF_SIZE.y, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    halfSize: { ...PLAYER_HALF_SIZE },
    grounded: true,
    airJumpsRemaining: 1,
    dashAvailable: true,
    dashTicksRemaining: 0,
    wire: null,
    ...overrides,
  }
}

export function stepPlayer(
  state: PlayerState,
  command: PlayerCommand,
  worldValue: readonly StaticCollider[] | CollisionWorld,
  stepSeconds: number,
): PlayerState {
  const world = Array.isArray(worldValue)
    ? createAabbCollisionWorld(worldValue)
    : worldValue as CollisionWorld
  const player = structuredClone(state)
  const wasGrounded = player.grounded
  let releasedWire = false

  if (command.wireReleased && player.wire !== null) {
    player.wire = null
    player.velocity = clampVec3Length(player.velocity, MAX_WIRE_RELEASE_SPEED)
    releasedWire = true
  }

  if (command.wirePressed && player.wire === null) {
    const hit = world.raycast(wireOrigin(player.position), command.aimDirection, WIRE_RANGE)
    if (hit !== null && hit.wireable) {
      player.wire = { anchor: hit.point, ticksRemaining: WIRE_TICKS }
    }
  }

  const wireActiveAtStart = player.wire !== null
  let jumpedThisTick = false
  if (player.wire !== null) {
    stepWire(player, command, stepSeconds)
  } else {
    jumpedThisTick = stepMovement(player, command, stepSeconds)
  }

  if (!jumpedThisTick) {
    player.velocity.y = Math.max(
      MAX_FALL_SPEED,
      player.velocity.y + GRAVITY * stepSeconds * (wireActiveAtStart ? WIRE_GRAVITY_SCALE : 1),
    )
  }

  const collision = world.moveAabb(
    player.position,
    player.velocity,
    player.halfSize,
    stepSeconds,
  )
  player.position = collision.position
  player.velocity = collision.velocity
  player.grounded = collision.grounded
  if (!wasGrounded && collision.grounded) {
    player.airJumpsRemaining = 1
    player.dashAvailable = true
    player.dashTicksRemaining = 0
  }
  if (player.wire !== null && collision.blockedHorizontally) {
    player.wire = null
  }
  if (releasedWire) {
    player.velocity = clampVec3Length(player.velocity, MAX_WIRE_RELEASE_SPEED)
  }
  return player
}

function stepMovement(player: PlayerState, command: PlayerCommand, stepSeconds: number): boolean {
  let jumped = false
  if (command.jumpPressed) {
    if (player.grounded) {
      player.velocity.y = JUMP_SPEED
      player.grounded = false
      jumped = true
    } else if (player.airJumpsRemaining > 0) {
      player.velocity.y = JUMP_SPEED
      player.airJumpsRemaining -= 1
      jumped = true
    }
  }

  if (command.dashPressed && player.dashAvailable) {
    const dashDirection = dashWorldDirection(command)
    player.velocity.x = dashDirection.x * DASH_SPEED
    player.velocity.z = dashDirection.z * DASH_SPEED
    player.dashTicksRemaining = DASH_TICKS
    player.dashAvailable = false
  }

  if (player.dashTicksRemaining > 0) {
    player.dashTicksRemaining -= 1
    return jumped
  }

  const input = movementWorldDirection(command)
  const acceleration = player.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION
  player.velocity.x = approach(player.velocity.x, input.x * MOVE_SPEED, acceleration * stepSeconds)
  player.velocity.z = approach(player.velocity.z, input.z * MOVE_SPEED, acceleration * stepSeconds)
  return jumped
}

function stepWire(player: PlayerState, command: PlayerCommand, stepSeconds: number): void {
  const wire = player.wire
  if (wire === null) return
  const origin = wireOrigin(player.position)
  const offset = {
    x: wire.anchor.x - origin.x,
    y: wire.anchor.y - origin.y,
    z: wire.anchor.z - origin.z,
  }
  if (lengthVec3(offset) <= WIRE_ARRIVAL_RADIUS || wire.ticksRemaining <= 0) {
    player.wire = null
    player.velocity = clampVec3Length(player.velocity, MAX_WIRE_RELEASE_SPEED)
    return
  }

  const pullDirection = normalizeVec3(offset)
  const steering = movementWorldDirection(command)
  const target = {
    x: pullDirection.x * WIRE_TARGET_SPEED + steering.x * MOVE_SPEED * WIRE_STEERING_SCALE,
    y: pullDirection.y * WIRE_TARGET_SPEED,
    z: pullDirection.z * WIRE_TARGET_SPEED + steering.z * MOVE_SPEED * WIRE_STEERING_SCALE,
  }
  const maximumChange = WIRE_ACCELERATION * stepSeconds
  player.velocity.x = approach(player.velocity.x, target.x, maximumChange)
  player.velocity.y = approach(player.velocity.y, target.y, maximumChange)
  player.velocity.z = approach(player.velocity.z, target.z, maximumChange)
  wire.ticksRemaining -= 1
  if (wire.ticksRemaining <= 0) {
    player.wire = null
    player.velocity = clampVec3Length(player.velocity, MAX_WIRE_RELEASE_SPEED)
  }
}

function dashWorldDirection(command: PlayerCommand): Vec3 {
  if (Math.hypot(command.moveX, command.moveZ) > EPSILON) {
    return movementWorldDirection(command)
  }
  return cameraBasis(command.aimDirection).forward
}

function movementWorldDirection(command: PlayerCommand): Vec3 {
  const basis = cameraBasis(command.aimDirection)
  const world = {
    x: basis.right.x * command.moveX + basis.forward.x * command.moveZ,
    y: 0,
    z: basis.right.z * command.moveX + basis.forward.z * command.moveZ,
  }
  return normalizeVec3(world)
}

function cameraBasis(aimDirection: Vec3): { forward: Vec3; right: Vec3 } {
  const projectedLength = Math.hypot(aimDirection.x, aimDirection.z)
  const forward = projectedLength <= EPSILON
    ? { x: 0, y: 0, z: -1 }
    : { x: aimDirection.x / projectedLength, y: 0, z: aimDirection.z / projectedLength }
  return {
    forward,
    right: { x: -forward.z, y: 0, z: forward.x },
  }
}

function wireOrigin(position: Vec3): Vec3 {
  return { x: position.x, y: position.y + WIRE_ORIGIN_HEIGHT, z: position.z }
}

function approach(value: number, target: number, maximumChange: number): number {
  if (value < target) return Math.min(value + maximumChange, target)
  return Math.max(value - maximumChange, target)
}
