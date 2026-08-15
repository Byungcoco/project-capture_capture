import { describe, expect, it } from 'vitest'

import * as course from './movement-course'

describe('고저차 combat movement course', () => {
  it('시작 이후 4개 wireable 진행 발판이 10m 이상 30m 이내로 이어지고 55m 수평 24m 높이에 도달한다', () => {
    const platforms = (
      course as unknown as { COMBAT_PLATFORM_CENTERS?: readonly { x: number; y: number; z: number }[] }
    ).COMBAT_PLATFORM_CENTERS
    expect(platforms).toBeDefined()
    if (platforms === undefined) return
    expect(platforms).toHaveLength(4)
    const centers = [course.MOVEMENT_SPAWN, ...platforms]
    for (let index = 1; index < centers.length; index += 1) {
      const previous = centers[index - 1]!
      const current = centers[index]!
      const horizontal = Math.hypot(current.x - previous.x, current.z - previous.z)
      expect(horizontal).toBeGreaterThanOrEqual(10)
      expect(horizontal).toBeLessThanOrEqual(30)
      expect(course.MOVEMENT_TERRAIN.some((cell) => {
        const x = (cell.index.x + 0.5) * 0.5
        const y = (cell.index.y + 0.5) * 0.5
        const z = (cell.index.z + 0.5) * 0.5
        return cell.wireable
          && Math.abs(x - current.x) <= 3
          && Math.abs(y - current.y) <= 0.5
          && Math.abs(z - current.z) <= 3
      })).toBe(true)
    }
    const final = platforms.at(-1)!
    expect(Math.hypot(final.x - course.MOVEMENT_SPAWN.x, final.z - course.MOVEMENT_SPAWN.z))
      .toBeGreaterThanOrEqual(55)
    expect(final.y - course.MOVEMENT_SPAWN.y).toBeGreaterThanOrEqual(24)
  })

  it('4개 이상 enemy가 서로 다른 진행 발판 위에 안정 id 순서로 배치된다', () => {
    const enemies = (
      course as unknown as { MOVEMENT_ENEMIES?: readonly { id: string; position: { x: number; y: number; z: number } }[] }
    ).MOVEMENT_ENEMIES
    const platforms = (
      course as unknown as { COMBAT_PLATFORM_CENTERS?: readonly { x: number; y: number; z: number }[] }
    ).COMBAT_PLATFORM_CENTERS
    expect(enemies).toBeDefined()
    expect(platforms).toBeDefined()
    if (enemies === undefined || platforms === undefined) return
    expect(enemies.length).toBeGreaterThanOrEqual(4)
    expect(enemies.map(({ id }) => id)).toEqual([...enemies.map(({ id }) => id)].sort())
    expect(new Set(enemies.map(({ position }) => `${position.x},${position.z}`)).size)
      .toBe(enemies.length)
    for (const enemy of enemies) {
      expect(platforms.some((platform) => (
        enemy.position.x === platform.x
        && enemy.position.z === platform.z
        && enemy.position.y > platform.y
      ))).toBe(true)
    }
  })
})
