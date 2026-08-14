import type { ColumnMajorMatrix4, Vec2, Vec3 } from './types'

export function projectPoint(
  point: Vec3,
  matrix: ColumnMajorMatrix4,
): Vec2 | null {
  const clipX =
    matrix[0] * point.x +
    matrix[4] * point.y +
    matrix[8] * point.z +
    matrix[12]
  const clipY =
    matrix[1] * point.x +
    matrix[5] * point.y +
    matrix[9] * point.z +
    matrix[13]
  const clipW =
    matrix[3] * point.x +
    matrix[7] * point.y +
    matrix[11] * point.z +
    matrix[15]

  if (clipW <= 0) return null

  return {
    x: (clipX / clipW + 1) / 2,
    y: (clipY / clipW + 1) / 2,
  }
}
