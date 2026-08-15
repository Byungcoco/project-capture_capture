import type { PlayerCommand } from './commands'
import type { CollisionWorld } from './collision-world'
import type { Vec3 } from './math'

export const PLAYER_MAX_HP = 100
export const PLAYER_FIRE_COOLDOWN_TICKS = 8
export const PLAYER_SHOT_SPEED = 50
export const PLAYER_SHOT_DAMAGE = 25
export const PLAYER_SHOT_TTL = 108
export const ENEMY_MAX_HP = 75
export const ENEMY_FIRE_INTERVAL_TICKS = 150
export const ENEMY_SHOT_SPEED = 10
export const ENEMY_SHOT_DAMAGE = 15
export const ENEMY_SHOT_TTL = 300
export const PROJECTILE_RADIUS = 0.12
export const ENEMY_HALF_SIZE: Readonly<Vec3> = Object.freeze({ x: 0.55, y: 0.75, z: 0.55 })

const MAX_ENTITY_HP = 10_000
const MAX_PROJECTILE_TTL = 36_000
const MAX_PROJECTILE_RADIUS = 16
const MAX_ENTITY_HALF_SIZE = 16
const COLLISION_EPSILON = 1e-8

export interface EnemyState {
  id: string
  position: Vec3
  halfSize: Vec3
  hp: number
  maxHp: number
  nextShotTick: number
  alive: boolean
}

export type ProjectileOwner = 'player' | 'enemy'

export interface ProjectileState {
  id: string
  owner: ProjectileOwner
  position: Vec3
  velocity: Vec3
  damage: number
  ttl: number
  radius: number
}

export interface CombatState {
  playerHp: number
  playerMaxHp: number
  nextPlayerShotTick: number
  enemies: readonly EnemyState[]
  projectiles: readonly ProjectileState[]
}

export interface CombatStepRequest {
  tick: number
  command: PlayerCommand
  playerPosition: Vec3
  playerHalfSize: Vec3
  world: CollisionWorld
  stepSeconds: number
}

export type CombatValidationErrorCode = 'INVALID_COMBAT_STATE'

export class CombatValidationError extends Error {
  readonly code: CombatValidationErrorCode = 'INVALID_COMBAT_STATE'

  constructor(message: string) {
    super(message)
    this.name = 'CombatValidationError'
  }
}

export function createCombatState(
  enemies: readonly EnemyState[] = [],
  projectiles: readonly ProjectileState[] = [],
  playerHp = PLAYER_MAX_HP,
): CombatState {
  assertValidCombatOptions(enemies, projectiles, playerHp)
  return {
    playerHp,
    playerMaxHp: PLAYER_MAX_HP,
    nextPlayerShotTick: 0,
    enemies: enemies.map(cloneEnemy).sort(compareId),
    projectiles: projectiles.map(cloneProjectile).sort(compareId),
  }
}

export function stepCombat(state: CombatState, request: CombatStepRequest): CombatState {
  let nextPlayerShotTick = state.nextPlayerShotTick
  let playerHp = state.playerHp
  const enemies = state.enemies.map(cloneEnemy).sort(compareId)
  const projectiles = state.projectiles.map(cloneProjectile).sort(compareId)
  const shotDirection = validShotDirection(request.command.shootDirection)

  if (
    request.command.shootPressed
    && request.tick >= nextPlayerShotTick
    && shotDirection !== null
    && finiteVec3(request.command.shootOrigin)
  ) {
    const origin = distance(request.command.shootOrigin, request.playerPosition) <= 2
      ? { ...request.command.shootOrigin }
      : addScaled(request.playerPosition, shotDirection, 0.6)
    projectiles.push({
      id: `player-shot-${request.tick}`,
      owner: 'player',
      position: origin,
      velocity: scale(shotDirection, PLAYER_SHOT_SPEED),
      damage: PLAYER_SHOT_DAMAGE,
      ttl: PLAYER_SHOT_TTL,
      radius: PROJECTILE_RADIUS,
    })
    nextPlayerShotTick = request.tick + PLAYER_FIRE_COOLDOWN_TICKS
  }

  for (const enemy of enemies) {
    if (!enemy.alive || request.tick < enemy.nextShotTick) continue
    const direction = normalized(subtract(request.playerPosition, enemy.position))
    enemy.nextShotTick = request.tick + ENEMY_FIRE_INTERVAL_TICKS
    if (direction === null) continue
    projectiles.push({
      id: `enemy-shot-${enemy.id}-${request.tick}`,
      owner: 'enemy',
      position: { ...enemy.position },
      velocity: scale(direction, ENEMY_SHOT_SPEED),
      damage: ENEMY_SHOT_DAMAGE,
      ttl: ENEMY_SHOT_TTL,
      radius: PROJECTILE_RADIUS,
    })
  }

  const survivors: ProjectileState[] = []
  for (const projectile of projectiles.sort(compareId)) {
    const delta = scale(projectile.velocity, request.stepSeconds)
    const travelDistance = length(delta)
    const terrainHit = travelDistance <= COLLISION_EPSILON
      ? null
      : request.world.raycast(
          projectile.position,
          projectile.velocity,
          travelDistance + projectile.radius,
        )
    const targetHit = projectile.owner === 'player'
      ? nearestEnemyHit(projectile, delta, enemies)
      : segmentAabbDistance(
          projectile.position,
          delta,
          request.playerPosition,
          expand(request.playerHalfSize, projectile.radius),
        )
    const targetDistance = typeof targetHit === 'number' ? targetHit : targetHit?.distance ?? null
    const terrainDistance = terrainHit === null
      ? null
      : Math.max(0, terrainHit.distance - projectile.radius)
    if (
      terrainDistance !== null
      && (targetDistance === null || terrainDistance <= targetDistance + COLLISION_EPSILON)
    ) continue
    if (targetDistance !== null) {
      if (
        projectile.owner === 'player'
        && targetHit !== null
        && typeof targetHit !== 'number'
      ) {
        const enemy = enemies[targetHit.enemyIndex]
        if (enemy !== undefined) {
          enemy.hp = Math.max(0, enemy.hp - projectile.damage)
          enemy.alive = enemy.hp > 0
        }
      } else if (projectile.owner === 'enemy') {
        playerHp = Math.max(0, playerHp - projectile.damage)
      }
      continue
    }
    const moved = {
      ...projectile,
      position: add(projectile.position, delta),
      ttl: projectile.ttl - 1,
    }
    if (moved.ttl <= 0 || projectileOutOfBounds(moved.position)) continue
    survivors.push(moved)
  }

  return {
    playerHp,
    playerMaxHp: state.playerMaxHp,
    nextPlayerShotTick,
    enemies: enemies.filter(({ alive }) => alive),
    projectiles: survivors,
  }
}

export function freezeCombatState(state: CombatState): CombatState {
  return Object.freeze({
    playerHp: state.playerHp,
    playerMaxHp: state.playerMaxHp,
    nextPlayerShotTick: state.nextPlayerShotTick,
    enemies: Object.freeze(state.enemies.map((enemy) => Object.freeze({
      ...enemy,
      position: Object.freeze({ ...enemy.position }),
      halfSize: Object.freeze({ ...enemy.halfSize }),
    }))),
    projectiles: Object.freeze(state.projectiles.map((projectile) => Object.freeze({
      ...projectile,
      position: Object.freeze({ ...projectile.position }),
      velocity: Object.freeze({ ...projectile.velocity }),
    }))),
  })
}

export function assertValidCombatOptions(
  enemies: readonly EnemyState[],
  projectiles: readonly ProjectileState[],
  playerHp: number,
): void {
  if (!finiteInRange(playerHp, 0, PLAYER_MAX_HP)) invalid('player HP 범위가 유효하지 않습니다.')
  assertUniqueIds(enemies, 'enemy')
  assertUniqueIds(projectiles, 'projectile')
  for (const enemy of enemies) {
    if (
      !finiteVec3(enemy.position)
      || !positiveBoundedVec3(enemy.halfSize, MAX_ENTITY_HALF_SIZE)
      || !finiteInRange(enemy.maxHp, 1, MAX_ENTITY_HP)
      || !finiteInRange(enemy.hp, 0, enemy.maxHp)
      || !Number.isSafeInteger(enemy.nextShotTick)
      || enemy.nextShotTick < 0
      || typeof enemy.alive !== 'boolean'
      || enemy.alive !== (enemy.hp > 0)
    ) invalid(`enemy ${enemy.id} 상태가 유효하지 않습니다.`)
  }
  for (const projectile of projectiles) {
    if (
      (projectile.owner !== 'player' && projectile.owner !== 'enemy')
      || !finiteVec3(projectile.position)
      || !finiteVec3(projectile.velocity)
      || !finiteInRange(projectile.damage, 0, MAX_ENTITY_HP)
      || projectile.damage <= 0
      || !Number.isSafeInteger(projectile.ttl)
      || projectile.ttl <= 0
      || projectile.ttl > MAX_PROJECTILE_TTL
      || !finiteInRange(projectile.radius, Number.MIN_VALUE, MAX_PROJECTILE_RADIUS)
    ) invalid(`projectile ${projectile.id} 상태가 유효하지 않습니다.`)
  }
}

function nearestEnemyHit(
  projectile: ProjectileState,
  delta: Vec3,
  enemies: readonly EnemyState[],
): { enemyIndex: number; distance: number } | null {
  let nearest: { enemyIndex: number; distance: number } | null = null
  for (let index = 0; index < enemies.length; index += 1) {
    const enemy = enemies[index]
    if (enemy === undefined || !enemy.alive) continue
    const hitDistance = segmentAabbDistance(
      projectile.position,
      delta,
      enemy.position,
      expand(enemy.halfSize, projectile.radius),
    )
    if (
      hitDistance !== null
      && (nearest === null
        || hitDistance < nearest.distance
        || (hitDistance === nearest.distance && enemy.id < (enemies[nearest.enemyIndex]?.id ?? '')))
    ) nearest = { enemyIndex: index, distance: hitDistance }
  }
  return nearest
}

function segmentAabbDistance(
  origin: Vec3,
  delta: Vec3,
  center: Vec3,
  halfSize: Vec3,
): number | null {
  let minimum = 0
  let maximum = 1
  for (const axis of ['x', 'y', 'z'] as const) {
    const lower = center[axis] - halfSize[axis]
    const upper = center[axis] + halfSize[axis]
    if (Math.abs(delta[axis]) <= COLLISION_EPSILON) {
      if (origin[axis] < lower || origin[axis] > upper) return null
      continue
    }
    const first = (lower - origin[axis]) / delta[axis]
    const second = (upper - origin[axis]) / delta[axis]
    minimum = Math.max(minimum, Math.min(first, second))
    maximum = Math.min(maximum, Math.max(first, second))
    if (maximum < minimum) return null
  }
  return minimum * length(delta)
}

function validShotDirection(direction: Vec3 | undefined): Vec3 | null {
  if (direction === undefined || !finiteVec3(direction)) return null
  const magnitude = length(direction)
  return Math.abs(magnitude - 1) <= 1e-6 ? { ...direction } : null
}

function projectileOutOfBounds(position: Vec3): boolean {
  return position.y < -20
    || Math.abs(position.x) > 256
    || Math.abs(position.y) > 256
    || Math.abs(position.z) > 256
}

function assertUniqueIds(values: readonly { id: string }[], kind: string): void {
  const ids = new Set<string>()
  for (const value of values) {
    if (typeof value.id !== 'string' || value.id.length === 0 || ids.has(value.id)) {
      invalid(`${kind} id는 비어 있지 않은 고유 문자열이어야 합니다.`)
    }
    ids.add(value.id)
  }
}

function invalid(message: string): never {
  throw new CombatValidationError(message)
}

function cloneEnemy(enemy: EnemyState): EnemyState {
  return { ...enemy, position: { ...enemy.position }, halfSize: { ...enemy.halfSize } }
}

function cloneProjectile(projectile: ProjectileState): ProjectileState {
  return { ...projectile, position: { ...projectile.position }, velocity: { ...projectile.velocity } }
}

function compareId(first: { id: string }, second: { id: string }): number {
  return first.id.localeCompare(second.id)
}

function finiteVec3(value: Vec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function positiveBoundedVec3(value: Vec3, maximum: number): boolean {
  return finiteVec3(value) && (['x', 'y', 'z'] as const).every((axis) => (
    value[axis] > 0 && value[axis] <= maximum
  ))
}

function finiteInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum
}

function normalized(value: Vec3): Vec3 | null {
  const magnitude = length(value)
  return magnitude <= COLLISION_EPSILON || !Number.isFinite(magnitude)
    ? null
    : scale(value, 1 / magnitude)
}

function length(value: Vec3): number {
  return Math.hypot(value.x, value.y, value.z)
}

function distance(first: Vec3, second: Vec3): number {
  return length(subtract(first, second))
}

function add(first: Vec3, second: Vec3): Vec3 {
  return { x: first.x + second.x, y: first.y + second.y, z: first.z + second.z }
}

function subtract(first: Vec3, second: Vec3): Vec3 {
  return { x: first.x - second.x, y: first.y - second.y, z: first.z - second.z }
}

function scale(value: Vec3, multiplier: number): Vec3 {
  return { x: value.x * multiplier, y: value.y * multiplier, z: value.z * multiplier }
}

function addScaled(value: Vec3, direction: Vec3, amount: number): Vec3 {
  return add(value, scale(direction, amount))
}

function expand(value: Vec3, amount: number): Vec3 {
  return { x: value.x + amount, y: value.y + amount, z: value.z + amount }
}
