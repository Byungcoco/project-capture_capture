import type { GameModeState } from './game-mode'
import type { PlayerInput, PlayerState } from './player'
import { stepPlayer } from './player'
import type { Collider } from './types'

export interface SessionState {
  gameMode: GameModeState
  player: PlayerState
}

export function stepSession(
  state: SessionState,
  playerInput: PlayerInput,
  colliders: readonly Collider[],
  stepSeconds: number,
): SessionState {
  if (state.gameMode.mode !== 'platform') return state

  return {
    ...state,
    player: stepPlayer(state.player, playerInput, colliders, stepSeconds),
  }
}
