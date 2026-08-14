import type { NormalizedFrame, Vec2 } from '../capture/types'
import { frameAtPointer } from './capture-frame'

export interface CapturePointer {
  move: (position: Vec2) => void
  frameForCaptureAim: (entryPosition?: Vec2) => NormalizedFrame
}

export function createCapturePointer(initialPosition: Vec2): CapturePointer {
  let latestPosition = initialPosition
  return {
    move: (position) => {
      latestPosition = position
    },
    frameForCaptureAim: (entryPosition) => {
      if (entryPosition !== undefined) latestPosition = entryPosition
      return frameAtPointer(latestPosition)
    },
  }
}
