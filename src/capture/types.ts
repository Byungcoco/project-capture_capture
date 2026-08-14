import type { TerrainTag } from '../stamp/types'

export interface Vec2 {
  x: number
  y: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface NormalizedFrame {
  center: Vec2
  width: number
  height: number
}

export interface CaptureBox {
  id: string
  center: Vec3
  halfSize: Vec3
  tag: TerrainTag
  capturable?: boolean
}

export type ColumnMajorMatrix4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]
