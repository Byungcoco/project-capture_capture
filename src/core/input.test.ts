import { describe, expect, it } from 'vitest'

import { createAimInput, createTickInput } from './input'

describe('createTickInput', () => {
  it('A와 D를 동시에 누르면 수평 입력을 상쇄한다', () => {
    expect(createTickInput(new Set(['KeyA', 'KeyD']), false)).toEqual({
      moveX: 0,
      jumpPressed: false,
    })
  })

  it('대기 중인 Space 입력을 한 틱 점프 펄스로 변환한다', () => {
    expect(createTickInput(new Set(['Space']), true)).toEqual({
      moveX: 0,
      jumpPressed: true,
    })
  })
})

describe('createAimInput', () => {
  it('A와 D를 카메라 회전 방향으로 변환한다', () => {
    expect(createAimInput(new Set(['KeyA']))).toEqual({ rotate: -1 })
    expect(createAimInput(new Set(['KeyD']))).toEqual({ rotate: 1 })
    expect(createAimInput(new Set(['KeyA', 'KeyD']))).toEqual({ rotate: 0 })
  })
})
