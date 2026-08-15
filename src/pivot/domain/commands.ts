import type { Vec3 } from './math'

export type WireEdge = 'press' | 'release'

export interface CaptureBasis {
  right: Vec3
  up: Vec3
  forward: Vec3
}

export interface PlayerCommand {
  moveX: number
  moveZ: number
  cameraForward: Vec3
  wireAimDirection: Vec3
  jumpPressed: boolean
  dashPressed: boolean
  wireEdges: readonly WireEdge[]
  capturePressed: boolean
  captureOrigin: Vec3
  captureDirection: Vec3
  captureBasis: CaptureBasis
}

export const IDLE_PLAYER_COMMAND: PlayerCommand = {
  moveX: 0,
  moveZ: 0,
  cameraForward: { x: 0, y: 0, z: -1 },
  wireAimDirection: { x: 0, y: 0, z: -1 },
  jumpPressed: false,
  dashPressed: false,
  wireEdges: [],
  capturePressed: false,
  captureOrigin: { x: 0, y: 0, z: 0 },
  captureDirection: { x: 0, y: 0, z: -1 },
  captureBasis: {
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
  },
}
