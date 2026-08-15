import { describe, expect, it } from 'vitest'

import { IDLE_PLAYER_COMMAND } from './commands'
import type { PlayerCommand } from './commands'
import type { CollisionWorld } from './collision-world'
import { createPlayerState } from './player'
import { createPivotSession, stepPivotSession } from './session'
import type { PivotSessionOptions } from './session'

interface TestEnemy {
  id: string
  position: { x: number; y: number; z: number }
  halfSize: { x: number; y: number; z: number }
  hp: number
  maxHp: number
  nextShotTick: number
  alive: boolean
}

interface TestProjectile {
  id: string
  owner: 'player' | 'enemy'
  position: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
  damage: number
  ttl: number
  radius: number
}

interface CombatSnapshot {
  playerHp: number
  playerMaxHp: number
  enemies: readonly TestEnemy[]
  projectiles: readonly TestProjectile[]
}

describe('피벗 기본 슈팅 전투', () => {
  it('player shot은 8틱 cooldown과 안정 id를 사용하고 같은 입력은 결정론적이다', () => {
    let first = createCombatSession()
    let second = createCombatSession()

    first = stepPivotSession(first, shootCommand())
    second = stepPivotSession(second, shootCommand())
    expect(combat(first).projectiles).toEqual(combat(second).projectiles)
    expect(combat(first).projectiles[0]).toMatchObject({
      id: 'player-shot-1', owner: 'player', damage: 25, ttl: 107, radius: 0.12,
      velocity: { x: 0, y: 0, z: -50 },
    })

    for (let tick = 2; tick <= 8; tick += 1) first = stepPivotSession(first, shootCommand())
    expect(combat(first).projectiles.map(({ id }) => id)).toEqual(['player-shot-1'])
    first = stepPivotSession(first, shootCommand())
    expect(combat(first).projectiles.map(({ id }) => id)).toEqual([
      'player-shot-1', 'player-shot-9',
    ])
  })

  it('shot direction은 finite normalized만 허용하고 먼 camera origin은 player 앞 0.6m로 보정한다', () => {
    const base = createCombatSession()
    const corrected = stepPivotSession(base, shootCommand({ x: 20, y: 0, z: 0 }))
    expect(combat(corrected).projectiles[0]?.position).toEqual({
      x: 0,
      y: 0,
      z: -(0.6 + 50 / 60),
    })

    for (const direction of [
      { x: Number.NaN, y: 0, z: -1 },
      { x: 0, y: 0, z: -2 },
      { x: 0, y: 0, z: 0 },
    ]) {
      const invalid = stepPivotSession(base, shootCommand({ x: 0, y: 0, z: 0 }, direction))
      expect(combat(invalid).projectiles).toEqual([])
    }
  })

  it('고속 projectile은 swept segment로 적을 통과하지 않고 25 피해 뒤 제거된다', () => {
    const enemy = testEnemy('enemy-a', { x: 0, y: 0, z: -1 })
    const projectile = testProjectile('fast', 'player', { x: 0, y: 0, z: 1 }, {
      x: 0, y: 0, z: -180,
    })
    const next = stepPivotSession(createCombatSession([enemy], [projectile]), IDLE_PLAYER_COMMAND)

    expect(combat(next).enemies[0]?.hp).toBe(50)
    expect(combat(next).projectiles).toEqual([])
  })

  it('terrain과 target 충돌이 동률이면 terrain이 차폐하고 뒤 enemy는 피해를 받지 않는다', () => {
    const enemy = testEnemy('enemy-a', { x: 0, y: 0, z: -1.1 })
    const projectile = testProjectile('occluded', 'player', { x: 0, y: 0, z: 0 }, {
      x: 0, y: 0, z: -120,
    })
    const session = createPivotSession({
      colliders: [{
        center: { x: 0, y: 0, z: -1.55 },
        halfSize: { x: 1, y: 1, z: 1 },
        wireable: false,
      }],
      enemies: [enemy],
      projectiles: [projectile],
      player: createPlayerState({ position: { x: 0, y: 4, z: 0 } }),
    } as unknown as PivotSessionOptions)
    const next = stepPivotSession(session, IDLE_PLAYER_COMMAND)

    expect(combat(next).enemies[0]?.hp).toBe(75)
    expect(combat(next).projectiles).toEqual([])
  })

  it.each([
    {
      label: 'side',
      wall: { center: { x: 0.15, y: 0, z: -1.48 }, halfSize: { x: 0.05, y: 1, z: 0.1 } },
      enemyPosition: { x: 0, y: 0, z: -2 },
      velocity: { x: 0, y: 0, z: -180 },
    },
    {
      label: 'corner',
      wall: { center: { x: 0.1, y: 0.1, z: -1.45 }, halfSize: { x: 0.02, y: 0.02, z: 0.1 } },
      enemyPosition: { x: 0, y: 0, z: -2 },
      velocity: { x: 0, y: 0, z: -180 },
    },
    {
      label: 'diagonal face',
      wall: { center: { x: 0.95, y: 0, z: -0.95 }, halfSize: { x: 0.05, y: 1, z: 1 } },
      enemyPosition: { x: 1.469, y: 0, z: -1.469 },
      velocity: { x: 127.27922061357856, y: 0, z: -127.27922061357856 },
    },
  ])('swept sphere terrain $label 접촉은 center ray가 놓쳐도 뒤 target보다 먼저 차폐한다', ({
    wall, enemyPosition, velocity,
  }) => {
    const enemy = testEnemy('enemy-behind-terrain', enemyPosition)
    const projectile = testProjectile('sphere-sweep', 'player', { x: 0, y: 0, z: 0 }, velocity)
    const session = createPivotSession({
      colliders: [{ ...wall, wireable: false }],
      enemies: [enemy],
      projectiles: [projectile],
      player: createPlayerState({ position: { x: 0, y: 4, z: 0 } }),
    } as unknown as PivotSessionOptions)

    const next = stepPivotSession(session, IDLE_PLAYER_COMMAND)

    expect(combat(next).enemies[0]?.hp).toBe(75)
    expect(combat(next).projectiles).toEqual([])
  })

  it('sweepSphere 없는 custom CollisionWorld도 center-ray fallback으로 side terrain을 놓치면 안 된다', () => {
    const enemy = testEnemy('enemy-custom-world', { x: 0, y: 0, z: -2 })
    const projectile = testProjectile('custom-side', 'player', { x: 0, y: 0, z: 0 }, {
      x: 0, y: 0, z: -180,
    })
    const sideWall = {
      center: { x: 0.15, y: 0, z: -1.48 },
      halfSize: { x: 0.05, y: 1, z: 0.1 },
      wireable: false,
    }
    const authority = createPivotSession({ colliders: [sideWall] }).world
    const customWorld = {
      moveAabb: authority.moveAabb,
      raycast: authority.raycast,
    } as unknown as CollisionWorld
    const session = createPivotSession({
      world: customWorld,
      enemies: [enemy],
      projectiles: [projectile],
      player: createPlayerState({ position: { x: 0, y: 4, z: 0 } }),
    } as unknown as PivotSessionOptions)

    const next = stepPivotSession(session, IDLE_PLAYER_COMMAND)

    expect(combat(next).enemies[0]?.hp).toBe(75)
    expect(combat(next).projectiles).toEqual([])
  })

  it('zero-velocity projectile은 시작 sphere와 겹친 terrain에 distance 0으로 선제 차폐된다', () => {
    const session = createPivotSession({
      colliders: [{
        center: { x: 0, y: 0, z: 0 },
        halfSize: { x: 0.25, y: 0.25, z: 0.25 },
        wireable: false,
      }],
      enemies: [testEnemy('enemy-overlap', { x: 0, y: 0, z: 0 })],
      projectiles: [testProjectile('stationary-overlap', 'player', { x: 0, y: 0, z: 0 }, {
        x: 0, y: 0, z: 0,
      })],
      player: createPlayerState({ position: { x: 0, y: 4, z: 0 } }),
    } as unknown as PivotSessionOptions)

    const next = stepPivotSession(session, IDLE_PLAYER_COMMAND)

    expect(combat(next).enemies[0]?.hp).toBe(75)
    expect(combat(next).projectiles).toEqual([])
  })

  it('enemy target AABB corner에서 실제 radius 밖으로 스친 player projectile은 피해를 주지 않는다', () => {
    const session = createCombatSession(
      [testEnemy('enemy-corner-miss', { x: 0, y: 0, z: -1.5 })],
      [testProjectile('enemy-corner-miss', 'player', { x: 0.65, y: 0.85, z: 0 }, {
        x: 0, y: 0, z: -180,
      })],
    )

    const next = stepPivotSession(session, IDLE_PLAYER_COMMAND)

    expect(combat(next).enemies[0]?.hp).toBe(75)
    expect(combat(next).projectiles).toHaveLength(1)
  })

  it('player target AABB corner에서 실제 radius 밖으로 스친 enemy projectile은 피해를 주지 않는다', () => {
    const session = createCombatSession([], [
      testProjectile('player-corner-miss', 'enemy', { x: 0.5, y: 1, z: 0 }, {
        x: 0, y: 0, z: -180,
      }),
    ])

    const next = stepPivotSession(session, IDLE_PLAYER_COMMAND)

    expect(combat(next).playerHp).toBe(100)
    expect(combat(next).projectiles).toHaveLength(1)
  })

  it.each([
    'player-shot-1',
    'enemy-shot-enemy-a-1',
  ])('외부 projectile은 generated id namespace %s를 선점할 수 없다', (id) => {
    expect(() => createCombatSession([], [testProjectile(id)]))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMBAT_STATE' }))
  })

  it('enemy는 안정 stagger tick에 player 중심으로 결정론적 탄환을 발사한다', () => {
    const enemy = testEnemy('enemy-a', { x: 3, y: 0, z: 0 }, 1)
    const first = stepPivotSession(createCombatSession([enemy]), IDLE_PLAYER_COMMAND)
    const second = stepPivotSession(createCombatSession([enemy]), IDLE_PLAYER_COMMAND)
    const projectile = combat(first).projectiles[0]

    expect(combat(first)).toEqual(combat(second))
    expect(projectile).toMatchObject({
      id: 'enemy-shot-enemy-a-1', owner: 'enemy', damage: 15, ttl: 299, radius: 0.12,
    })
    expect(Math.hypot(
      projectile?.velocity.x ?? 0,
      projectile?.velocity.y ?? 0,
      projectile?.velocity.z ?? 0,
    )).toBeCloseTo(10, 10)
    expect(combat(first).enemies[0]?.nextShotTick).toBe(151)
  })

  it('enemy projectile은 player AABB를 swept hit하고 HP를 0 아래로 내리지 않는다', () => {
    const projectiles = Array.from({ length: 7 }, (_, index) => testProjectile(
      `enemy-${index}`,
      'enemy',
      { x: 0, y: 0, z: 1 + index * 0.01 },
      { x: 0, y: 0, z: -180 },
      15,
    ))
    const next = stepPivotSession(createCombatSession([], projectiles), IDLE_PLAYER_COMMAND)

    expect(combat(next).playerHp).toBe(0)
    expect(combat(next).projectiles).toEqual([])
  })

  it('TTL 만료와 world 경계 밖 projectile을 제거한다', () => {
    const next = stepPivotSession(createCombatSession([], [
      testProjectile('ttl', 'player', { x: 0, y: 5, z: 0 }, { x: 0, y: 0, z: 0 }, 25, 1),
      testProjectile('low', 'player', { x: 0, y: -21, z: 0 }, { x: 0, y: 0, z: 0 }),
      testProjectile('far', 'player', { x: 257, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
    ]), IDLE_PLAYER_COMMAND)

    expect(combat(next).projectiles).toEqual([])
  })

  it('tick 시작부터 world 경계 밖인 projectile은 swept damage 전에 선제 제거한다', () => {
    const next = stepPivotSession(createCombatSession(
      [testEnemy('enemy-outside', { x: 252, y: 0, z: 0 })],
      [testProjectile('outside-hit', 'player', { x: 257, y: 0, z: 0 }, {
        x: -600, y: 0, z: 0,
      })],
    ), IDLE_PLAYER_COMMAND)

    expect(combat(next).enemies[0]?.hp).toBe(75)
    expect(combat(next).projectiles).toEqual([])
  })

  it('snapshot combat entity는 source와 깊은 alias가 없고 외부 변경을 허용하지 않는다', () => {
    const enemy = testEnemy('enemy-a', { x: 3, y: 2, z: 1 })
    const projectile = testProjectile('shot-a', 'player', { x: 0, y: 0, z: 0 }, {
      x: 1, y: 0, z: 0,
    })
    const session = createCombatSession([enemy], [projectile])
    enemy.position.x = 99
    projectile.velocity.x = 99

    expect(combat(session).enemies[0]?.position.x).toBe(3)
    expect(combat(session).projectiles[0]?.velocity.x).toBe(1)
    expect(() => {
      combat(session).enemies[0]!.position.x = 7
    }).toThrow(TypeError)
  })

  it('외부 enemy와 projectile의 finite unique id hp ttl radius 계약을 안정 code로 거부한다', () => {
    const invalidOptions = [
      { enemies: [testEnemy('same'), testEnemy('same')] },
      { enemies: [{ ...testEnemy('nan'), position: { x: Number.NaN, y: 0, z: 0 } }] },
      { enemies: [{ ...testEnemy('hp'), hp: 76 }] },
      { projectiles: [{ ...testProjectile('ttl'), ttl: 36_001 }] },
      { projectiles: [{ ...testProjectile('radius'), radius: Number.NaN }] },
      { projectiles: [testProjectile('same'), testProjectile('same')] },
    ]
    for (const invalid of invalidOptions) {
      expect(() => createPivotSession({ terrain: [], ...invalid } as unknown as PivotSessionOptions))
        .toThrowError(expect.objectContaining({ code: 'INVALID_COMBAT_STATE' }))
    }
  })

  it('malformed null primitive non-array combat option도 TypeError 대신 안정 code로 거부한다', () => {
    const malformedOptions = [
      { enemies: [null] },
      { enemies: [{ ...testEnemy('null-position'), position: null }] },
      { enemies: 3 },
      { projectiles: null },
      { projectiles: [false] },
      { projectiles: Array.from({ length: 4_097 }, (_, index) => testProjectile(`many-${index}`)) },
    ]
    for (const malformed of malformedOptions) {
      expect(() => createPivotSession({ terrain: [], ...malformed } as unknown as PivotSessionOptions))
        .toThrowError(expect.objectContaining({ code: 'INVALID_COMBAT_STATE' }))
    }
  })

  it('비 ASCII external id도 locale이 아닌 code unit 순서로 snapshot을 고정한다', () => {
    const session = createCombatSession([
      testEnemy('ä'),
      testEnemy('z'),
    ])

    expect(combat(session).enemies.map(({ id }) => id)).toEqual(['z', 'ä'])
  })
})

function createCombatSession(
  enemies: readonly TestEnemy[] = [],
  projectiles: readonly TestProjectile[] = [],
) {
  return createPivotSession({
    terrain: [],
    enemies,
    projectiles,
    player: createPlayerState({ position: { x: 0, y: 0, z: 0 }, grounded: false }),
  } as unknown as PivotSessionOptions)
}

function combat(session: ReturnType<typeof createPivotSession>): CombatSnapshot {
  return session.snapshot as unknown as CombatSnapshot
}

function shootCommand(
  origin = { x: 0, y: 0, z: 0 },
  direction = { x: 0, y: 0, z: -1 },
): PlayerCommand {
  return {
    ...IDLE_PLAYER_COMMAND,
    shootPressed: true,
    shootOrigin: origin,
    shootDirection: direction,
  } as PlayerCommand
}

function testEnemy(
  id: string,
  position = { x: 0, y: 0, z: -5 },
  nextShotTick = 999,
): TestEnemy {
  return {
    id,
    position: { ...position },
    halfSize: { x: 0.55, y: 0.75, z: 0.55 },
    hp: 75,
    maxHp: 75,
    nextShotTick,
    alive: true,
  }
}

function testProjectile(
  id: string,
  owner: 'player' | 'enemy' = 'player',
  position = { x: 0, y: 0, z: 0 },
  velocity = { x: 0, y: 0, z: -50 },
  damage = owner === 'player' ? 25 : 15,
  ttl = 108,
): TestProjectile {
  return {
    id,
    owner,
    position: { ...position },
    velocity: { ...velocity },
    damage,
    ttl,
    radius: 0.12,
  }
}
