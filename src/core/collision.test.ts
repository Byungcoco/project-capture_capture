import { describe, expect, it } from 'vitest'

import { resolvePlayerMotion } from './collision'
import type { BoxCollider } from './types'

const floor: BoxCollider = {
  type: 'box',
  center: { x: 0, y: 0 },
  halfSize: { x: 4, y: 0.5 },
}

describe('resolvePlayerMotion', () => {
  it('낙하 중 바닥을 통과하지 않고 접지한다', () => {
    const result = resolvePlayerMotion(
      { x: 0, y: 2 },
      { x: 0, y: -5 },
      { x: 0.5, y: 0.5 },
      [floor],
      0.5,
    )

    expect(result.position).toEqual({ x: 0, y: 1 })
    expect(result.velocity).toEqual({ x: 0, y: 0 })
    expect(result.grounded).toBe(true)
  })

  it('수평 이동 중 벽을 통과하지 않는다', () => {
    const wall: BoxCollider = {
      type: 'box',
      center: { x: 2, y: 1 },
      halfSize: { x: 0.5, y: 2 },
    }

    const result = resolvePlayerMotion(
      { x: 0, y: 1 },
      { x: 10, y: 0 },
      { x: 0.5, y: 0.5 },
      [wall],
      0.2,
    )

    expect(result.position).toEqual({ x: 1, y: 1 })
    expect(result.velocity.x).toBe(0)
  })

  it('왼쪽으로 이동할 때도 벽을 통과하지 않는다', () => {
    const wall: BoxCollider = {
      type: 'box',
      center: { x: -2, y: 1 },
      halfSize: { x: 0.5, y: 2 },
    }

    const result = resolvePlayerMotion(
      { x: 0, y: 1 },
      { x: -10, y: 0 },
      { x: 0.5, y: 0.5 },
      [wall],
      0.2,
    )

    expect(result.position).toEqual({ x: -1, y: 1 })
    expect(result.velocity.x).toBe(0)
  })

  it('상승 중 천장을 통과하지 않는다', () => {
    const ceiling: BoxCollider = {
      type: 'box',
      center: { x: 0, y: 3 },
      halfSize: { x: 2, y: 0.5 },
    }

    const result = resolvePlayerMotion(
      { x: 0, y: 1 },
      { x: 0, y: 10 },
      { x: 0.5, y: 0.5 },
      [ceiling],
      0.2,
    )

    expect(result.position).toEqual({ x: 0, y: 2 })
    expect(result.velocity.y).toBe(0)
  })

  it('콜라이더 배열 순서와 무관하게 가장 가까운 벽에서 멈춘다', () => {
    const farWall: BoxCollider = {
      type: 'box',
      center: { x: 5, y: 1 },
      halfSize: { x: 0.5, y: 2 },
    }
    const nearWall: BoxCollider = {
      type: 'box',
      center: { x: 2, y: 1 },
      halfSize: { x: 0.5, y: 2 },
    }

    const result = resolvePlayerMotion(
      { x: 0, y: 1 },
      { x: 10, y: 0 },
      { x: 0.5, y: 0.5 },
      [farWall, nearWall],
      1,
    )

    expect(result.position).toEqual({ x: 1, y: 1 })
  })
})
