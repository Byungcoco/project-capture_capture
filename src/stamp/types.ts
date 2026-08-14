export type TerrainTag = 'stone' | 'ice' | 'fire'

export interface StampPoint {
  x: number
  y: number
}

export interface StampPiece {
  sourceId: string
  tag: TerrainTag
  vertices: readonly StampPoint[]
}

export interface Stamp {
  pieces: readonly StampPiece[]
}
