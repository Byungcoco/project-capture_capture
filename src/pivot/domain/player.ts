import type { PlayerCommand } from './commands'
import type { CollisionWorld } from './collision-world'
import type { CollisionWireCandidate } from './collision-world'
import { clampVec3Length, lengthVec3, normalizeVec3 } from './math'
import type { Aabb3, Vec3 } from './math'

export const PLAYER_HALF_SIZE: Readonly<Vec3> = { x: 0.4, y: 0.9, z: 0.4 }
export const JUMP_SPEED = 10
export const MAX_WIRE_RELEASE_SPEED = 30
export const WIRE_RELEASE_UP_SPEED = 11
export const WIRE_SWING_STEERING_ACCELERATION = 12
export const WIRE_REEL_TAP_TICKS = 12
export const WIRE_REEL_FLIGHT_SPEED = 18
export const WIRE_REEL_MIN_FLIGHT_SECONDS = 0.35
export const WIRE_REEL_MAX_FLIGHT_SECONDS = 1.2
export const WIRE_REEL_LANDING_CLEARANCE = 0.3
export const WIRE_REEL_OVERSHOOT = 0.3
const WIRE_REEL_TOP_PROBE_HEIGHT = 3
export const GRAVITY = -24
export const MAX_FALL_SPEED = -30
export const MOVE_SPEED = 8
export const GROUND_ACCELERATION = 40
export const AIR_ACCELERATION = 16
export const DASH_SPEED = 18
export const DASH_TICKS = 9
export const WIRE_RANGE = 30
export const WIRE_AIM_ASSIST_ANGLE = 8
export const WIRE_OVERHEAD_HORIZONTAL_RANGE = 5
export const WIRE_OVERHEAD_RANGE = 12
export const WIRE_OVERHEAD_MIN_HEIGHT = 1
const WIRE_ORIGIN_HEIGHT = 0.6
const EPSILON = 1e-8
const WIRE_VISIBILITY_EPSILON = 1e-5
const WIRE_AIM_ASSIST_COSINE = Math.cos(WIRE_AIM_ASSIST_ANGLE * Math.PI / 180)

export interface StaticCollider extends Aabb3 {
  wireable: boolean
}

export interface WirePullState {
  anchor: Vec3
  ropeLength: number
  /** 부착 후 경과 tick. 생략하면 0으로 본다. 탭 회수와 홀드 진자를 가르는 유일한 기준이다. */
  heldTicks?: number
}

export interface PlayerState {
  position: Vec3
  velocity: Vec3
  halfSize: Vec3
  grounded: boolean
  airJumpsRemaining: number
  dashAvailable: boolean
  dashTicksRemaining: number
  /** 회수 비행 중에는 공중 감속을 걸지 않는다. 대시와 같은 소비형 카운터다. */
  reelTicksRemaining: number
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
    reelTicksRemaining: 0,
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
  let attachedThisTick = false

  for (const edge of command.wireEdges) {
    if (edge === 'release') {
      if (player.wire !== null) {
        if ((player.wire.heldTicks ?? 0) <= WIRE_REEL_TAP_TICKS) {
          applyReelLaunch(player, player.wire, world, stepSeconds)
        } else {
          player.velocity.y = Math.max(player.velocity.y, WIRE_RELEASE_UP_SPEED)
          player.velocity = clampVec3Length(player.velocity, MAX_WIRE_RELEASE_SPEED)
        }
        player.wire = null
        releasedWire = true
      }
      continue
    }
    if (player.wire === null) {
      const origin = playerWireOrigin(player.position)
      const anchor = findWireAnchor(world, origin, command.wireAimDirection)
      if (anchor !== null) {
        player.wire = {
          anchor,
          ropeLength: distanceVec3(origin, anchor),
          heldTicks: 0,
        }
        attachedThisTick = true
      }
    }
  }

  if (player.wire !== null && command.jumpPressed) {
    applyReelLaunch(player, player.wire, world, stepSeconds)
    player.wire = null
    releasedWire = true
  }

  let jumpedThisTick = false
  if (player.wire !== null) {
    stepWire(player, command, stepSeconds, attachedThisTick)
  } else if (!releasedWire) {
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
  const wireMotion = player.wire === null
    ? null
    : createWireMotion(player, stepSeconds)
  const movementVelocity = wireMotion?.movementVelocity ?? player.velocity
  const collision = world.moveAabb(
    player.position,
    movementVelocity,
    player.halfSize,
    stepSeconds,
  )
  player.position = collision.position
  player.velocity = wireMotion === null
    ? collision.velocity
    : collisionVelocity(wireMotion.constrainedVelocity, collision)
  player.grounded = collision.grounded
  if (!wasGrounded && collision.grounded) {
    player.airJumpsRemaining = 1
    player.dashAvailable = true
    player.dashTicksRemaining = 0
    player.reelTicksRemaining = 0
  }
  if (
    player.wire !== null
    && pullDirection !== null
    && collision.contacts.some((contact) => {
      const blocksTension = pullDirection[contact.axis] * contact.normal < -EPSILON
      const blocksMovement = movementVelocity[contact.axis] * contact.normal < -EPSILON
      const groundSupport = collision.grounded
        && contact.axis === 'y'
        && contact.normal === 1
      return blocksTension || (blocksMovement && !groundSupport)
    })
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

interface RankedWireCandidate extends CollisionWireCandidate {
  distance: number
  cosine: number
}

function findWireAnchor(world: CollisionWorld, origin: Vec3, aimDirectionValue: Vec3): Vec3 | null {
  const direct = world.raycast(origin, aimDirectionValue, WIRE_RANGE)
  if (direct !== null && direct.distance <= WIRE_RANGE && direct.wireable) {
    return direct.point
  }
  if (world.queryWireCandidates === undefined) return null

  const aimDirection = normalizeVec3(aimDirectionValue)
  const rankedCandidates = world
    .queryWireCandidates(origin, aimDirection, WIRE_RANGE)
    .filter((candidate) => candidate.wireable)
    .map((candidate): RankedWireCandidate | null => {
      if (!finiteVec3(candidate.point)) return null
      const offset = subtractVec3(candidate.point, origin)
      const distance = lengthVec3(offset)
      if (!Number.isFinite(distance) || distance <= EPSILON || distance > WIRE_RANGE) return null
      return {
        ...candidate,
        distance,
        cosine: dotVec3(normalizeVec3(offset), aimDirection),
      }
    })
    .filter((candidate): candidate is RankedWireCandidate => candidate !== null)

  const coneCandidates = rankedCandidates
    .filter((candidate) => candidate.cosine >= WIRE_AIM_ASSIST_COSINE - EPSILON)
    .sort((first, second) => (
      second.cosine - first.cosine
      || first.distance - second.distance
      || compareVec3(first.point, second.point)
    ))
  const coneAnchor = firstVisibleWireCandidate(world, origin, coneCandidates)
  if (coneAnchor !== null) return coneAnchor

  const overheadCandidates = rankedCandidates
    .filter((candidate) => {
      const height = candidate.point.y - origin.y
      const horizontalDistance = Math.hypot(
        candidate.point.x - origin.x,
        candidate.point.z - origin.z,
      )
      return height >= WIRE_OVERHEAD_MIN_HEIGHT - EPSILON
        && horizontalDistance <= WIRE_OVERHEAD_HORIZONTAL_RANGE + EPSILON
        && candidate.distance <= WIRE_OVERHEAD_RANGE + EPSILON
    })
    .sort((first, second) => {
      const firstHorizontal = Math.hypot(first.point.x - origin.x, first.point.z - origin.z)
      const secondHorizontal = Math.hypot(second.point.x - origin.x, second.point.z - origin.z)
      return firstHorizontal - secondHorizontal
        || first.distance - second.distance
        || compareVec3(first.point, second.point)
    })
  return firstVisibleWireCandidate(world, origin, overheadCandidates)
}

function firstVisibleWireCandidate(
  world: CollisionWorld,
  origin: Vec3,
  candidates: readonly RankedWireCandidate[],
): Vec3 | null {
  if (world.queryFirstVisibleWireCandidate !== undefined) {
    return world.queryFirstVisibleWireCandidate(
      origin,
      candidates,
      WIRE_RANGE,
      WIRE_VISIBILITY_EPSILON,
    )?.point ?? null
  }
  for (const candidate of candidates) {
    if (
      wireCandidateVisible(world, origin, candidate.point, candidate.distance)
    ) return candidate.point
  }
  return null
}

function wireCandidateVisible(
  world: CollisionWorld,
  origin: Vec3,
  anchor: Vec3,
  distance: number,
): boolean {
  const hit = world.raycast(origin, subtractVec3(anchor, origin), distance + WIRE_VISIBILITY_EPSILON)
  return hit !== null
    && hit.wireable
    && distanceVec3(hit.point, anchor) <= WIRE_VISIBILITY_EPSILON
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
  if (player.reelTicksRemaining > 0) {
    player.reelTicksRemaining -= 1
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

function applyReelLaunch(
  player: PlayerState,
  wire: WirePullState,
  world: CollisionWorld,
  stepSeconds: number,
): void {
  const launch = reelLaunch(player, wire, world)
  player.velocity = clampVec3Length(launch.velocity, MAX_WIRE_RELEASE_SPEED)
  player.reelTicksRemaining = Math.max(1, Math.ceil(launch.flightSeconds / stepSeconds))
}

interface ReelLaunch {
  velocity: Vec3
  flightSeconds: number
}

function reelLaunch(
  player: PlayerState,
  wire: WirePullState,
  world: CollisionWorld,
): ReelLaunch {
  const origin = playerWireOrigin(player.position)
  const landing = anchorTopPoint(world, wire.anchor)
  const horizontal = { x: landing.x - origin.x, z: landing.z - origin.z }
  const horizontalDistance = Math.hypot(horizontal.x, horizontal.z)
  const overshoot = horizontalDistance <= EPSILON
    ? { x: 0, z: 0 }
    : {
        x: horizontal.x / horizontalDistance * WIRE_REEL_OVERSHOOT,
        z: horizontal.z / horizontalDistance * WIRE_REEL_OVERSHOOT,
      }
  const target = {
    x: landing.x + overshoot.x,
    y: landing.y + player.halfSize.y + WIRE_ORIGIN_HEIGHT + WIRE_REEL_LANDING_CLEARANCE,
    z: landing.z + overshoot.z,
  }
  const flightSeconds = Math.min(
    WIRE_REEL_MAX_FLIGHT_SECONDS,
    Math.max(WIRE_REEL_MIN_FLIGHT_SECONDS, distanceVec3(origin, target) / WIRE_REEL_FLIGHT_SPEED),
  )
  return {
    velocity: {
      x: (target.x - origin.x) / flightSeconds,
      y: (target.y - origin.y) / flightSeconds - 0.5 * GRAVITY * flightSeconds,
      z: (target.z - origin.z) / flightSeconds,
    },
    flightSeconds,
  }
}

/** anchor 표면이 옆면일 수 있으므로 바로 위에서 아래로 훑어 착지할 상단면을 찾는다. */
function anchorTopPoint(world: CollisionWorld, anchor: Vec3): Vec3 {
  const probeOrigin = { x: anchor.x, y: anchor.y + WIRE_REEL_TOP_PROBE_HEIGHT, z: anchor.z }
  const hit = world.raycast(probeOrigin, { x: 0, y: -1, z: 0 }, WIRE_REEL_TOP_PROBE_HEIGHT)
  if (hit === null || !Number.isFinite(hit.point.y) || hit.point.y < anchor.y) return anchor
  return { x: anchor.x, y: hit.point.y, z: anchor.z }
}

function stepWire(
  player: PlayerState,
  command: PlayerCommand,
  stepSeconds: number,
  attachedThisTick: boolean,
): void {
  const wire = player.wire
  if (wire === null) return
  if (!attachedThisTick) wire.heldTicks = (wire.heldTicks ?? 0) + 1
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

interface WireMotion {
  movementVelocity: Vec3
  constrainedVelocity: Vec3
}

function createWireMotion(player: PlayerState, stepSeconds: number): WireMotion {
  const wire = player.wire
  if (wire === null) {
    return { movementVelocity: player.velocity, constrainedVelocity: player.velocity }
  }
  const origin = playerWireOrigin(player.position)
  const proposedOrigin = {
    x: origin.x + player.velocity.x * stepSeconds,
    y: origin.y + player.velocity.y * stepSeconds,
    z: origin.z + player.velocity.z * stepSeconds,
  }
  const proposedOutward = {
    x: proposedOrigin.x - wire.anchor.x,
    y: proposedOrigin.y - wire.anchor.y,
    z: proposedOrigin.z - wire.anchor.z,
  }
  const proposedDistance = lengthVec3(proposedOutward)
  if (proposedDistance <= wire.ropeLength || proposedDistance <= EPSILON) {
    return { movementVelocity: player.velocity, constrainedVelocity: player.velocity }
  }
  const radial = normalizeVec3(proposedOutward)
  const constrainedOrigin = {
    x: wire.anchor.x + radial.x * wire.ropeLength,
    y: wire.anchor.y + radial.y * wire.ropeLength,
    z: wire.anchor.z + radial.z * wire.ropeLength,
  }
  const movementVelocity = {
    x: (constrainedOrigin.x - origin.x) / stepSeconds,
    y: (constrainedOrigin.y - origin.y) / stepSeconds,
    z: (constrainedOrigin.z - origin.z) / stepSeconds,
  }
  const currentOutward = {
    x: origin.x - wire.anchor.x,
    y: origin.y - wire.anchor.y,
    z: origin.z - wire.anchor.z,
  }
  const currentRadial = lengthVec3(currentOutward) <= EPSILON
    ? radial
    : normalizeVec3(currentOutward)
  const tangentSpeed = lengthVec3(projectTangent(player.velocity, currentRadial))
  const nextTangent = projectTangent(player.velocity, radial)
  const nextTangentLength = lengthVec3(nextTangent)
  const constrainedVelocity = nextTangentLength <= EPSILON
    ? { x: 0, y: 0, z: 0 }
    : {
        x: nextTangent.x * tangentSpeed / nextTangentLength,
        y: nextTangent.y * tangentSpeed / nextTangentLength,
        z: nextTangent.z * tangentSpeed / nextTangentLength,
      }
  return { movementVelocity, constrainedVelocity }
}

function collisionVelocity(
  constrainedVelocity: Vec3,
  collision: ReturnType<CollisionWorld['moveAabb']>,
): Vec3 {
  if (collision.blocked && collision.contacts.length === 0) return collision.velocity
  const velocity = { ...constrainedVelocity }
  for (const contact of collision.contacts) {
    velocity[contact.axis] = collision.velocity[contact.axis]
  }
  return velocity
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

function subtractVec3(first: Vec3, second: Vec3): Vec3 {
  return { x: first.x - second.x, y: first.y - second.y, z: first.z - second.z }
}

function distanceVec3(first: Vec3, second: Vec3): number {
  return lengthVec3(subtractVec3(first, second))
}

function finiteVec3(value: Vec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function compareVec3(first: Vec3, second: Vec3): number {
  return first.x - second.x || first.y - second.y || first.z - second.z
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
