export type GameMode = 'platform' | 'capture-aim' | 'paste'
export type StampSlotIndex = 0 | 1 | 2
export type SlotOccupancy = readonly [boolean, boolean, boolean]

export interface GameModeState {
  mode: GameMode
  selectedSlot: StampSlotIndex
}

export type GameModeCommand =
  | { type: 'enter-capture-aim' }
  | { type: 'select-slot'; slot: StampSlotIndex }
  | { type: 'cancel-capture' }
  | { type: 'confirm-capture' }
  | { type: 'discard-stamp' }

export function createGameModeState(): GameModeState {
  return { mode: 'platform', selectedSlot: 0 }
}

export function transitionGameMode(
  state: GameModeState,
  command: GameModeCommand,
  occupiedSlots: SlotOccupancy,
): GameModeState {
  if (state.mode === 'platform' && command.type === 'enter-capture-aim') {
    return {
      mode: 'capture-aim',
      selectedSlot: firstEmptySlot(occupiedSlots),
    }
  }

  if (state.mode === 'capture-aim') {
    if (command.type === 'select-slot') {
      return { ...state, selectedSlot: command.slot }
    }
    if (command.type === 'cancel-capture') {
      return { ...state, mode: 'platform' }
    }
    if (command.type === 'confirm-capture') {
      return { ...state, mode: 'paste' }
    }
  }

  if (state.mode === 'paste' && command.type === 'discard-stamp') {
    return { ...state, mode: 'platform' }
  }

  return state
}

function firstEmptySlot(occupiedSlots: SlotOccupancy): StampSlotIndex {
  const emptyIndex = occupiedSlots.findIndex((occupied) => !occupied)
  return emptyIndex === -1 ? 2 : (emptyIndex as StampSlotIndex)
}
