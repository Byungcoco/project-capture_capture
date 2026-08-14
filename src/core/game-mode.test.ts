import { describe, expect, it } from 'vitest'

import { createGameModeState, transitionGameMode } from './game-mode'

describe('transitionGameMode', () => {
  it('CaptureAim 진입 시 첫 빈 슬롯을 자동 선택한다', () => {
    const next = transitionGameMode(
      createGameModeState(),
      { type: 'enter-capture-aim' },
      [true, false, false],
    )

    expect(next).toEqual({ mode: 'capture-aim', selectedSlot: 1 })
  })

  it('모든 슬롯이 차 있으면 3번 슬롯을 기본 선택한다', () => {
    const next = transitionGameMode(
      createGameModeState(),
      { type: 'enter-capture-aim' },
      [true, true, true],
    )

    expect(next.selectedSlot).toBe(2)
  })

  it('CaptureAim에서 슬롯을 직접 선택하고 캡처하면 Paste로 전환한다', () => {
    const aiming = transitionGameMode(
      { mode: 'capture-aim', selectedSlot: 0 },
      { type: 'select-slot', slot: 2 },
      [false, false, false],
    )
    const paste = transitionGameMode(
      aiming,
      { type: 'confirm-capture' },
      [false, false, false],
    )

    expect(paste).toEqual({ mode: 'paste', selectedSlot: 2 })
  })

  it('CaptureAim 취소와 Paste 버리기는 Platform으로 복귀한다', () => {
    expect(
      transitionGameMode(
        { mode: 'capture-aim', selectedSlot: 1 },
        { type: 'cancel-capture' },
        [false, false, false],
      ).mode,
    ).toBe('platform')
    expect(
      transitionGameMode(
        { mode: 'paste', selectedSlot: 1 },
        { type: 'discard-stamp' },
        [false, false, false],
      ).mode,
    ).toBe('platform')
  })
})
