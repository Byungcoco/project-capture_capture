import type { PlayerCommand } from './commands'
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
const WIRE_ORIGIN_HEIGHT = 0.6
const EPSILON = 1e-8

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
  world: CollisionWorld,
  stepSeconds: number,
): PlayerState {
  const player = structuredClone(state)
  const wasGrounded = player.grounded
  let releasedWire = false

  for (const edge of command.wireEdges) {
    if (edge === 'release') {
      if (player.wire !== null) {
        player.wire = null
        player.velocity = clampVec3Length(player.velocity, MAX_WIRE_RELEASE_SPEED)
        releasedWire = true
      }
      continue
    }
    if (player.wire === null) {
      const hit = world.raycast(
        playerWireOrigin(player.position),
        command.wireAimDirection,
        WIRE_RANGE,
      )
      if (hit !== null && hit.distance <= WIRE_RANGE && hit.wireable) {
        player.wire = { anchor: hit.point, ticksRemaining: WIRE_TICKS }
      }
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

  const pullDirection = player.wire === null
    ? null
    : normalizeVec3({
        x: player.wire.anchor.x - playerWireOrigin(player.position).x,
        y: player.wire.anchor.y - playerWireOrigin(player.position).y,
        z: player.wire.anchor.z - playerWireOrigin(player.position).z,
      })
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
  if (
    player.wire !== null
    && pullDirection !== null
    && collision.contacts.some((contact) => (
      pullDirection[contact.axis] * contact.normal < -EPSILON
    ))
  ) {
    player.wire = null
  }
  if (releasedWire) {
    player.velocity = clampVec3Length(player.velocity, MAX_WIRE_RELEASE_SPEED)
  }
  return player
}

export function playerWireOrigin(position: Vec3): Vec3 {
  return { x: position.x, y: position.y + WIRE_ORIGIN_HEIGHT, z: position.z }
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
    const direction = dashWorldDirection(command)
    player.velocity.x = direction.x * DASH_SPEED
    player.velocity.z = direction.z * DASH_SPEED
    player.dashTicksRemaining = DASH_TICKS
    player.dashAvailable = false
  }
  if (player.dashTicksRemaining > 0) {
    player.dashTicksRemaining -= 1
    return jumped
  }

  const input = movementWorldDirection(command)
  const target = { x: input.x * MOVE_SPEED, z: input.z * MOVE_SPEED }
  const acceleration = player.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION
  const next = approachHorizontal(
    { x: player.velocity.x, z: player.velocity.z },
    target,
    acceleration * stepSeconds,
  )
  player.velocity.x = next.x
  player.velocity.z = next.z
  return jumped
}

function stepWire(player: PlayerState, command: PlayerCommand, stepSeconds: number): void {
  const wire = player.wire
  if (wire === null) return
  const origin = playerWireOrigin(player.position)
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

  const pull = normalizeVec3(offset)
  const steering = movementWorldDirection(command)
  const target = {
    x: pull.x * WIRE_TARGET_SPEED + steering.x * MOVE_SPEED * WIRE_STEERING_SCALE,
    y: pull.y * WIRE_TARGET_SPEED,
    z: pull.z * WIRE_TARGET_SPEED + steering.z * MOVE_SPEED * WIRE_STEERING_SCALE,
  }
  player.velocity = approachVec3(player.velocity, target, WIRE_ACCELERATION * stepSeconds)
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
  return cameraBasis(command.cameraForward).forward
}

function movementWorldDirection(command: PlayerCommand): Vec3 {
  const basis = cameraBasis(command.cameraForward)
  return normalizeVec3({
    x: basis.right.x * command.moveX + basis.forward.x * command.moveZ,
    y: 0,
    z: basis.right.z * command.moveX + basis.forward.z * command.moveZ,
  })
}

function cameraBasis(cameraForward: Vec3): { forward: Vec3; right: Vec3 } {
  const length = Math.hypot(cameraForward.x, cameraForward.z)
  const forward = length <= EPSILON
    ? { x: 0, y: 0, z: -1 }
    : { x: cameraForward.x / length, y: 0, z: cameraForward.z / length }
  return { forward, right: { x: -forward.z, y: 0, z: forward.x } }
}

function approachHorizontal(
  value: { x: number; z: number },
  target: { x: number; z: number },
  maximumChange: number,
): { x: number; z: number } {
  const deltaX = target.x - value.x
  const deltaZ = target.z - value.z
  const length = Math.hypot(deltaX, deltaZ)
  if (length <= maximumChange || length === 0) return target
  const scale = maximumChange / length
  return { x: value.x + deltaX * scale, z: value.z + deltaZ * scale }
}

function approachVec3(value: Vec3, target: Vec3, maximumChange: number): Vec3 {
  const delta = { x: target.x - value.x, y: target.y - value.y, z: target.z - value.z }
  const length = lengthVec3(delta)
  if (length <= maximumChange || length === 0) return target
  const scale = maximumChange / length
  return {
    x: value.x + delta.x * scale,
    y: value.y + delta.y * scale,
    z: value.z + delta.z * scale,
  }
}
