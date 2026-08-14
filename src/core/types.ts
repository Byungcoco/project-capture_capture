export interface Vec2 {
  x: number
  y: number
}

export interface BoxCollider {
  type: 'box'
  center: Vec2
  halfSize: Vec2
}

export type Collider = BoxCollider

export interface MotionResult {
  position: Vec2
  velocity: Vec2
  grounded: boolean
}
