import { describe, expect, it } from 'vitest'

import { CAPTURE_FRAME_HEIGHT, CAPTURE_FRAME_WIDTH, frameAtPointer } from './capture-frame'

describe('frameAtPointer', () => {
  it('뷰포트 30% 곱하기 40% 프레임을 만든다', () => {
    expect(frameAtPointer({ x: 0.5, y: 0.5 })).toEqual({
      center: { x: 0.5, y: 0.5 },
      width: CAPTURE_FRAME_WIDTH,
      height: CAPTURE_FRAME_HEIGHT,
    })
  })

  it('프레임 전체가 화면 안에 있도록 중심을 제한한다', () => {
    expect(frameAtPointer({ x: 0, y: 1 }).center).toEqual({ x: 0.15, y: 0.8 })
    expect(frameAtPointer({ x: 1, y: 0 }).center).toEqual({ x: 0.85, y: 0.2 })
  })
})
