import './style.css'

import { captureBoxes } from './capture/capture'
import { MAX_STEPS_PER_FRAME, TICK_SECONDS } from './core/constants'
import { advanceFixedStep } from './core/fixed-step-loop'
import {
  createGameModeState,
  transitionGameMode,
} from './core/game-mode'
import type { SlotOccupancy, StampSlotIndex } from './core/game-mode'
import { createAimInput, createTickInput } from './core/input'
import type { PlayerState } from './core/player'
import { stepSession } from './core/session'
import { PLAYER_SPAWN, STAGE_BOXES, STAGE_COLLIDERS } from './core/stage'
import type { Vec2 } from './core/types'
import { createGameScene } from './render/scene'
import type { Stamp } from './stamp/types'
import { createGameUi } from './ui/game-ui'

const app = document.querySelector<HTMLElement>('#app')

if (app === null) {
  throw new Error('게임 루트 요소를 찾을 수 없습니다.')
}

const gameScene = createGameScene(app)
const gameUi = createGameUi(app)
const pressedCodes = new Set<string>()
const stampSlots: [Stamp | null, Stamp | null, Stamp | null] = [null, null, null]
let jumpQueued = false
let gameMode = createGameModeState()
let playerState: PlayerState = {
  position: { ...PLAYER_SPAWN },
  velocity: { x: 0, y: 0 },
  grounded: false,
}
let previousPlayerPosition: Vec2 = { ...playerState.position }
let previousTimeSeconds = performance.now() / 1000
let accumulatorSeconds = 0

window.addEventListener('keydown', (event) => {
  if (
    event.code === 'KeyA' ||
    event.code === 'KeyD' ||
    event.code === 'Space' ||
    event.code.startsWith('Digit')
  ) {
    event.preventDefault()
  }
  pressedCodes.add(event.code)

  if (gameMode.mode === 'platform' && event.code === 'Space' && !event.repeat) {
    jumpQueued = true
  }

  if (gameMode.mode === 'capture-aim' && !event.repeat) {
    const slot = slotFromCode(event.code)
    if (slot !== null) {
      gameMode = transitionGameMode(
        gameMode,
        { type: 'select-slot', slot },
        occupancy(),
      )
    }
  }
})

window.addEventListener('keyup', (event) => {
  pressedCodes.delete(event.code)
})

window.addEventListener('mousemove', (event) => {
  gameUi.setPointer(event.clientX, event.clientY)
})

window.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || gameMode.mode !== 'capture-aim') return

  stampSlots[gameMode.selectedSlot] = captureBoxes(
    STAGE_BOXES,
    gameScene.getViewProjectionElements(),
    gameUi.getCaptureFrame(),
  )
  gameMode = transitionGameMode(
    gameMode,
    { type: 'confirm-capture' },
    occupancy(),
  )
})

window.addEventListener('contextmenu', (event) => {
  event.preventDefault()

  if (gameMode.mode === 'platform') {
    gameUi.enterCaptureAimAt(event.clientX, event.clientY)
    gameMode = transitionGameMode(
      gameMode,
      { type: 'enter-capture-aim' },
      occupancy(),
    )
    pressedCodes.clear()
    jumpQueued = false
    return
  }

  if (gameMode.mode === 'capture-aim') {
    gameMode = transitionGameMode(
      gameMode,
      { type: 'cancel-capture' },
      occupancy(),
    )
    gameScene.resetAim()
    pressedCodes.clear()
    return
  }

  stampSlots[gameMode.selectedSlot] = null
  gameMode = transitionGameMode(
    gameMode,
    { type: 'discard-stamp' },
    occupancy(),
  )
  gameScene.resetAim()
  pressedCodes.clear()
})

window.addEventListener('blur', () => {
  pressedCodes.clear()
  jumpQueued = false
})

const frame = (timeMilliseconds: number): void => {
  const timeSeconds = timeMilliseconds / 1000
  const frameDeltaSeconds = Math.min(timeSeconds - previousTimeSeconds, 0.1)
  accumulatorSeconds += frameDeltaSeconds
  previousTimeSeconds = timeSeconds

  if (gameMode.mode === 'capture-aim') {
    gameScene.rotateAim(frameDeltaSeconds, createAimInput(pressedCodes).rotate)
  }

  const advance = advanceFixedStep(
    accumulatorSeconds,
    TICK_SECONDS,
    MAX_STEPS_PER_FRAME,
  )

  for (let step = 0; step < advance.steps; step += 1) {
    previousPlayerPosition = playerState.position
    const session = stepSession(
      { gameMode, player: playerState },
      createTickInput(pressedCodes, jumpQueued),
      STAGE_COLLIDERS,
      TICK_SECONDS,
    )
    playerState = session.player
    jumpQueued = false
  }

  accumulatorSeconds = advance.remainderSeconds
  const renderPosition = gameMode.mode === 'platform'
    ? interpolatePosition(previousPlayerPosition, playerState.position, advance.alpha)
    : playerState.position
  gameScene.render(renderPosition)
  gameUi.render({
    mode: gameMode.mode,
    selectedSlot: gameMode.selectedSlot,
    slots: stampSlots,
    cameraYawDegrees: gameScene.getCameraYawDegrees(),
  })
  requestAnimationFrame(frame)
}

window.addEventListener('resize', gameScene.resize)
requestAnimationFrame(frame)

function occupancy(): SlotOccupancy {
  return [
    stampSlots[0] !== null,
    stampSlots[1] !== null,
    stampSlots[2] !== null,
  ]
}

function slotFromCode(code: string): StampSlotIndex | null {
  if (code === 'Digit1') return 0
  if (code === 'Digit2') return 1
  if (code === 'Digit3') return 2
  return null
}

function interpolatePosition(from: Vec2, to: Vec2, alpha: number): Vec2 {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
  }
}
