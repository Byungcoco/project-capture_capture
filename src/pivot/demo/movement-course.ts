import type { Vec3 } from '../domain/math'
import type { StaticCollider } from '../domain/player'

export const MOVEMENT_SPAWN: Readonly<Vec3> = { x: 0, y: 0.9, z: 8 }

export const MOVEMENT_COURSE: readonly StaticCollider[] = [
  box({ x: 0, y: -0.5, z: 6 }, { x: 5, y: 0.5, z: 5 }, false),
  box({ x: 0, y: 0.5, z: -3 }, { x: 4, y: 0.5, z: 3 }, false),
  box({ x: 5.5, y: 2.5, z: -9 }, { x: 3, y: 0.5, z: 3 }, true),
  box({ x: -4.5, y: 5, z: -15 }, { x: 3, y: 0.5, z: 3 }, true),
  box({ x: 0, y: 1.5, z: 0 }, { x: 0.4, y: 1.5, z: 3 }, false),
  box({ x: 4.5, y: 6.5, z: -10 }, { x: 0.5, y: 0.5, z: 0.5 }, true),
  box({ x: -3.5, y: 9, z: -16 }, { x: 0.5, y: 0.5, z: 0.5 }, true),
]

function box(center: Vec3, halfSize: Vec3, wireable: boolean): StaticCollider {
  return { center, halfSize, wireable }
}
