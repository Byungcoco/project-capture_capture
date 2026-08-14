---
title: Architecture
type: technology
status: verified
tags: [architecture, determinism, module-boundary]
updated: 2026-08-14
summary: 기술 스택, 폴백 가능한 모듈 경계와 결정론 규칙의 원본.
---

# Architecture

## 기술 스택

Vite + TypeScript(strict) + Three.js(npm). 번들 결과가 정적 웹 빌드로 나와야 한다. 물리는 외부 엔진 없이 자체 구현. 렌더는 3D(직교 카메라), 게임플레이 판정은 2D. 근거는 [[../04-decisions/ADR-0002-web-stack-vite-ts-three|ADR-0002]].

## 모듈 경계 — 폴백 가능한 분리 (절대 규칙)

코어 게임은 "2D 스탬프를 받아 지형으로 배치하는 게임"이다. 직교 캡처는 스탬프를 생성하는 하나의 소스 모듈일 뿐이다. 직교 파트가 완성도에 도달하지 못하면 순수 2D 캡처 게임으로 폴백한다. 근거는 [[../04-decisions/ADR-0004-fallback-core-architecture|ADR-0004]].

- core/    고정 타임스텝 루프, 입력, 플레이어 물리, 2D 충돌, 스테이지 로드, 골 판정
- stamp/   Stamp 자료구조(2D 폴리곤 조각 + 속성 태그), 스탬프 배치(지오메트리+콜라이더 생성)
- capture/ 직교 캡처 파이프라인. core는 capture를 몰라도 동작해야 한다
- render/  Three.js 씬, 직교 카메라, 카메라 회전 연출
- ui/      캡처 프레임 오버레이, HUD

게임 루프와 시뮬레이션을 렌더·DOM 생명주기에 종속시키지 않는다.

## 게임 모드와 상태 소유

이 설계에 동기화는 없다. core가 진실을 쓰고, render는 그걸 읽어 표현을
파생한다. 화살표는 언제나 core → render 한 방향이며, "동기화"라는 말이
떠오르는 순간이 곧 설계가 어긋나는 순간이다.

| 구성 요소 | 계층 | 소유하는 상태 | 참조하는 것 |
|---|---|---|---|
| GameMode FSM | core (틱, 리플레이 대상) | 현재 모드라는 진실 | 입력 매퍼의 명령 |
| PlayerState | core (틱, 리플레이 대상) | 물리 사실 | stepPlayer가 받은 명령 |
| AnimationFSM | render (프레임, 코스메틱) | 클립 선택과 표현의 관성 | core의 PlayerState |
| 비네트·프레임 UI | render | 연출 상태 | core의 GameMode |

- GameMode FSM은 Platform / CaptureAim / Paste 세 상태를 가진다. 전이는
  (틱, 입력)만의 함수이며 리플레이에 그대로 기록된다.
- 입력 매퍼가 원시 입력을 현재 모드에 맞는 의미 명령으로 번역한다.
  stepPlayer는 자기가 어느 모드에 있는지 모른 채, 받은 명령대로만 움직인다.
- **시간 정지는 틱을 멈추는 게 아니다.** 틱은 계속 돌고, CaptureAim에서는
  월드 엔티티(플레이어 물리, 움직이는 지형, 위험물)의 갱신만 건너뛴다.
  카메라 각도와 프레임 위치는 계속 틱 단위로 갱신되고 기록된다 — 그래야
  리플레이가 조준 과정까지 그대로 재생한다.
- PlayerState는 물리 사실만 가진다: position, velocity, grounded, facing.
  facing은 마지막으로 0이 아니었던 수평 입력의 부호로 갱신한다
  (스프라이트 좌우 반전에 쓰인다, 예정).
- 애니메이션 상태(idle/run/jump/fall)는 render 계층의 파생 FSM이다.
  매 프레임 PlayerState로부터 다시 계산하되, "착지 모션은 최소 몇 프레임은
  보여준다" 같은 표현의 관성만 자기 상태로 가진다. 리플레이에는 기록하지
  않는다 — 재생할 때 다시 파생하면 그만이다.

## 결정론 규칙 (리플레이의 전제 — 절대 규칙)

- 고정 타임스텝(60Hz) 시뮬레이션 + 렌더 보간. 가변 dt를 게임 로직에 쓰지 않는다.
- Math.random() 금지. 난수는 시드 기반 PRNG 모듈만 사용한다.
- 게임 상태 변화는 (틱 번호, 입력)만의 함수여야 한다.
- 입력은 틱 단위로 기록 가능한 형태로 수집한다 (리플레이 = 입력 시퀀스 재생).

근거는 [[../04-decisions/ADR-0003-deterministic-fixed-timestep|ADR-0003]].

## 코드 컨벤션

- TypeScript strict. 게임 상수는 constants.ts에 모은다 (PLAY_PLANE, TICK_RATE, FRAME_W/H 등).
- 좌표·변환은 Three.js 기본인 오른손 좌표계(+X 오른쪽, +Y 위, 기준 정면 뷰에서 +Z 화면 바깥쪽)와 열벡터 `v′ = Mv`를 따르며, 카메라 전방은 세계축이 아니라 카메라 로컬 -Z다. `Matrix4.set(...)` 인수·문서 표기는 행 우선이지만 내부 `elements` 저장과 계산은 열 우선이므로 혼동하지 않는다.
- 주석·커밋은 한글, 식별자는 영어. 매직 넘버 금지.
- console.log는 디버그 플래그 뒤에 둔다.
