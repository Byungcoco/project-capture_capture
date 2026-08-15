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
    expect(solution.wireAimDirection.x).toBeGreaterThan(0)
    expect(solution.wireAimDirection.y).toBeGreaterThan(0)
    expect(solution.wireAimDirection.z).toBeLessThan(0)
    expect(Math.hypot(
      solution.wireAimDirection.x,
      solution.wireAimDirection.y,
      solution.wireAimDirection.z,
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

    expect(Math.hypot(
      solution.aimPoint.x,
      solution.aimPoint.y - 1.5,
      solution.aimPoint.z,
    )).toBeCloseTo(30, 10)
    expect(solution.aimPoint.x).toBe(2)
    expect(solution.aimPoint.y).toBe(4)
  })

  it('player 기준 24에서 30미터 표면을 shoulder camera 확장 ray로 찾는다', () => {
    const playerOrigin = { x: 0, y: 1.5, z: 0 }
    const cameraOrigin = { x: 0, y: 3, z: 6 }
    const target = { x: 0, y: 1.5, z: -27 }
    const cameraDistance = Math.hypot(
      target.x - cameraOrigin.x,
      target.y - cameraOrigin.y,
      target.z - cameraOrigin.z,
    )
    const queriedDistances: number[] = []
    const world = queryWorld(
      { point: target, distance: cameraDistance, wireable: true },
      queriedDistances,
    )
    const cameraDirection = {
      x: (target.x - cameraOrigin.x) / cameraDistance,
      y: (target.y - cameraOrigin.y) / cameraDistance,
      z: (target.z - cameraOrigin.z) / cameraDistance,
    }

    const solution = solveCameraAim(
      world,
      cameraOrigin,
      cameraDirection,
      playerOrigin,
      30,
    )

    expect(queriedDistances[0]).toBeGreaterThan(cameraDistance)
    expect(solution.aimPoint).toEqual(target)
    expect(Math.hypot(
      target.x - playerOrigin.x,
      target.y - playerOrigin.y,
      target.z - playerOrigin.z,
    )).toBeLessThanOrEqual(30)
  })
})

function queryWorld(
  hit: ReturnType<CollisionWorld['raycast']>,
  distances?: number[],
): CollisionWorld {
  return {
    sweepSphere: () => null,
    raycast: (_origin, _direction, maximumDistance) => {
      distances?.push(maximumDistance)
      return hit === null || hit.distance > maximumDistance ? null : hit
    },
    moveAabb: (position, velocity) => ({
      position, velocity, grounded: false, blocked: false, contacts: [],
    }),
  }
}
