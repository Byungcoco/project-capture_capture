# Airborne Coasting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방향 입력이 없는 공중 플레이어의 수평 속도를 초당 8씩 감속한다.

**Architecture:** 코어 상수에 공중 무입력 감속량을 추가하고 `stepPlayer`의 기존 `approach` 연산을 재사용한다. 렌더링·입력·충돌 인터페이스는 바꾸지 않는다.

**Tech Stack:** TypeScript, Vitest, Vite

## Global Constraints

- 공중 무입력 감속의 초기값은 초당 `8`이다.
- 공중 방향 입력 중에는 기존 지상 가속의 `40%`를 적용한다.
- 지상 감속은 초당 `36`을 유지한다.
- 새 의존성을 추가하지 않는다.

---

### Task 1: 공중 무입력 고정 감속

**Files:**
- Modify: `src/core/constants.ts`
- Modify: `src/core/player.ts`
- Test: `src/core/player.test.ts`
- Modify: `docs/wiki/06-code/core.md`
- Modify: `docs/wiki/05-progress/current.md`

**Interfaces:**
- Consumes: `stepPlayer(state: PlayerState, input: PlayerInput, colliders: readonly Collider[], stepSeconds: number): PlayerState`
- Produces: `PLAYER_AIR_DECELERATION = 8`과 공중 무입력 감속 동작

- [x] **Step 1: 실패 테스트 작성**

```ts
it('공중에서 입력을 놓으면 수평 속도가 서서히 줄어든다', () => {
  let state = createState({ velocity: { x: 6, y: 0 } })

  for (let tick = 0; tick < 20; tick += 1) {
    state = stepPlayer(state, idle, [], 1 / 60)
  }

  expect(state.velocity.x).toBeCloseTo(10 / 3)
})
```

- [x] **Step 2: RED 확인**

Run: `pnpm.cmd test -- src/core/player.test.ts`

Expected: 공중 무입력 속도가 `6`으로 유지되어 기대값 `10 / 3`과 달라 실패한다.

- [x] **Step 3: 최소 구현**

```ts
export const PLAYER_AIR_DECELERATION = 8
```

`stepPlayer`에서 `input.moveX === 0`일 때 접지 상태면 기존 지상 감속, 공중 상태면 `PLAYER_AIR_DECELERATION * stepSeconds`를 사용해 `velocityX`를 0으로 접근시킨다.

- [x] **Step 4: GREEN 및 전체 검증**

Run: `pnpm.cmd test`

Expected: 18개 테스트가 모두 통과한다.

Run: `pnpm.cmd build`

Expected: 타입 검사와 Vite 프로덕션 빌드가 성공한다.

- [x] **Step 5: 문서와 위키 동기화**

`docs/wiki/06-code/core.md`에 공중 무입력 감속 초당 8을 기록하고 `docs/wiki/05-progress/current.md`에 플레이테스트 대기 상태를 반영한다. 그 뒤 `wiki_sync.py finalize`와 `wiki_sync.py check`를 실행한다.

- [x] **Step 6: 플레이테스트 전 변경 상태 확인**

Run: `git diff --check`

Expected: 공백 오류가 없으며 이번 물리 조정과 관련 문서만 변경되어 있다.
