# Milestone 3 Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모드 기반 시간 정지, 360도 직교 카메라 조준, 정규화 프레임 캡처, 3개 슬롯과 SVG 디버그 미리보기를 구현한다.

**Architecture:** core는 순수 GameMode 전이만 소유하고 capture/stamp는 Three.js와 DOM 없이 결정론적 폴리곤을 만든다. render와 ui는 로컬 조준 상태를 표현하며 main이 확정 이벤트와 슬롯 저장을 조정한다.

**Tech Stack:** TypeScript strict, Vitest, Three.js, DOM/SVG, Vite

## Global Constraints

- ADR-0007이 모드와 리플레이 경계의 최종 기준이다.
- CaptureAim 조준 과정은 기록하지 않고 확정 Capture 이벤트만 core에 전달한다.
- 캡처 프레임은 뷰포트 너비 30%, 높이 40%다.
- capture/stamp/core는 Three.js와 DOM을 import하지 않는다.
- 동작 코드는 실패 테스트를 확인한 뒤 최소 구현한다.

---

### Task 1: GameMode FSM과 슬롯 선택

**Files:**
- Create: `src/core/game-mode.ts`
- Create: `src/core/game-mode.test.ts`
- Modify: `src/core/input.ts`
- Modify: `src/core/input.test.ts`

**Interfaces:**
- Produces: `GameMode`, `GameModeState`, `GameModeCommand`, `transitionGameMode(state, command, occupiedSlots)`
- `GameModeState`는 `mode`와 `selectedSlot: 0 | 1 | 2`를 가진다.

- [ ] RED 테스트: Platform→CaptureAim, 첫 빈 슬롯, 가득 찼을 때 3번, 수동 슬롯 선택, 취소, 캡처 후 Paste, 버리기 후 Platform을 단언한다.
- [ ] `pnpm.cmd test -- src/core/game-mode.test.ts src/core/input.test.ts`에서 기능 부재 실패를 확인한다.
- [ ] enum 대신 문자열 유니온과 순수 전이 함수로 최소 구현한다.
- [ ] 모드별 원시 키를 의미 입력으로 나누되 `stepPlayer`의 기존 계약을 유지한다.
- [ ] 대상 테스트와 전체 테스트 통과를 확인한다.

### Task 2: Stamp 계약과 순수 캡처 기하

**Files:**
- Create: `src/stamp/types.ts`
- Create: `src/capture/types.ts`
- Create: `src/capture/projection.ts`
- Create: `src/capture/hull.ts`
- Create: `src/capture/clip.ts`
- Create: `src/capture/capture.ts`
- Create: `src/capture/capture.test.ts`

**Interfaces:**
- Consumes: 열 우선 `readonly number[16]`, `CaptureBox[]`, `NormalizedFrame`
- Produces: `captureBoxes(boxes, viewProjection, frame): Stamp`
- `Stamp`는 프레임 로컬 정규화 좌표의 `StampPiece[]`를 가진다.

- [ ] RED 테스트: 단위 행렬 투영, 볼록 껍질 반시계 순서, 내부·부분·외부 클리핑, 같은 입력의 같은 결과를 단언한다.
- [ ] 캡처 테스트를 실행해 기능 부재 실패를 확인한다.
- [ ] 동차 좌표 투영, monotone chain, Sutherland–Hodgman, 프레임 로컬 변환을 최소 구현한다.
- [ ] 퇴화 폴리곤과 `w <= 0` 투영은 안전하게 제외한다.
- [ ] 대상 테스트와 전체 테스트 통과를 확인한다.

### Task 3: 직교 카메라 조준 API

**Files:**
- Modify: `src/render/scene.ts`
- Modify: `src/core/constants.ts`

**Interfaces:**
- Produces: `rotateAim(deltaSeconds, direction)`, `getViewProjectionElements()`, `getCameraYawDegrees()`, `render(playerPosition)`
- 카메라는 무대 중심 기준 Y축 궤도를 초당 90도로 회전한다.

- [ ] 순수 각도 갱신 계산에 대한 RED 테스트를 추가한다.
- [ ] 테스트 실패를 확인한 뒤 회전 계산을 구현한다.
- [ ] Three.js 카메라 위치와 view-projection 열 우선 배열 제공을 연결한다.
- [ ] 기존 렌더와 전체 테스트·타입 검사를 통과시킨다.

### Task 4: Prototype UI

**Files:**
- Create: `src/ui/game-ui.ts`
- Modify: `src/style.css`

**Interfaces:**
- Produces: `createGameUi(container)`가 frame rect, mode, slot occupancy, selected slot, camera angle, Stamp preview를 갱신하는 API를 반환한다.
- 프레임 경계는 화면 정규화 좌표로 반환한다.

- [ ] DOM 없이 검증 가능한 프레임 중심 clamp 계산의 RED 테스트를 추가한다.
- [ ] 테스트 실패를 확인한 뒤 30% × 40% 프레임 계산을 구현한다.
- [ ] 비네트, 프레임, 슬롯 HUD, SVG 미리보기, 오른쪽 상단 `PROTOTYPE CONTROLS`를 구현한다.
- [ ] 현재 모드 도움말만 강조하고 나머지는 흐리게 표시한다.
- [ ] 타입 검사와 빌드를 통과시킨다.

### Task 5: 런타임 조정과 시간 정지

**Files:**
- Modify: `src/main.ts`
- Modify: `src/core/stage.ts`
- Create: `src/core/session.ts`
- Create: `src/core/session.test.ts`

**Interfaces:**
- Produces: 모드·플레이어·슬롯을 조정하는 순수 세션 스텝과 브라우저 이벤트 연결.
- CaptureAim/Paste에서는 플레이어 상태를 그대로 유지한다.

- [ ] RED 테스트: CaptureAim/Paste에서 같은 틱 입력에도 PlayerState가 변하지 않음을 단언한다.
- [ ] 테스트 실패를 확인한 뒤 순수 세션 스텝을 구현한다.
- [ ] 우클릭 모드 전환, 마우스 프레임 이동, A/D 카메라 회전, 1/2/3 선택, 좌클릭 캡처와 슬롯 저장을 연결한다.
- [ ] 박스 렌더와 캡처가 같은 stage 원본을 사용하도록 3D 깊이 계약을 stage에 둔다.
- [ ] 전체 테스트, 타입 검사와 빌드를 통과시킨다.

### Task 6: 문서와 브라우저 검증

**Files:**
- Modify: `docs/wiki/05-progress/current.md`
- Create: `docs/wiki/06-code/capture.md`
- Modify: `docs/wiki/06-code/index.md`
- Modify: `docs/wiki/03-tech/capture-pipeline.md` if implementation changes its contract

**Interfaces:**
- Produces: 구현 계약과 검증 결과의 위키 원본.

- [ ] 코드 계약과 마일스톤 3 상태를 위키에 반영한다.
- [ ] `wiki_sync.py finalize`와 `wiki_sync.py check`를 실행한다.
- [ ] `pnpm.cmd test`, `pnpm.cmd build`, `git diff --check`를 실행한다.
- [ ] 브라우저에서 모드 전환, 시간 정지, 360도 회전, 프레임 이동, 슬롯 선택·덮어쓰기, SVG 미리보기, 키 도움말, 리사이즈와 콘솔 오류 0을 확인한다.
- [ ] 플레이테스트 승인을 기다리고 구현 커밋은 그 뒤 수행한다.
