import type { PlayerInput } from './player'

export function createTickInput(
  pressedCodes: ReadonlySet<string>,
  jumpQueued: boolean,
): PlayerInput {
  const left = pressedCodes.has('KeyA') ? 1 : 0
  const right = pressedCodes.has('KeyD') ? 1 : 0

  return {
    moveX: (right - left) as PlayerInput['moveX'],
    jumpPressed: jumpQueued,
  }
}
