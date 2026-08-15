import type { PlayerCommand } from './commands'
import { sweptSphereAabbDistance } from './collision-world'
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
/** 조준선을 푸는 최대 거리. 탄속 × TTL과 같아 조준점 밖은 어차피 탄이 닿지 않는다. */
export const PLAYER_AIM_RANGE = PLAYER_SHOT_SPEED * PLAYER_SHOT_TTL / 60
const MIN_AIM_CONVERGENCE_DISTANCE = 1
export const ENEMY_HALF_SIZE: Readonly<Vec3> = Object.freeze({ x: 0.55, y: 0.75, z: 0.55 })

const MAX_ENTITY_HP = 10_000
const MAX_PROJECTILE_TTL = 36_000
const MAX_PROJECTILE_RADIUS = 16
const MAX_ENTITY_HALF_SIZE = 16
const MAX_ENEMY_COUNT = 1_024
const MAX_PROJECTILE_COUNT = 4_096
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
  enemiesInput: unknown = [],
  projectilesInput: unknown = [],
  playerHpInput: unknown = PLAYER_MAX_HP,
): CombatState {
  assertValidCombatOptions(enemiesInput, projectilesInput, playerHpInput)
  const enemies = enemiesInput as readonly EnemyState[]
  const projectiles = projectilesInput as readonly ProjectileState[]
  const playerHp = playerHpInput as number
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
  const projectileIds = new Set(projectiles.map(({ id }) => id))
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
    const aimPoint = resolveAimPoint(
      request.world,
      enemies,
      request.command.shootOrigin,
      shotDirection,
    )
    const muzzleDirection = convergedShotDirection(origin, aimPoint, shotDirection)
    const id = `player-shot-${request.tick}`
    if (!projectileIds.has(id)) projectiles.push({
      id,
      owner: 'player',
      position: origin,
      velocity: scale(muzzleDirection, PLAYER_SHOT_SPEED),
      damage: PLAYER_SHOT_DAMAGE,
      ttl: PLAYER_SHOT_TTL,
      radius: PROJECTILE_RADIUS,
    })
    projectileIds.add(id)
    nextPlayerShotTick = request.tick + PLAYER_FIRE_COOLDOWN_TICKS
  }

  for (const enemy of enemies) {
    if (!enemy.alive || request.tick < enemy.nextShotTick) continue
    const direction = normalized(subtract(request.playerPosition, enemy.position))
    enemy.nextShotTick = request.tick + ENEMY_FIRE_INTERVAL_TICKS
    if (direction === null) continue
    const id = `enemy-shot-${enemy.id}-${request.tick}`
    if (projectileIds.has(id)) continue
    projectiles.push({
      id,
      owner: 'enemy',
      position: { ...enemy.position },
      velocity: scale(direction, ENEMY_SHOT_SPEED),
      damage: ENEMY_SHOT_DAMAGE,
      ttl: ENEMY_SHOT_TTL,
      radius: PROJECTILE_RADIUS,
    })
    projectileIds.add(id)
  }

  const survivors: ProjectileState[] = []
  for (const projectile of projectiles.sort(compareId)) {
    if (projectile.ttl <= 0 || projectileOutOfBounds(projectile.position)) continue
    const delta = scale(projectile.velocity, request.stepSeconds)
    const terrainHit = request.world.sweepSphere(
      projectile.position,
      delta,
      projectile.radius,
    )
    const targetHit = projectile.owner === 'player'
      ? nearestEnemyHit(projectile, delta, enemies)
      : sweptSphereAabbDistance(
          projectile.position,
          delta,
          projectile.radius,
          { center: request.playerPosition, halfSize: request.playerHalfSize },
        )
    const targetDistance = typeof targetHit === 'number' ? targetHit : targetHit?.distance ?? null
    const terrainDistance = terrainHit?.distance ?? null
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
  enemiesInput: unknown,
  projectilesInput: unknown,
  playerHp: unknown,
): void {
  if (!finiteInRange(playerHp, 0, PLAYER_MAX_HP)) invalid('player HP 범위가 유효하지 않습니다.')
  if (!Array.isArray(enemiesInput) || enemiesInput.length > MAX_ENEMY_COUNT) {
    invalid('enemy 목록 형태 또는 개수 상한이 유효하지 않습니다.')
  }
  if (!Array.isArray(projectilesInput) || projectilesInput.length > MAX_PROJECTILE_COUNT) {
    invalid('projectile 목록 형태 또는 개수 상한이 유효하지 않습니다.')
  }
  const enemies = enemiesInput as readonly unknown[]
  const projectiles = projectilesInput as readonly unknown[]
  assertUniqueIds(enemies, 'enemy')
  assertUniqueIds(projectiles, 'projectile')
  for (const value of enemies) {
    if (!isRecord(value)) invalid('enemy entry 형태가 유효하지 않습니다.')
    const enemy = value as Record<string, unknown>
    if (
      !finiteVec3(enemy.position)
      || !positiveBoundedVec3(enemy.halfSize, MAX_ENTITY_HALF_SIZE)
      || !finiteInRange(enemy.maxHp, 1, MAX_ENTITY_HP)
      || !finiteInRange(enemy.hp, 0, enemy.maxHp)
      || !safeIntegerInRange(enemy.nextShotTick, 0, Number.MAX_SAFE_INTEGER)
      || typeof enemy.alive !== 'boolean'
      || enemy.alive !== ((enemy.hp as number) > 0)
    ) invalid(`enemy ${enemy.id} 상태가 유효하지 않습니다.`)
  }
  for (const value of projectiles) {
    if (!isRecord(value)) invalid('projectile entry 형태가 유효하지 않습니다.')
    const projectile = value as Record<string, unknown>
    if (
      (projectile.owner !== 'player' && projectile.owner !== 'enemy')
      || !finiteVec3(projectile.position)
      || !finiteVec3(projectile.velocity)
      || !finiteInRange(projectile.damage, 0, MAX_ENTITY_HP)
      || projectile.damage <= 0
      || !safeIntegerInRange(projectile.ttl, 1, MAX_PROJECTILE_TTL)
      || !finiteInRange(projectile.radius, Number.MIN_VALUE, MAX_PROJECTILE_RADIUS)
      || (projectile.id as string).startsWith('player-shot-')
      || (projectile.id as string).startsWith('enemy-shot-')
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
    const hitDistance = sweptSphereAabbDistance(
      projectile.position,
      delta,
      projectile.radius,
      { center: enemy.position, halfSize: enemy.halfSize },
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

function assertUniqueIds(values: readonly unknown[], kind: string): void {
  const ids = new Set<string>()
  for (const value of values) {
    if (
      !isRecord(value)
      || typeof value.id !== 'string'
      || value.id.length === 0
      || ids.has(value.id)
    ) {
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
  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0
}

function finiteVec3(value: unknown): value is Vec3 {
  return isRecord(value)
    && finiteNumber(value.x)
    && finiteNumber(value.y)
    && finiteNumber(value.z)
}

function positiveBoundedVec3(value: unknown, maximum: number): value is Vec3 {
  return finiteVec3(value) && (['x', 'y', 'z'] as const).every((axis) => (
    value[axis] > 0 && value[axis] <= maximum
  ))
}

function finiteInRange(value: unknown, minimum: number, maximum: number): value is number {
  return finiteNumber(value) && value >= minimum && value <= maximum
}

function safeIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * 어깨 카메라는 총구와 떨어져 있어 카메라 방향으로 그대로 쏘면 화면 중앙 조준선과 어긋난다.
 * 조준선이 실제로 닿는 지점을 찾아 총구에서 그 지점으로 수렴시킨다.
 */
function resolveAimPoint(
  world: CollisionWorld,
  enemies: readonly EnemyState[],
  cameraOrigin: Vec3,
  direction: Vec3,
): Vec3 {
  let aimDistance = PLAYER_AIM_RANGE
  const terrainHit = world.raycast(cameraOrigin, direction, PLAYER_AIM_RANGE)
  if (terrainHit !== null && Number.isFinite(terrainHit.distance) && terrainHit.distance >= 0) {
    aimDistance = Math.min(aimDistance, terrainHit.distance)
  }
  const displacement = scale(direction, PLAYER_AIM_RANGE)
  for (const enemy of enemies) {
    if (!enemy.alive) continue
    const hitDistance = sweptSphereAabbDistance(cameraOrigin, displacement, 0, {
      center: enemy.position,
      halfSize: enemy.halfSize,
    })
    if (hitDistance !== null && hitDistance < aimDistance) aimDistance = hitDistance
  }
  return addScaled(cameraOrigin, direction, aimDistance)
}

function convergedShotDirection(origin: Vec3, aimPoint: Vec3, fallback: Vec3): Vec3 {
  const toAim = subtract(aimPoint, origin)
  if (length(toAim) < MIN_AIM_CONVERGENCE_DISTANCE) return fallback
  const converged = normalized(toAim)
  if (converged === null) return fallback
  const forward = converged.x * fallback.x + converged.y * fallback.y + converged.z * fallback.z
  return forward <= 0 ? fallback : converged
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
