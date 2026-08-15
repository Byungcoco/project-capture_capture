import type { Vec3 } from './math'

export type WireEdge = 'press' | 'release'

export interface PlayerCommand {
  moveX: number
  moveZ: number
  cameraForward: Vec3
  wireAimDirection: Vec3
  jumpPressed: boolean
  dashPressed: boolean
  wireEdges: readonly WireEdge[]
}

export const IDLE_PLAYER_COMMAND: PlayerCommand = {
  moveX: 0,
  moveZ: 0,
  cameraForward: { x: 0, y: 0, z: -1 },
  wireAimDirection: { x: 0, y: 0, z: -1 },
  jumpPressed: false,
  dashPressed: false,
  wireEdges: [],
}
