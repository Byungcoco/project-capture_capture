import { describe, expect, it } from 'vitest'

import { createBrowserInputState, reduceBrowserInput, sampleBrowserInput } from './browser-input'
import type { BrowserInputEvent } from './browser-input'

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
    state = reduceBrowserInput(state, {
      type: 'mouse-down',
      button: 2,
    } as unknown as BrowserInputEvent)

    const first = sampleBrowserInput(state, FORWARD, FORWARD)
    const second = sampleBrowserInput(first.state, FORWARD, FORWARD)

    expect(first.command.capturePressed).toBe(true)
    expect(second.command.capturePressed).toBe(false)
  })
})
