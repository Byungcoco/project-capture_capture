import type { BoxCollider, Vec2 } from './types'

export const PLAYER_SPAWN: Vec2 = { x: -7, y: 1 }

export const STAGE_COLLIDERS = [
  {
    type: 'box',
    center: { x: -7, y: -3.5 },
    halfSize: { x: 2.5, y: 0.5 },
  },
  {
    type: 'box',
    center: { x: -3, y: -2.5 },
    halfSize: { x: 1.5, y: 1.5 },
  },
  {
    type: 'box',
    center: { x: 0.5, y: -3.5 },
    halfSize: { x: 2, y: 0.5 },
  },
  {
    type: 'box',
    center: { x: 4, y: -2.75 },
    halfSize: { x: 1, y: 1.25 },
  },
  {
    type: 'box',
    center: { x: 7, y: -3.5 },
    halfSize: { x: 2, y: 0.5 },
  },
] as const satisfies readonly BoxCollider[]
