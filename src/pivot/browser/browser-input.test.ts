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

  it('E press와 release edge를 한 tick에 함께 전달하고 한 번만 소비한다', () => {
    let state = createBrowserInputState()
    state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyE', repeat: false })
    state = reduceBrowserInput(state, { type: 'key-up', code: 'KeyE' })
    const first = sampleBrowserInput(state, FORWARD)
    const second = sampleBrowserInput(first.state, FORWARD)

    expect(first.command.wirePressed).toBe(true)
    expect(first.command.wireReleased).toBe(true)
    expect(second.command.wirePressed).toBe(false)
    expect(second.command.wireReleased).toBe(false)
  })

  it('pointer lock 해제와 blur는 이동을 지우고 재진입 뒤 새 입력만 받는다', () => {
    let state = createBrowserInputState()
    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
    state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyW', repeat: false })
    expect(sampleBrowserInput(state, FORWARD).command.moveZ).toBe(1)

    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: false })
    expect(sampleBrowserInput(state, FORWARD).command.moveZ).toBe(0)

    state = reduceBrowserInput(state, { type: 'pointer-lock', locked: true })
    state = reduceBrowserInput(state, { type: 'key-down', code: 'KeyD', repeat: false })
    expect(sampleBrowserInput(state, FORWARD).command.moveX).toBe(1)

    state = reduceBrowserInput(state, { type: 'blur' })
    const blurred = sampleBrowserInput(state, FORWARD).command
    expect(blurred.moveX).toBe(0)
    expect(blurred.moveZ).toBe(0)
  })
})
