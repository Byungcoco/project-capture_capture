import type { Vec3 } from '../domain/math'
import type { StaticCollider } from '../domain/player'
import { CELL_SIZE, sortTerrainCells } from '../domain/cell-world'
import type { TerrainCell, TerrainMaterial } from '../domain/cell-world'

export const MOVEMENT_SPAWN: Readonly<Vec3> = { x: 0, y: 0.9, z: 8 }

const COURSE_BOXES: readonly CourseBox[] = [
  box({ x: 0, y: -0.5, z: 6 }, { x: 5, y: 0.5, z: 5 }, false, 'soil'),
  box({ x: 0, y: 0.5, z: -3 }, { x: 4, y: 0.5, z: 3 }, false, 'rock'),
  box({ x: 5.5, y: 2.5, z: -9 }, { x: 3, y: 0.5, z: 3 }, true, 'rock'),
  box({ x: -4.5, y: 5, z: -15 }, { x: 3, y: 0.5, z: 3 }, true, 'rock'),
  box({ x: 0, y: 1.5, z: 0 }, { x: 0.5, y: 1.5, z: 3 }, false, 'wood'),
  box({ x: 4.5, y: 6.5, z: -10 }, { x: 0.5, y: 0.5, z: 0.5 }, true, 'rock'),
  box({ x: -3.5, y: 9, z: -16 }, { x: 0.5, y: 0.5, z: 0.5 }, true, 'rock'),
]

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
