import './style.css'

import { MAX_STEPS_PER_FRAME, TICK_SECONDS } from './core/constants'
import { advanceFixedStep } from './core/fixed-step-loop'
import { createBrowserInput } from './pivot/adapter/browser-input'
import { createPivotScene } from './pivot/adapter/three-scene'
import { MOVEMENT_COURSE, MOVEMENT_SPAWN } from './pivot/content/movement-course'
import { createPlayerState } from './pivot/domain/player'
import { createPivotSession, stepPivotSession } from './pivot/domain/session'
import { createPivotHud } from './pivot/ui/hud'

const app = document.querySelector<HTMLElement>('#app')
if (app === null) throw new Error('게임 루트 요소를 찾을 수 없습니다.')

const scene = createPivotScene(app, MOVEMENT_COURSE)
const input = createBrowserInput(scene.canvas)
const hud = createPivotHud(app)
let session = createSession()
let previousTimeSeconds = performance.now() / 1000
let accumulatorSeconds = 0

function createSession() {
  return createPivotSession({
    colliders: MOVEMENT_COURSE,
    player: createPlayerState({ position: { ...MOVEMENT_SPAWN } }),
  })
}

function frame(timeMilliseconds: number): void {
  const timeSeconds = timeMilliseconds / 1000
  accumulatorSeconds += Math.min(timeSeconds - previousTimeSeconds, 0.1)
  previousTimeSeconds = timeSeconds
  const advance = advanceFixedStep(
    accumulatorSeconds,
    TICK_SECONDS,
    MAX_STEPS_PER_FRAME,
  )

  for (let step = 0; step < advance.steps; step += 1) {
    session = stepPivotSession(session, input.sampleCommand())
    if (session.state.player.position.y < -12) session = createSession()
  }

  accumulatorSeconds = advance.remainderSeconds
  scene.render(session.snapshot, input.getCameraAim())
  hud.render(session.snapshot, document.pointerLockElement === scene.canvas)
  requestAnimationFrame(frame)
}

window.addEventListener('resize', scene.resize)
requestAnimationFrame(frame)
