import { describe, expect, it, vi } from 'vitest'

import { createValidationMemo } from './terrain-validation-memo'

describe('terrain validation memo', () => {
  it('검증된 frozen 참조는 재검증하지 않고 mutable 입력은 매번 검증한다', () => {
    const validate = vi.fn<(value: readonly number[]) => void>()
    const memo = createValidationMemo(validate)
    const frozen = Object.freeze([1, 2, 3])
    const mutable = [1, 2, 3]

    memo.assert(frozen)
    memo.assert(frozen)
    expect(validate).toHaveBeenCalledTimes(1)

    memo.assert(mutable)
    memo.assert(mutable)
    expect(validate).toHaveBeenCalledTimes(3)
  })

  it('생성 경계가 표시한 frozen 참조는 첫 hot-path 검증도 생략한다', () => {
    const validate = vi.fn<(value: readonly number[]) => void>()
    const memo = createValidationMemo(validate)
    const frozen = Object.freeze([1, 2, 3])

    memo.markValidated(frozen)
    memo.assert(frozen)

    expect(validate).not.toHaveBeenCalled()
  })
})
