import type { NormalizedFrame, Vec2 } from './types'

type Axis = 'x' | 'y'

export function clipPolygonToFrame(
  polygon: readonly Vec2[],
  frame: NormalizedFrame,
): Vec2[] {
  const left = frame.center.x - frame.width / 2
  const right = frame.center.x + frame.width / 2
  const bottom = frame.center.y - frame.height / 2
  const top = frame.center.y + frame.height / 2

  let output = [...polygon]
  output = clipEdge(output, 'x', left, true)
  output = clipEdge(output, 'x', right, false)
  output = clipEdge(output, 'y', bottom, true)
  output = clipEdge(output, 'y', top, false)
  return output.length >= 3 ? canonicalStart(output) : []
}

function clipEdge(
  polygon: readonly Vec2[],
  axis: Axis,
  boundary: number,
  keepGreater: boolean,
): Vec2[] {
  if (polygon.length === 0) return []

  const output: Vec2[] = []
  let previous = polygon.at(-1)!
  let previousInside = isInside(previous, axis, boundary, keepGreater)

  for (const current of polygon) {
    const currentInside = isInside(current, axis, boundary, keepGreater)
    if (currentInside !== previousInside) {
      output.push(intersection(previous, current, axis, boundary))
    }
    if (currentInside) output.push(current)
    previous = current
    previousInside = currentInside
  }
  return output
}

function isInside(
  point: Vec2,
  axis: Axis,
  boundary: number,
  keepGreater: boolean,
): boolean {
  return keepGreater ? point[axis] >= boundary : point[axis] <= boundary
}

function intersection(start: Vec2, end: Vec2, axis: Axis, boundary: number): Vec2 {
  const delta = end[axis] - start[axis]
  const amount = delta === 0 ? 0 : (boundary - start[axis]) / delta
  return {
    x: axis === 'x' ? boundary : start.x + (end.x - start.x) * amount,
    y: axis === 'y' ? boundary : start.y + (end.y - start.y) * amount,
  }
}

function canonicalStart(polygon: readonly Vec2[]): Vec2[] {
  let firstIndex = 0
  for (let index = 1; index < polygon.length; index += 1) {
    const point = polygon[index]!
    const first = polygon[firstIndex]!
    if (point.x < first.x || (point.x === first.x && point.y < first.y)) {
      firstIndex = index
    }
  }
  return [...polygon.slice(firstIndex), ...polygon.slice(0, firstIndex)]
}
