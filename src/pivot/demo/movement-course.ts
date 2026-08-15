import type { Vec3 } from '../domain/math'
import type { StaticCollider } from '../domain/player'
import { CELL_SIZE, sortTerrainCells } from '../domain/cell-world'
import type { TerrainCell, TerrainMaterial } from '../domain/cell-world'
import { ENEMY_HALF_SIZE, ENEMY_MAX_HP } from '../domain/combat'
import type { EnemyState } from '../domain/combat'

export const MOVEMENT_SPAWN: Readonly<Vec3> = { x: 0, y: 0.9, z: 8 }

export const COMBAT_PLATFORM_CENTERS: readonly Readonly<Vec3>[] = Object.freeze([
  Object.freeze({ x: 5.25, y: 4, z: -9.75 }),
  Object.freeze({ x: -6.75, y: 10, z: -23.75 }),
  Object.freeze({ x: 9.25, y: 17, z: -39.75 }),
  Object.freeze({ x: -5.75, y: 25, z: -57.75 }),
])

const COMBAT_PLATFORM_HALF_SIZES: readonly Readonly<Vec3>[] = [
  { x: 2.75, y: 0.5, z: 3.25 },
  { x: 2.75, y: 0.5, z: 3.25 },
  { x: 2.75, y: 0.5, z: 3.25 },
  { x: 1.75, y: 0.5, z: 4.25 },
]

const COURSE_BOXES: readonly CourseBox[] = [
  box({ x: 0, y: -0.5, z: 6 }, { x: 5, y: 0.5, z: 5 }, false, 'soil'),
  ...COMBAT_PLATFORM_CENTERS.map((center, index) => (
    box(
      { ...center },
      { ...(COMBAT_PLATFORM_HALF_SIZES[index] ?? { x: 2.75, y: 0.5, z: 3.25 }) },
      true,
      'rock',
    )
  )),
]

export const MOVEMENT_ENEMIES: readonly EnemyState[] = Object.freeze(
  COMBAT_PLATFORM_CENTERS.map((platform, index) => Object.freeze({
    id: `enemy-${String(index + 1).padStart(2, '0')}`,
    position: Object.freeze({
      x: platform.x,
      y: platform.y + 1.25,
      z: platform.z,
    }),
    halfSize: ENEMY_HALF_SIZE,
    hp: ENEMY_MAX_HP,
    maxHp: ENEMY_MAX_HP,
    nextShotTick: 30 + index * 35,
    alive: true,
  })),
)

export const MOVEMENT_COURSE: readonly StaticCollider[] = COURSE_BOXES.map((courseBox) => ({
  center: { ...courseBox.center },
  halfSize: { ...courseBox.halfSize },
  wireable: courseBox.wireable,
}))

export const MOVEMENT_TERRAIN: readonly TerrainCell[] = buildTerrain(COURSE_BOXES)

interface CourseBox extends StaticCollider {
  material: TerrainMaterial
}

function box(
  center: Vec3,
  halfSize: Vec3,
  wireable: boolean,
  material: TerrainMaterial,
): CourseBox {
  return { center, halfSize, wireable, material }
}

function buildTerrain(boxes: readonly CourseBox[]): TerrainCell[] {
  const sparse = new Map<string, TerrainCell>()
  for (const courseBox of boxes) {
    const minimum = {
      x: Math.floor((courseBox.center.x - courseBox.halfSize.x) / CELL_SIZE),
      y: Math.floor((courseBox.center.y - courseBox.halfSize.y) / CELL_SIZE),
      z: Math.floor((courseBox.center.z - courseBox.halfSize.z) / CELL_SIZE),
    }
    const maximum = {
      x: Math.ceil((courseBox.center.x + courseBox.halfSize.x) / CELL_SIZE),
      y: Math.ceil((courseBox.center.y + courseBox.halfSize.y) / CELL_SIZE),
      z: Math.ceil((courseBox.center.z + courseBox.halfSize.z) / CELL_SIZE),
    }
    for (let y = minimum.y; y < maximum.y; y += 1) {
      for (let z = minimum.z; z < maximum.z; z += 1) {
        for (let x = minimum.x; x < maximum.x; x += 1) {
          const index = { x, y, z }
          sparse.set(`${x},${y},${z}`, {
            index,
            material: courseBox.material,
            collidable: true,
            wireable: courseBox.wireable,
            capturable: true,
            destructible: true,
            owner: 'level',
          })
        }
      }
    }
  }
  return sortTerrainCells([...sparse.values()])
}
