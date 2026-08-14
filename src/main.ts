import './style.css'

import { MAX_STEPS_PER_FRAME, TICK_SECONDS } from './core/constants'
import { advanceFixedStep } from './core/fixed-step-loop'
import { createTickInput } from './core/input'
import { stepPlayer } from './core/player'
import type { PlayerState } from './core/player'
import { PLAYER_SPAWN, STAGE_COLLIDERS } from './core/stage'
import type { Vec2 } from './core/types'
import { createGameScene } from './render/scene'

const app = document.querySelector<HTMLElement>('#app')

if (app === null) {
  throw new Error('게임 루트 요소를 찾을 수 없습니다.')
}

const gameScene = createGameScene(app)
const pressedCodes = new Set<string>()
let jumpQueued = false
let playerState: PlayerState = {
  position: { ...PLAYER_SPAWN },
  velocity: { x: 0, y: 0 },
  grounded: false,
}
let previousPlayerPosition: Vec2 = { ...playerState.position }
let previousTimeSeconds = performance.now() / 1000
let accumulatorSeconds = 0

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyA' || event.code === 'KeyD' || event.code === 'Space') {
    event.preventDefault()
  }
  pressedCodes.add(event.code)
  if (event.code === 'Space' && !event.repeat) jumpQueued = true
})

window.addEventListener('keyup', (event) => {
  pressedCodes.delete(event.code)
})

window.addEventListener('blur', () => {
  pressedCodes.clear()
  jumpQueued = false
})

const frame = (timeMilliseconds: number): void => {
  const timeSeconds = timeMilliseconds / 1000
  accumulatorSeconds += timeSeconds - previousTimeSeconds
  previousTimeSeconds = timeSeconds

  const advance = advanceFixedStep(
    accumulatorSeconds,
    TICK_SECONDS,
    MAX_STEPS_PER_FRAME,
  )

  for (let step = 0; step < advance.steps; step += 1) {
    previousPlayerPosition = playerState.position
    playerState = stepPlayer(
      playerState,
      createTickInput(pressedCodes, jumpQueued),
      STAGE_COLLIDERS,
      TICK_SECONDS,
    )
    jumpQueued = false
  }

  accumulatorSeconds = advance.remainderSeconds
  gameScene.render(
    interpolatePosition(
      previousPlayerPosition,
      playerState.position,
      advance.alpha,
    ),
  )
  requestAnimationFrame(frame)
}

window.addEventListener('resize', gameScene.resize)
requestAnimationFrame(frame)

function interpolatePosition(from: Vec2, to: Vec2, alpha: number): Vec2 {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
  }
}
