import type { GameSnapshot } from '../domain/session'

export interface PivotHud {
  render(snapshot: GameSnapshot, pointerLocked: boolean): void
}

export function createPivotHud(root: HTMLElement): PivotHud {
  const hud = document.createElement('section')
  hud.className = 'pivot-hud'
  hud.innerHTML = `
    <div class="pivot-hud__title">PIVOT PROTOTYPE</div>
    <div class="pivot-hud__controls">클릭 시점 고정 · WASD 이동 · Space 더블 점프 · Shift 대시 · E 와이어</div>
    <div class="pivot-hud__status" aria-live="polite"></div>
    <div class="pivot-reticle" aria-hidden="true"></div>
  `
  root.append(hud)
  const status = hud.querySelector<HTMLElement>('.pivot-hud__status')
  if (status === null) throw new Error('피벗 HUD 상태 요소를 찾을 수 없습니다.')

  return {
    render(snapshot, pointerLocked): void {
      const player = snapshot.player
      const ability = player.wire !== null
        ? `WIRE ${player.wire.ticksRemaining}`
        : player.dashAvailable ? 'DASH READY' : 'DASH SPENT'
      status.textContent = `${pointerLocked ? 'LOCKED' : 'CLICK TO LOCK'} · ${ability} · JUMP ${player.airJumpsRemaining}`
    },
  }
}
