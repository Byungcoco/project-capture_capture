import { describe, expect, it } from 'vitest'

import { stepPlayer } from './player'
import type { PlayerInput, PlayerState } from './player'

const idle: PlayerInput = { moveX: 0, jumpPressed: false }
const moveRight: PlayerInput = { moveX: 1, jumpPressed: false }

const createState = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  position: { x: 0, y: 8 },
  velocity: { x: 0, y: 0 },
  grounded: false,
  ...overrides,
})

describe('stepPlayer', () => {
  it('오른쪽 입력을 유지하면 가속하되 최대 속도를 넘지 않는다', () => {
    let state = createState()

    for (let tick = 0; tick < 120; tick += 1) {
      state = stepPlayer(state, moveRight, [], 1 / 60)
    }

    expect(state.velocity.x).toBeGreaterThan(0)
    expect(state.velocity.x).toBeLessThanOrEqual(6)
    expect(state.velocity.x).toBeCloseTo(6)
  })

  it('공중에서도 수평 입력으로 진행 방향을 바꿀 수 있다', () => {
    let state = createState({ velocity: { x: -2, y: 0 } })

    for (let tick = 0; tick < 20; tick += 1) {
      state = stepPlayer(state, moveRight, [], 1 / 60)
    }

    expect(state.velocity.x).toBeGreaterThan(1)
    expect(state.velocity.x).toBeLessThan(3)
  })

  it('공중에서 입력을 놓으면 수평 속도가 서서히 줄어든다', () => {
    let state = createState({ velocity: { x: 6, y: 0 } })

    for (let tick = 0; tick < 20; tick += 1) {
      state = stepPlayer(state, idle, [], 1 / 60)
    }

    expect(state.velocity.x).toBeCloseTo(10 / 3)
  })

  it('접지 중 입력을 놓으면 수평 관성이 점차 줄어든다', () => {
    const state = createState({
      velocity: { x: 6, y: 0 },
      grounded: true,
    })

    const next = stepPlayer(state, idle, [], 1 / 60)

    expect(next.velocity.x).toBeGreaterThan(0)
    expect(next.velocity.x).toBeLessThan(6)
  })

  it('접지 상태에서 입력을 놓으면 한 틱에 속도 0.6을 줄인다', () => {
    const state = createState({
      velocity: { x: 6, y: 0 },
      grounded: true,
    })

    const next = stepPlayer(state, idle, [], 1 / 60)

    expect(next.velocity.x).toBeCloseTo(5.4)
  })

  it('접지 점프 후 공중에서는 다시 점프하지 않는다', () => {
    const jump: PlayerInput = { moveX: 0, jumpPressed: true }
    const first = stepPlayer(createState({ grounded: true }), jump, [], 1 / 60)
    const second = stepPlayer(first, jump, [], 1 / 60)

    expect(first.velocity.y).toBeGreaterThan(0)
    expect(second.velocity.y).toBeLessThan(first.velocity.y)
  })

  it('같은 초기 상태와 입력 시퀀스는 같은 결과를 만든다', () => {
    const inputs: readonly PlayerInput[] = [
      moveRight,
      moveRight,
      { moveX: -1, jumpPressed: false },
      idle,
    ]
    const simulate = (): PlayerState =>
      inputs.reduce(
        (state, input) => stepPlayer(state, input, [], 1 / 60),
        createState(),
      )

    expect(simulate()).toEqual(simulate())
  })
})
