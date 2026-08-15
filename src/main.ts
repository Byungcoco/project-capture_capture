import './style.css'

import { MAX_STEPS_PER_FRAME, TICK_SECONDS } from './core/constants'
import { advanceFixedStep } from './core/fixed-step-loop'
import { solveCameraAim } from './pivot/browser/aim'
import { createBrowserInput } from './pivot/browser/browser-input'
import { createPivotHud } from './pivot/browser/hud'
import { createPivotScene } from './pivot/browser/three-scene'
import { MOVEMENT_SPAWN, MOVEMENT_TERRAIN } from './pivot/demo/movement-course'
import { previewCapture } from './pivot/domain/capture'
import { WIRE_RANGE, createPlayerState, playerWireOrigin } from './pivot/domain/player'
import { createPivotSession, stepPivotSession } from './pivot/domain/session'

const app = document.querySelector<HTMLElement>('#app')
if (app === null) throw new Error('게임 루트 요소를 찾을 수 없습니다.')

const scene = createPivotScene(app)
const input = createBrowserInput(scene.canvas)
const hud = createPivotHud(app)
let session = createSession()
let previousTimeSeconds = performance.now() / 1000
let accumulatorSeconds = 0

function createSession() {
  return createPivotSession({
    terrain: MOVEMENT_TERRAIN,
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
    const cameraRay = scene.getCameraRay(session.snapshot, input.getState())
    const aim = solveCameraAim(
      session.world,
      cameraRay.origin,
      cameraRay.direction,
      playerWireOrigin(session.state.player.position),
      WIRE_RANGE,
    )
    session = stepPivotSession(
      session,
      input.sampleCommand(cameraRay.direction, aim.wireAimDirection, cameraRay),
    )
    if (session.state.player.position.y < -12) session = createSession()
  }

  accumulatorSeconds = advance.remainderSeconds
  const previewRay = scene.getCameraRay(session.snapshot, input.getState())
  const preview = previewCapture(session.snapshot.terrain, {
    tick: session.snapshot.tick + 1,
    origin: previewRay.origin,
    direction: previewRay.direction,
    basis: previewRay.basis,
  }, session.snapshot.captureStack)
  scene.render(session.snapshot, input.getState(), preview)
  hud.render(session.snapshot, input.getState().pointerLocked)
  requestAnimationFrame(frame)
}

window.addEventListener('resize', scene.resize)
scene.render(session.snapshot, input.getState())
requestAnimationFrame(frame)
