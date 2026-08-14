import { describe, expect, it } from 'vitest'

import { advanceYawDegrees, createCameraOrbit, orbitPosition } from './camera-orbit'

describe('camera orbit', () => {
  it('각도를 0 이상 360도 미만으로 순환시킨다', () => {
    expect(advanceYawDegrees(350, 1, 20)).toBe(10)
    expect(advanceYawDegrees(10, -1, 20)).toBe(350)
  })

  it('Y축 90도 회전을 월드 위치로 변환한다', () => {
    expect(orbitPosition(90, 10, 4, { x: 0, y: -1, z: 0 })).toEqual({
      x: 10,
      y: 3,
      z: 0,
    })
  })

  it('조준 회전 후 기본 카메라 각도로 즉시 복귀한다', () => {
    const orbit = createCameraOrbit(32)

    orbit.rotate(1, 90)
    expect(orbit.yawDegrees).toBe(122)

    orbit.reset()
    expect(orbit.yawDegrees).toBe(32)
  })
})
