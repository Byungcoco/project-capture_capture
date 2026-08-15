import { describe, expect, it } from 'vitest'

import { createBrowserInputState, reduceBrowserInput, sampleBrowserInput } from './browser-input'

const FORWARD = { x: 0, y: 0, z: -1 }

describe('피벗 브라우저 입력 adapter', () => {
  it('오른쪽 mouse movementX는 yaw와 전방 X를 양수로 만든다', () => {
    let state = createBrowserInputState()
    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
    state = reduceBrowserInput(state, {
      type: 'mouse-move', movementX: 20, movementY: 0,
    })

    expect(state.yaw).toBeGreaterThan(0)
    expect(Math.sin(state.yaw)).toBeGreaterThan(0)
  })

  it('E press 다음 release 순서를 보존하고 한 번만 소비한다', () => {
    let state = createBrowserInputState()
    state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyE', repeat: false })
    state = reduceBrowserInput(state, { type: 'key-up', code: 'KeyE' })
    const first = sampleBrowserInput(state, FORWARD, FORWARD)
    const second = sampleBrowserInput(first.state, FORWARD, FORWARD)

    expect(first.command.wireEdges).toEqual(['press', 'release'])
    expect(first.command).not.toHaveProperty('wirePressed')
    expect(first.command).not.toHaveProperty('wireReleased')
    expect(second.command.wireEdges).toEqual([])
  })

  it('E release 다음 press 순서를 보존한다', () => {
    let state = createBrowserInputState()
    state = reduceBrowserInput(state, { type: 'key-up', code: 'KeyE' })
    state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyE', repeat: false })

    const sample = sampleBrowserInput(state, FORWARD, FORWARD)

    expect(sample.command.wireEdges).toEqual(['release', 'press'])
  })

  it('pointer lock 해제와 blur는 이동을 지우고 재진입 뒤 새 입력만 받는다', () => {
    let state = createBrowserInputState()
    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
    state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyW', repeat: false })
    expect(sampleBrowserInput(state, FORWARD, FORWARD).command.moveZ).toBe(1)

    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: false })
    expect(sampleBrowserInput(state, FORWARD, FORWARD).command.moveZ).toBe(0)

    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
    state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyD', repeat: false })
    expect(sampleBrowserInput(state, FORWARD, FORWARD).command.moveX).toBe(1)

    state = reduceBrowserInput(state, { type: 'blur' })
    const blurred = sampleBrowserInput(state, FORWARD, FORWARD).command
    expect(blurred.moveX).toBe(0)
    expect(blurred.moveZ).toBe(0)
  })

  it('오른쪽 클릭 capture edge를 한 번만 소비한다', () => {
    let state = createBrowserInputState()
    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
    state = reduceBrowserInput(state, {
      type: 'mouse-down',
      button: 2,
    })

    const first = sampleBrowserInput(state, FORWARD, FORWARD)
    const second = sampleBrowserInput(first.state, FORWARD, FORWARD)

    expect(first.command.capturePressed).toBe(true)
    expect(second.command.capturePressed).toBe(false)
  })

  it('capture edge는 lock 밖에서 무시하고 무틱 frame에 보존하며 unlock blur에서 지운다', () => {
    let state = createBrowserInputState()
    state = reduceBrowserInput(state, { type: 'mouse-down', button: 2 })
    expect(sampleBrowserInput(state, FORWARD, FORWARD).command.capturePressed).toBe(false)

    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
    state = reduceBrowserInput(state, { type: 'mouse-down', button: 2 })
    state = reduceBrowserInput(state, { type: 'mouse-move', movementX: 0, movementY: 0 })
    const firstTick = sampleBrowserInput(state, FORWARD, FORWARD)
    const secondTick = sampleBrowserInput(firstTick.state, FORWARD, FORWARD)
    expect(firstTick.command.capturePressed).toBe(true)
    expect(secondTick.command.capturePressed).toBe(false)

    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: false })
    expect(sampleBrowserInput(state, FORWARD, FORWARD).command.capturePressed).toBe(false)
    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
    state = reduceBrowserInput(state, { type: 'mouse-down', button: 2 })
    state = reduceBrowserInput(state, { type: 'blur' })
    expect(sampleBrowserInput(state, FORWARD, FORWARD).command.capturePressed).toBe(false)
  })

  it('Q hold와 단일 release edge를 내보내고 key repeat는 transaction을 늘리지 않는다', () => {
    let state = createBrowserInputState()
    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
    state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyQ', repeat: false })
    state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyQ', repeat: true })

    const held = sampleBrowserInput(state, FORWARD, FORWARD)
    expect(held.command.placeHeld).toBe(true)
    expect(held.command.placeReleased).toBe(false)

    state = reduceBrowserInput(held.state, { type: 'key-up', code: 'KeyQ' })
    const released = sampleBrowserInput(state, FORWARD, FORWARD)
    const consumed = sampleBrowserInput(released.state, FORWARD, FORWARD)
    expect(released.command.placeHeld).toBe(false)
    expect(released.command.placeReleased).toBe(true)
    expect(consumed.command.placeReleased).toBe(false)
  })

  it('Q hold와 release queue는 pointer unlock 및 blur에서 사라진다', () => {
    for (const clearEvent of [
      { type: 'pointer-lock', locked: false } as const,
      { type: 'blur' } as const,
    ]) {
      let state = createBrowserInputState()
      state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
      state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyQ', repeat: false })
      state = reduceBrowserInput(state, { type: 'key-up', code: 'KeyQ' })
      state = reduceBrowserInput(state, clearEvent)

      const sample = sampleBrowserInput(state, FORWARD, FORWARD)
      expect(sample.command.placeHeld).toBe(false)
      expect(sample.command.placeReleased).toBe(false)
    }
  })

  it('sample 전 서로 다른 Q release cycle은 tick마다 하나씩 보존한다', () => {
    let state = createBrowserInputState()
    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
    for (let cycle = 0; cycle < 2; cycle += 1) {
      state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyQ', repeat: false })
      state = reduceBrowserInput(state, { type: 'key-up', code: 'KeyQ' })
    }

    const first = sampleBrowserInput(state, FORWARD, FORWARD)
    const second = sampleBrowserInput(first.state, FORWARD, FORWARD)
    const third = sampleBrowserInput(second.state, FORWARD, FORWARD)

    expect(first.command.placeReleased).toBe(true)
    expect(second.command.placeReleased).toBe(true)
    expect(third.command.placeReleased).toBe(false)
  })
})
