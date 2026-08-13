import { describe, expect, it } from 'vitest'

import { advanceFixedStep } from './fixed-step-loop'

describe('advanceFixedStep', () => {
  it('누적된 프레임 시간을 60Hz 고정 틱으로만 소비한다', () => {
    const stepSeconds = 1 / 60
    const result = advanceFixedStep(stepSeconds * 2.5, stepSeconds)

    expect(result).toEqual({
      steps: 2,
      remainderSeconds: stepSeconds * 0.5,
      alpha: 0.5,
    })
  })

  it('긴 프레임에서도 최대 틱 수를 넘기지 않는다', () => {
    const stepSeconds = 1 / 60
    const result = advanceFixedStep(stepSeconds * 20, stepSeconds, 5)

    expect(result).toEqual({
      steps: 5,
      remainderSeconds: 0,
      alpha: 0,
    })
  })
})
