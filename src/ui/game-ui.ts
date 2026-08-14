import type { NormalizedFrame } from '../capture/types'
import type { GameMode, StampSlotIndex } from '../core/game-mode'
import type { Stamp } from '../stamp/types'
import { frameAtPointer } from './capture-frame'
import { createCapturePointer } from './capture-pointer'

export interface GameUiState {
  mode: GameMode
  selectedSlot: StampSlotIndex
  slots: readonly [Stamp | null, Stamp | null, Stamp | null]
  cameraYawDegrees: number
}

export interface GameUi {
  setPointer: (clientX: number, clientY: number) => void
  enterCaptureAimAt: (clientX: number, clientY: number) => void
  getCaptureFrame: () => NormalizedFrame
  render: (state: GameUiState) => void
}

export function createGameUi(container: HTMLElement): GameUi {
  const root = element('div', 'game-ui')
  const frame = element('div', 'capture-frame')
  const frameLabel = element('span', 'capture-frame__label', 'CAPTURE FRAME')
  frame.append(frameLabel)

  const modeBadge = element('div', 'mode-badge')
  const aimDebug = element('div', 'aim-debug')
  const slots = element('div', 'slot-hud')
  const preview = element('section', 'stamp-preview')
  const previewTitle = element('h2', 'stamp-preview__title', 'STAMP DEBUG')
  const previewSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  previewSvg.setAttribute('viewBox', '0 0 100 100')
  preview.append(previewTitle, previewSvg)

  const controls = element('section', 'prototype-controls')
  controls.innerHTML = `
    <h2>PROTOTYPE CONTROLS</h2>
    <div data-control-mode="platform"><strong>PLATFORM</strong><span>A / D 이동</span><span>SPACE 점프</span><span>우클릭 캡처 조준</span></div>
    <div data-control-mode="capture-aim"><strong>CAPTURE AIM</strong><span>A / D 카메라 회전</span><span>마우스 프레임 이동</span><span>1 / 2 / 3 슬롯</span><span>좌클릭 캡처</span><span>우클릭 취소</span></div>
    <div data-control-mode="paste"><strong>PASTE DEBUG</strong><span>우클릭 스탬프 버리기</span><span>배치는 마일스톤 4</span></div>
  `

  root.append(frame, modeBadge, aimDebug, slots, preview, controls)
  container.append(root)

  const capturePointer = createCapturePointer({ x: 0.5, y: 0.5 })
  let captureFrame = frameAtPointer({ x: 0.5, y: 0.5 })
  let currentMode: GameMode = 'platform'

  const positionFrame = (): void => {
    frame.style.left = `${(captureFrame.center.x - captureFrame.width / 2) * 100}%`
    frame.style.bottom = `${(captureFrame.center.y - captureFrame.height / 2) * 100}%`
    frame.style.width = `${captureFrame.width * 100}%`
    frame.style.height = `${captureFrame.height * 100}%`
  }
  positionFrame()

  return {
    setPointer: (clientX, clientY) => {
      const pointer = normalizedPointer(container, clientX, clientY)
      if (pointer === null) return
      capturePointer.move(pointer)
      if (currentMode === 'capture-aim') {
        captureFrame = capturePointer.frameForCaptureAim()
        positionFrame()
      }
    },
    enterCaptureAimAt: (clientX, clientY) => {
      const pointer = normalizedPointer(container, clientX, clientY)
      if (pointer === null) return
      captureFrame = capturePointer.frameForCaptureAim(pointer)
      positionFrame()
    },
    getCaptureFrame: () => captureFrame,
    render: (state) => {
      if (state.mode === 'capture-aim' && currentMode !== 'capture-aim') {
        captureFrame = capturePointer.frameForCaptureAim()
        positionFrame()
      }
      currentMode = state.mode
      root.dataset.mode = state.mode
      frame.hidden = state.mode !== 'capture-aim'
      aimDebug.hidden = state.mode !== 'capture-aim'
      preview.hidden = state.mode !== 'paste'
      modeBadge.textContent = state.mode.replace('-', ' ').toUpperCase()
      aimDebug.textContent = `ANGLE ${state.cameraYawDegrees.toFixed(1)}°  ·  SLOT ${state.selectedSlot + 1}`

      slots.replaceChildren(
        ...state.slots.map((stamp, index) => {
          const slot = element('div', 'slot-hud__slot')
          slot.classList.toggle('is-selected', index === state.selectedSlot)
          slot.classList.toggle('is-occupied', stamp !== null)
          slot.innerHTML = `<span>${index + 1}</span><small>${stamp === null ? 'EMPTY' : `${stamp.pieces.length} PIECE`}</small>`
          return slot
        }),
      )

      controls.querySelectorAll<HTMLElement>('[data-control-mode]').forEach((group) => {
        group.classList.toggle('is-current', group.dataset.controlMode === state.mode)
      })

      previewSvg.replaceChildren()
      const stamp = state.slots[state.selectedSlot]
      if (stamp !== null) {
        for (const piece of stamp.pieces) {
          const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
          polygon.setAttribute(
            'points',
            piece.vertices.map((point) => `${point.x * 100},${(1 - point.y) * 100}`).join(' '),
          )
          previewSvg.append(polygon)
        }
      }
    },
  }
}

function normalizedPointer(
  container: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const bounds = container.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return null
  return {
    x: (clientX - bounds.left) / bounds.width,
    y: 1 - (clientY - bounds.top) / bounds.height,
  }
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
