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

  it('신뢰 조건을 만족한 frozen 참조만 hot-path 검증을 생략한다', () => {
    const validate = vi.fn<(value: readonly object[]) => void>()
    const memo = createValidationMemo(
      validate,
      (value) => Object.isFrozen(value) && value.every(Object.isFrozen),
    )
    const shallowFrozen = Object.freeze([{}])
    const deepFrozen = Object.freeze([Object.freeze({})])

    memo.assert(shallowFrozen)
    memo.assert(shallowFrozen)
    memo.assert(deepFrozen)
    memo.assert(deepFrozen)

    expect(validate).toHaveBeenCalledTimes(3)
  })
})
