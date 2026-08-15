import { IDLE_PLAYER_COMMAND } from '../domain/commands'
import type { PlayerCommand } from '../domain/commands'
import type { Vec3 } from '../domain/math'

export type BrowserInputEvent =
  | { type: 'key-down'; code: string; repeat: boolean }
  | { type: 'key-up'; code: string }
  | { type: 'mouse-move'; movementX: number; movementY: number }
  | { type: 'pointer-lock'; locked: boolean }
  | { type: 'blur' }

export interface BrowserInputState {
  pressedCodes: ReadonlySet<string>
  yaw: number
  pitch: number
  pointerLocked: boolean
  jumpQueued: boolean
  dashQueued: boolean
  wirePressedQueued: boolean
  wireReleasedQueued: boolean
}

export interface BrowserInputSample {
  state: BrowserInputState
  command: PlayerCommand
}

export interface BrowserInput {
  sampleCommand(aimDirection: Vec3): PlayerCommand
  getState(): BrowserInputState
}

export function createBrowserInputState(): BrowserInputState {
  return {
    pressedCodes: new Set(), yaw: 0, pitch: 0, pointerLocked: false,
    jumpQueued: false, dashQueued: false,
    wirePressedQueued: false, wireReleasedQueued: false,
  }
}

export function reduceBrowserInput(state: BrowserInputState, _event: BrowserInputEvent): BrowserInputState {
  return state
}

export function sampleBrowserInput(state: BrowserInputState, aimDirection: Vec3): BrowserInputSample {
  return { state, command: { ...IDLE_PLAYER_COMMAND, aimDirection } }
}

export function createBrowserInput(_canvas: HTMLCanvasElement): BrowserInput {
  let state = createBrowserInputState()
  return {
    sampleCommand(aimDirection): PlayerCommand {
      const sample = sampleBrowserInput(state, aimDirection)
      state = sample.state
      return sample.command
    },
    getState: () => state,
  }
}
