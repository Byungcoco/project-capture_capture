import { describe, expect, it } from 'vitest'

import { captureBoxes } from './capture'
import { clipPolygonToFrame } from './clip'
import { convexHull } from './hull'
import { projectPoint } from './projection'
import type { CaptureBox, NormalizedFrame, Vec2 } from './types'

const identity = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const

const fullFrame: NormalizedFrame = {
  center: { x: 0.5, y: 0.5 },
  width: 1,
  height: 1,
}

describe('capture geometry', () => {
  it('열 우선 행렬로 점을 화면 정규화 좌표에 투영한다', () => {
    expect(projectPoint({ x: -1, y: 1, z: 0 }, identity)).toEqual({
      x: 0,
      y: 1,
    })
  })

  it('중복점을 제거하고 반시계 방향 볼록 껍질을 만든다', () => {
    const points: Vec2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0.5, y: 0.5 },
      { x: 0, y: 0 },
    ]

    expect(convexHull(points)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ])
  })

  it('폴리곤을 프레임에 클리핑하고 완전 외부는 제거한다', () => {
    const polygon: Vec2[] = [
      { x: 0, y: 0.25 },
      { x: 0.75, y: 0.25 },
      { x: 0.75, y: 0.75 },
      { x: 0, y: 0.75 },
    ]
    const frame: NormalizedFrame = {
      center: { x: 0.5, y: 0.5 },
      width: 0.5,
      height: 0.5,
    }

    expect(clipPolygonToFrame(polygon, frame)).toEqual([
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.25 },
      { x: 0.75, y: 0.75 },
      { x: 0.25, y: 0.75 },
    ])
    expect(
      clipPolygonToFrame(
        [
          { x: 0, y: 0 },
          { x: 0.1, y: 0 },
          { x: 0, y: 0.1 },
        ],
        frame,
      ),
    ).toEqual([])
  })

  it('박스 실루엣을 프레임 로컬 Stamp로 결정론적으로 만든다', () => {
    const boxes: CaptureBox[] = [
      {
        id: 'stone-1',
        center: { x: 0, y: 0, z: 0 },
        halfSize: { x: 0.5, y: 0.5, z: 0.5 },
        tag: 'stone',
      },
    ]

    const first = captureBoxes(boxes, identity, fullFrame)
    const second = captureBoxes(boxes, identity, fullFrame)

    expect(first).toEqual(second)
    expect(first.pieces).toEqual([
      {
        sourceId: 'stone-1',
        tag: 'stone',
        vertices: [
          { x: 0.25, y: 0.25 },
          { x: 0.75, y: 0.25 },
          { x: 0.75, y: 0.75 },
          { x: 0.25, y: 0.75 },
        ],
      },
    ])
  })
})
