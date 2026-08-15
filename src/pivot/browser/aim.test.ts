import { describe, expect, it } from 'vitest'

import type { CollisionWorld } from '../domain/collision-world'
import { solveCameraAim } from './aim'

describe('피벗 단일 조준 계약', () => {
  it('카메라 중앙 ray hit를 aim point로 삼고 player wire origin 방향을 만든다', () => {
    const target = { x: 4, y: 3, z: -12 }
    const solution = solveCameraAim(
      queryWorld({ point: target, distance: 12, wireable: true }),
      { x: 1, y: 3, z: 6 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 1.5, z: 0 },
      30,
    )

    expect(solution.aimPoint).toEqual(target)
    expect(solution.aimDirection.x).toBeGreaterThan(0)
    expect(solution.aimDirection.y).toBeGreaterThan(0)
    expect(solution.aimDirection.z).toBeLessThan(0)
    expect(Math.hypot(
      solution.aimDirection.x,
      solution.aimDirection.y,
      solution.aimDirection.z,
    )).toBeCloseTo(1, 10)
  })

  it('카메라 ray가 비면 중앙 ray의 최대 거리점을 사용한다', () => {
    const solution = solveCameraAim(
      queryWorld(null),
      { x: 2, y: 4, z: 5 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 1.5, z: 0 },
      30,
    )

    expect(solution.aimPoint).toEqual({ x: 2, y: 4, z: -25 })
  })
})

function queryWorld(hit: ReturnType<CollisionWorld['raycast']>): CollisionWorld {
  return {
    raycast: () => hit,
    moveAabb: (position, velocity) => ({
      position, velocity, grounded: false, blocked: false,
    }),
  }
}
