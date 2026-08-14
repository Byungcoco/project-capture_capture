import type { Stamp, StampPiece } from '../stamp/types'
import { clipPolygonToFrame } from './clip'
import { convexHull } from './hull'
import { projectPoint } from './projection'
import type {
  CaptureBox,
  ColumnMajorMatrix4,
  NormalizedFrame,
  Vec3,
} from './types'

export function captureBoxes(
  boxes: readonly CaptureBox[],
  viewProjection: ColumnMajorMatrix4,
  frame: NormalizedFrame,
): Stamp {
  const pieces: StampPiece[] = []

  for (const box of boxes) {
    if (box.capturable === false) continue
    const projected = boxVertices(box)
      .map((point) => projectPoint(point, viewProjection))
      .filter((point) => point !== null)
    if (projected.length < 3) continue

    const clipped = clipPolygonToFrame(convexHull(projected), frame)
    if (clipped.length < 3) continue

    pieces.push({
      sourceId: box.id,
      tag: box.tag,
      vertices: clipped.map((point) => ({
        x: (point.x - (frame.center.x - frame.width / 2)) / frame.width,
        y: (point.y - (frame.center.y - frame.height / 2)) / frame.height,
      })),
    })
  }

  return { pieces }
}

function boxVertices(box: CaptureBox): Vec3[] {
  const vertices: Vec3[] = []
  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      for (const zSign of [-1, 1]) {
        vertices.push({
          x: box.center.x + box.halfSize.x * xSign,
          y: box.center.y + box.halfSize.y * ySign,
          z: box.center.z + box.halfSize.z * zSign,
        })
      }
    }
  }
  return vertices
}
