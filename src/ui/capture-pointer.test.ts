import { describe, expect, it } from 'vitest'

import { createCapturePointer } from './capture-pointer'

describe('createCapturePointer', () => {
  it('Platform에서 움직인 최신 포인터를 CaptureAim 진입 프레임에 사용한다', () => {
    const pointer = createCapturePointer({ x: 0.5, y: 0.5 })

    pointer.move({ x: 0.8, y: 0.7 })

    expect(pointer.frameForCaptureAim()).toEqual({
      center: { x: 0.8, y: 0.7 },
      width: 0.3,
      height: 0.4,
    })
  })

  it('CaptureAim 진입 이벤트의 현재 포인터가 이전 위치보다 우선한다', () => {
    const pointer = createCapturePointer({ x: 0.8, y: 0.7 })

    expect(pointer.frameForCaptureAim({ x: 0.2, y: 0.6 }).center).toEqual({
      x: 0.2,
      y: 0.6,
    })
  })
})
