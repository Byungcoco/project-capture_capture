import type { BoxCollider, Vec2 } from './types'

export const PLAYER_SPAWN: Vec2 = { x: -7, y: 1 }

export interface StageBox {
  id: string
  center: { x: number; y: number; z: number }
  halfSize: { x: number; y: number; z: number }
  tag: 'stone' | 'ice' | 'fire'
  capturable: boolean
}

export const STAGE_BOXES = [
  stageBox('stone-1', -7, -3.5, 2.5, 0.5),
  stageBox('stone-2', -3, -2.5, 1.5, 1.5),
  stageBox('stone-3', 0.5, -3.5, 2, 0.5),
  stageBox('stone-4', 4, -2.75, 1, 1.25),
  stageBox('stone-5', 7, -3.5, 2, 0.5),
] as const satisfies readonly StageBox[]

export const STAGE_COLLIDERS: readonly BoxCollider[] = STAGE_BOXES.map((box) => ({
  type: 'box',
  center: { x: box.center.x, y: box.center.y },
  halfSize: { x: box.halfSize.x, y: box.halfSize.y },
}))

function stageBox(
  id: string,
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
): StageBox {
  return {
    id,
    center: { x, y, z: 0 },
    halfSize: { x: halfWidth, y: halfHeight, z: 1 },
    tag: 'stone',
    capturable: true,
  }
}
