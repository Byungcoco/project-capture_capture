import { describe, expect, it } from 'vitest'

import { createAabbCollisionWorld } from './aabb-collision-world'
import type { CollisionWorld } from './collision-world'
import type { Vec3 } from './math'
import type { StaticCollider } from './player'

interface CandidateWorld extends CollisionWorld {
  queryWireCandidates?: (
    origin: Vec3,
    aimDirection: Vec3,
    maximumDistance: number,
  ) => readonly { point: Vec3; wireable: boolean }[]
}

describe('AABB wire assist query', () => {
  it('결정론적인 collider 표면 후보를 제공한다', () => {
    const collider: StaticCollider = {
      center: { x: 8, y: 2, z: 1 },
      halfSize: { x: 0.5, y: 1, z: 0.5 },
      wireable: true,
    }
    const world = createAabbCollisionWorld([collider]) as CandidateWorld

    expect(typeof world.queryWireCandidates).toBe('function')
    const candidates = world.queryWireCandidates?.(
      { x: 0, y: 1.5, z: 0 },
      { x: 1, y: 0, z: 0 },
      30,
    ) ?? []

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every(({ point }) => pointOnSurface(point, collider))).toBe(true)
    expect(candidates.every(({ wireable }) => wireable)).toBe(true)
  })
})

function pointOnSurface(point: Vec3, collider: StaticCollider): boolean {
  const inside = (['x', 'y', 'z'] as const).every((axis) => (
    point[axis] >= collider.center[axis] - collider.halfSize[axis] - 1e-10
    && point[axis] <= collider.center[axis] + collider.halfSize[axis] + 1e-10
  ))
  const onFace = (['x', 'y', 'z'] as const).some((axis) => (
    Math.abs(Math.abs(point[axis] - collider.center[axis]) - collider.halfSize[axis]) <= 1e-10
  ))
  return inside && onFace
}
