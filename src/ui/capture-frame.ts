import type { NormalizedFrame, Vec2 } from '../capture/types'

export const CAPTURE_FRAME_WIDTH = 0.3
export const CAPTURE_FRAME_HEIGHT = 0.4

export function frameAtPointer(pointer: Vec2): NormalizedFrame {
  return {
    center: {
      x: clamp(pointer.x, CAPTURE_FRAME_WIDTH / 2, 1 - CAPTURE_FRAME_WIDTH / 2),
      y: clamp(pointer.y, CAPTURE_FRAME_HEIGHT / 2, 1 - CAPTURE_FRAME_HEIGHT / 2),
    },
    width: CAPTURE_FRAME_WIDTH,
    height: CAPTURE_FRAME_HEIGHT,
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
