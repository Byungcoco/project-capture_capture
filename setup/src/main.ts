import './style.css'

import { MAX_STEPS_PER_FRAME, TICK_SECONDS } from './core/constants'
import { advanceFixedStep } from './core/fixed-step-loop'
import { createGameScene } from './render/scene'

const app = document.querySelector<HTMLElement>('#app')

if (app === null) {
  throw new Error('게임 루트 요소를 찾을 수 없습니다.')
}

const gameScene = createGameScene(app)
let previousTimeSeconds = performance.now() / 1000
let accumulatorSeconds = 0

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
    // 마일스톤 2부터 틱 단위 시뮬레이션을 이 경계에서 갱신한다.
  }

  accumulatorSeconds = advance.remainderSeconds
  gameScene.render()
  requestAnimationFrame(frame)
}

window.addEventListener('resize', gameScene.resize)
requestAnimationFrame(frame)
