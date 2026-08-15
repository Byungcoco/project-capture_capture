import type { PlayerCommand } from '../domain/commands'

const MOUSE_SENSITIVITY = 0.0022
const MIN_PITCH = -Math.PI * 0.42
const MAX_PITCH = Math.PI * 0.42

export interface CameraAim {
  yaw: number
  pitch: number
}

export interface BrowserInput {
  sampleCommand(): PlayerCommand
  getCameraAim(): CameraAim
}

export function createBrowserInput(canvas: HTMLCanvasElement): BrowserInput {
  const pressed = new Set<string>()
  let jumpQueued = false
  let dashQueued = false
  let wireQueued = false
  let wireReleased = false
  let yaw = 0
  let pitch = -0.12

  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) {
      void canvas.requestPointerLock().catch(() => undefined)
    }
  })
  window.addEventListener('keydown', (event) => {
    if (isGameKey(event.code)) event.preventDefault()
    pressed.add(event.code)
    if (event.repeat) return
    if (event.code === 'Space') jumpQueued = true
    if (event.code === 'ShiftLeft') dashQueued = true
    if (event.code === 'KeyE') wireQueued = true
  })
  window.addEventListener('keyup', (event) => {
    pressed.delete(event.code)
    if (event.code === 'KeyE') wireReleased = true
  })
  window.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== canvas) return
    yaw -= event.movementX * MOUSE_SENSITIVITY
    pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch - event.movementY * MOUSE_SENSITIVITY))
  })
  window.addEventListener('blur', clearInput)
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) clearInput()
  })

  function clearInput(): void {
    pressed.clear()
    jumpQueued = false
    dashQueued = false
    wireQueued = false
    wireReleased = true
  }

  return {
    sampleCommand(): PlayerCommand {
      const command: PlayerCommand = {
        moveX: Number(pressed.has('KeyD')) - Number(pressed.has('KeyA')),
        moveZ: Number(pressed.has('KeyW')) - Number(pressed.has('KeyS')),
        aimDirection: {
          x: Math.sin(yaw) * Math.cos(pitch),
          y: Math.sin(pitch),
          z: -Math.cos(yaw) * Math.cos(pitch),
        },
        jumpPressed: jumpQueued,
        dashPressed: dashQueued,
        wirePressed: wireQueued,
        wireReleased,
      }
      jumpQueued = false
      dashQueued = false
      wireQueued = false
      wireReleased = false
      return command
    },
    getCameraAim: () => ({ yaw, pitch }),
  }
}

function isGameKey(code: string): boolean {
  return code === 'KeyW'
    || code === 'KeyA'
    || code === 'KeyS'
    || code === 'KeyD'
    || code === 'KeyE'
    || code === 'Space'
    || code === 'ShiftLeft'
}
