import type { Collider, MotionResult, Vec2 } from './types'

export function resolvePlayerMotion(
  position: Vec2,
  velocity: Vec2,
  halfSize: Vec2,
  colliders: readonly Collider[],
  stepSeconds: number,
): MotionResult {
  let x = position.x + velocity.x * stepSeconds
  let collidedHorizontally = false

  for (const collider of colliders) {
    const verticalOverlap =
      Math.abs(position.y - collider.center.y) <
      halfSize.y + collider.halfSize.y
    if (!verticalOverlap) continue

    const colliderLeft = collider.center.x - collider.halfSize.x
    const colliderRight = collider.center.x + collider.halfSize.x
    const playerLeft = position.x - halfSize.x
    const playerRight = position.x + halfSize.x
    const nextLeft = x - halfSize.x
    const nextRight = x + halfSize.x

    if (
      velocity.x > 0 &&
      playerRight <= colliderLeft &&
      nextRight >= colliderLeft
    ) {
      x = Math.min(x, colliderLeft - halfSize.x)
      collidedHorizontally = true
    } else if (
      velocity.x < 0 &&
      playerLeft >= colliderRight &&
      nextLeft <= colliderRight
    ) {
      x = Math.max(x, colliderRight + halfSize.x)
      collidedHorizontally = true
    }
  }

  let y = position.y + velocity.y * stepSeconds
  let collidedVertically = false
  let grounded = false

  for (const collider of colliders) {
    const horizontalOverlap =
      Math.abs(x - collider.center.x) < halfSize.x + collider.halfSize.x
    if (!horizontalOverlap) continue

    const colliderBottom = collider.center.y - collider.halfSize.y
    const colliderTop = collider.center.y + collider.halfSize.y
    const playerBottom = position.y - halfSize.y
    const playerTop = position.y + halfSize.y
    const nextBottom = y - halfSize.y
    const nextTop = y + halfSize.y

    if (
      velocity.y < 0 &&
      playerBottom >= colliderTop &&
      nextBottom <= colliderTop
    ) {
      y = Math.max(y, colliderTop + halfSize.y)
      collidedVertically = true
      grounded = true
    } else if (
      velocity.y > 0 &&
      playerTop <= colliderBottom &&
      nextTop >= colliderBottom
    ) {
      y = Math.min(y, colliderBottom - halfSize.y)
      collidedVertically = true
    }
  }

  return {
    position: { x, y },
    velocity: {
      x: collidedHorizontally ? 0 : velocity.x,
      y: collidedVertically ? 0 : velocity.y,
    },
    grounded,
  }
}
