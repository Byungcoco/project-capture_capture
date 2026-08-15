import type { Vec3 } from './math'
import { createAabbCollisionWorld } from './aabb-collision-world'
import type { CollisionWorld } from './collision-world'

export const CELL_SIZE = 0.5

export type TerrainMaterial = 'soil' | 'rock' | 'wood' | 'water'
export type TerrainOwner = 'level' | 'player' | 'boss'
export type TerrainValidationErrorCode = 'INVALID_CELL_INDEX' | 'DUPLICATE_CELL_KEY'

export class TerrainValidationError extends Error {
  constructor(
    public readonly code: TerrainValidationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'TerrainValidationError'
  }
}

export interface CellIndex {
  x: number
  y: number
  z: number
}

export interface TerrainCell {
  index: CellIndex
  material: TerrainMaterial
  collidable: boolean
  wireable: boolean
  capturable: boolean
  destructible: boolean
  owner: TerrainOwner
  chunkId?: string
}

export function cellKey(index: CellIndex): string {
  return `${index.x},${index.y},${index.z}`
}

export function worldToCellIndex(position: Vec3): CellIndex {
  return {
    x: Math.floor(position.x / CELL_SIZE),
    y: Math.floor(position.y / CELL_SIZE),
    z: Math.floor(position.z / CELL_SIZE),
  }
}

export function cellCenter(index: CellIndex): Vec3 {
  return {
    x: (index.x + 0.5) * CELL_SIZE,
    y: (index.y + 0.5) * CELL_SIZE,
    z: (index.z + 0.5) * CELL_SIZE,
  }
}

export function sortTerrainCells(cells: readonly TerrainCell[]): TerrainCell[] {
  return [...cells].sort(compareCellIndices)
}

export function compareCellIndices(first: TerrainCell, second: TerrainCell): number {
  return first.index.y - second.index.y
    || first.index.z - second.index.z
    || first.index.x - second.index.x
}

export function createCellCollisionWorld(terrain: readonly TerrainCell[]): CollisionWorld {
  return createAabbCollisionWorld(terrain
    .filter((cell) => cell.collidable)
    .map((cell) => ({
      center: cellCenter(cell.index),
      halfSize: { x: CELL_SIZE / 2, y: CELL_SIZE / 2, z: CELL_SIZE / 2 },
      wireable: cell.wireable,
    })))
}
