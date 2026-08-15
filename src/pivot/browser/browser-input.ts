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
  const event = _event
  if (event.type === 'pointer-lock') {
    return event.locked
      ? { ...state, pointerLocked: true }
      : clearTransientState({ ...state, pointerLocked: false })
  }
  if (event.type === 'blur') return clearTransientState(state)
  if (event.type === 'mouse-move') {
    if (!state.pointerLocked) return state
    return {
      ...state,
      yaw: state.yaw + event.movementX * 0.0022,
      pitch: Math.max(
        -Math.PI * 0.42,
        Math.min(Math.PI * 0.42, state.pitch - event.movementY * 0.0022),
      ),
    }
  }

  const pressedCodes = new Set(state.pressedCodes)
  if (event.type === 'key-up') {
    pressedCodes.delete(event.code)
    return {
      ...state,
      pressedCodes,
      wireReleasedQueued: state.wireReleasedQueued || event.code === 'KeyE',
    }
  }
  pressedCodes.add(event.code)
  if (event.repeat) return { ...state, pressedCodes }
  return {
    ...state,
    pressedCodes,
    jumpQueued: state.jumpQueued || event.code === 'Space',
    dashQueued: state.dashQueued || event.code === 'ShiftLeft',
    wirePressedQueued: state.wirePressedQueued || event.code === 'KeyE',
  }
}

export function sampleBrowserInput(state: BrowserInputState, aimDirection: Vec3): BrowserInputSample {
  return {
    state: {
      ...state,
      jumpQueued: false,
      dashQueued: false,
      wirePressedQueued: false,
      wireReleasedQueued: false,
    },
    command: {
      ...IDLE_PLAYER_COMMAND,
      moveX: Number(state.pressedCodes.has('KeyD')) - Number(state.pressedCodes.has('KeyA')),
      moveZ: Number(state.pressedCodes.has('KeyW')) - Number(state.pressedCodes.has('KeyS')),
      aimDirection,
      jumpPressed: state.jumpQueued,
      dashPressed: state.dashQueued,
      wirePressed: state.wirePressedQueued,
      wireReleased: state.wireReleasedQueued,
    },
  }
}

export function createBrowserInput(canvas: HTMLCanvasElement): BrowserInput {
  let state = createBrowserInputState()
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) {
      void canvas.requestPointerLock().catch(() => undefined)
    }
  })
  window.addEventListener('keydown', (event) => {
    if (isGameKey(event.code)) event.preventDefault()
    if (state.pointerLocked) {
      state = reduceBrowserInput(state, {
        type: 'key-down', code: event.code, repeat: event.repeat,
      })
    }
  })
  window.addEventListener('keyup', (event) => {
    state = reduceBrowserInput(state, { type: 'key-up', code: event.code })
  })
  window.addEventListener('mousemove', (event) => {
    state = reduceBrowserInput(state, {
      type: 'mouse-move', movementX: event.movementX, movementY: event.movementY,
    })
  })
  window.addEventListener('blur', () => {
    state = reduceBrowserInput(state, { type: 'blur' })
  })
  document.addEventListener('pointerlockchange', () => {
    state = reduceBrowserInput(state, {
      type: 'pointer-lock', locked: document.pointerLockElement === canvas,
    })
  })
  return {
    sampleCommand(aimDirection): PlayerCommand {
      const sample = sampleBrowserInput(state, aimDirection)
      state = sample.state
      return sample.command
    },
    getState: () => state,
  }
}

function clearTransientState(state: BrowserInputState): BrowserInputState {
  return {
    ...state,
    pressedCodes: new Set(),
    jumpQueued: false,
    dashQueued: false,
    wirePressedQueued: false,
    wireReleasedQueued: true,
  }
}

function isGameKey(code: string): boolean {
  return code === 'KeyW' || code === 'KeyA' || code === 'KeyS'
    || code === 'KeyD' || code === 'KeyE' || code === 'Space'
    || code === 'ShiftLeft'
}
