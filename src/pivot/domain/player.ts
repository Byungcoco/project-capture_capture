import type { PlayerCommand } from './commands'
import type { CollisionWorld } from './collision-world'
import { clampVec3Length, lengthVec3, normalizeVec3 } from './math'
import type { Aabb3, Vec3 } from './math'

export const PLAYER_HALF_SIZE: Readonly<Vec3> = { x: 0.4, y: 0.9, z: 0.4 }
export const JUMP_SPEED = 10
export const MAX_WIRE_RELEASE_SPEED = 30
export const WIRE_RELEASE_UP_SPEED = 11
export const WIRE_SWING_STEERING_ACCELERATION = 12
export const GRAVITY = -24
export const MAX_FALL_SPEED = -30
export const MOVE_SPEED = 8
export const GROUND_ACCELERATION = 40
export const AIR_ACCELERATION = 16
export const DASH_SPEED = 18
export const DASH_TICKS = 9
export const WIRE_RANGE = 30
const WIRE_ORIGIN_HEIGHT = 0.6
const EPSILON = 1e-8

export interface StaticCollider extends Aabb3 {
  wireable: boolean
}

export interface WirePullState {
  anchor: Vec3
  ropeLength: number
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
        player.velocity.y = Math.max(player.velocity.y, WIRE_RELEASE_UP_SPEED)
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
        player.wire = {
          anchor: hit.point,
          ropeLength: lengthVec3({
            x: hit.point.x - playerWireOrigin(player.position).x,
            y: hit.point.y - playerWireOrigin(player.position).y,
            z: hit.point.z - playerWireOrigin(player.position).z,
          }),
        }
      }
    }
  }

  let jumpedThisTick = false
  if (player.wire !== null) {
    stepWire(player, command, stepSeconds)
  } else {
    jumpedThisTick = stepMovement(player, command, stepSeconds)
  }

  if (!jumpedThisTick && player.wire === null) {
    player.velocity.y = Math.max(MAX_FALL_SPEED, player.velocity.y + GRAVITY * stepSeconds)
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
  if (player.wire !== null) constrainWire(player)
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
  const outward = {
    x: origin.x - wire.anchor.x,
    y: origin.y - wire.anchor.y,
    z: origin.z - wire.anchor.z,
  }
  const distance = lengthVec3(outward)
  const radial = normalizeVec3(outward)
  const taut = distance >= wire.ropeLength - EPSILON
  const gravity = { x: 0, y: GRAVITY, z: 0 }
  const steering = movementWorldDirection(command)
  const gravityAcceleration = taut ? projectTangent(gravity, radial) : gravity
  const steeringAcceleration = projectTangent({
    x: steering.x * WIRE_SWING_STEERING_ACCELERATION,
    y: 0,
    z: steering.z * WIRE_SWING_STEERING_ACCELERATION,
  }, radial)
  player.velocity = {
    x: player.velocity.x + (gravityAcceleration.x + steeringAcceleration.x) * stepSeconds,
    y: player.velocity.y + (gravityAcceleration.y + steeringAcceleration.y) * stepSeconds,
    z: player.velocity.z + (gravityAcceleration.z + steeringAcceleration.z) * stepSeconds,
  }
  if (taut) {
    player.velocity = removeOutwardRadialVelocity(player.velocity, radial)
  }
}

function constrainWire(player: PlayerState): void {
  const wire = player.wire
  if (wire === null) return
  const origin = playerWireOrigin(player.position)
  const outward = {
    x: origin.x - wire.anchor.x,
    y: origin.y - wire.anchor.y,
    z: origin.z - wire.anchor.z,
  }
  const distance = lengthVec3(outward)
  if (distance <= wire.ropeLength || distance <= EPSILON) return
  const radial = normalizeVec3(outward)
  const constrainedOrigin = {
    x: wire.anchor.x + radial.x * wire.ropeLength,
    y: wire.anchor.y + radial.y * wire.ropeLength,
    z: wire.anchor.z + radial.z * wire.ropeLength,
  }
  player.position = {
    x: player.position.x + constrainedOrigin.x - origin.x,
    y: player.position.y + constrainedOrigin.y - origin.y,
    z: player.position.z + constrainedOrigin.z - origin.z,
  }
  player.velocity = removeOutwardRadialVelocity(player.velocity, radial)
}

function projectTangent(value: Vec3, radial: Vec3): Vec3 {
  const radialMagnitude = dotVec3(value, radial)
  return {
    x: value.x - radial.x * radialMagnitude,
    y: value.y - radial.y * radialMagnitude,
    z: value.z - radial.z * radialMagnitude,
  }
}

function removeOutwardRadialVelocity(velocity: Vec3, radial: Vec3): Vec3 {
  const radialSpeed = dotVec3(velocity, radial)
  if (radialSpeed <= 0) return velocity
  return {
    x: velocity.x - radial.x * radialSpeed,
    y: velocity.y - radial.y * radialSpeed,
    z: velocity.z - radial.z * radialSpeed,
  }
}

function dotVec3(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
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
