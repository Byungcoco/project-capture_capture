---
title: Architecture
type: technology
status: verified
tags: [architecture, determinism, module-boundary]
updated: 2026-08-15
summary: 기술 스택, 셀 지형 권위 모듈 경계와 결정론 규칙의 원본.
---

# Architecture

## 기술 스택

Vite + TypeScript(strict) + Three.js(npm). 번들 결과가 정적 웹 빌드로 나와야 한다. 물리는 외부 엔진 없이 자체 구현. 렌더와 게임플레이 판정 모두 3D다. 근거는 [[../04-decisions/ADR-0002-web-stack-vite-ts-three|ADR-0002]].

## 모듈 경계 — 셀 지형 권위 (절대 규칙)

0.5m 셀 지형 배열이 충돌, 캡처, 배치 검증, 와이어 raycast, 투사체 차폐와 렌더의 단일 권위 원본이다. 근거는 [[../04-decisions/ADR-0011-cell-terrain-authority-architecture|ADR-0011]].

- pivot/domain/  고정 타임스텝 session, 셀 지형, 플레이어 물리와 충돌, 캡처·배치, 와이어, 전투. Three.js와 DOM을 import하지 않는다
- pivot/browser/ Three.js 씬, 카메라, 입력, HUD. 스냅샷을 읽기만 한다
- pivot/demo/    데모 코스와 콘텐츠 데이터

게임 루프와 시뮬레이션을 렌더·DOM 생명주기에 종속시키지 않는다.

기존 `src/core`, `src/stamp`, `src/capture`, `src/render`, `src/ui`는 직교 퍼즐 시절의 모듈이며 목표 플레이 경로에서 빠졌다. 제거 시점은 별도 정리 작업으로 다룬다.

## 상태 소유와 틱 순서

이 설계에 동기화는 없다. session이 진실을 쓰고, render는 그걸 읽어 표현을
파생한다. 화살표는 언제나 domain → browser 한 방향이며, "동기화"라는 말이
떠오르는 순간이 곧 설계가 어긋나는 순간이다.

| 구성 요소 | 계층 | 소유하는 상태 | 참조하는 것 |
|---|---|---|---|
| 셀 지형 배열 | domain (틱, 리플레이 대상) | 월드의 진실 | 캡처·배치 transaction |
| PlayerState | domain (틱, 리플레이 대상) | 물리 사실과 와이어 상태 | stepPlayer가 받은 명령 |
| CombatState | domain (틱, 리플레이 대상) | 체력, 적, 투사체 | 같은 틱의 명령과 지형 |
| 카메라·조준 | browser (프레임) | 시점과 조준 ray | 스냅샷의 플레이어 위치 |
| mesh 생명주기 | browser (프레임, 코스메틱) | GPU 자원 캐시 | 스냅샷의 엔티티 id |

- 모드 FSM은 없다. 입력은 상황에 따라 의미가 바뀌지 않으며 명령 구조체 하나로 매 틱 수집된다.
- 한 틱의 계산 순서는 capture → placement → player shot spawn → enemy spawn → 투사체 이동·충돌·피해 → 플레이어 이동으로 고정한다. 같은 틱에 생성된 셀도 그 틱의 충돌·와이어·차폐 대상이다.
- 카메라 각도와 조준 방향은 browser가 소유하는 프레임 상태지만, 확정된 조준 ray는 명령으로 domain에 전달되어 틱에 기록된다.
- 외부에서 주입되는 상태(적, 투사체, 캡처 청크)는 신뢰 경계다. 구조와 범위를 검증하고 안정 error code로 거부한다.

## 결정론 규칙 (리플레이의 전제 — 절대 규칙)

- 고정 타임스텝(60Hz) 시뮬레이션 + 렌더 보간. 가변 dt를 게임 로직에 쓰지 않는다.
- Math.random() 금지. 난수는 시드 기반 PRNG 모듈만 사용한다.
- 게임 상태 변화는 (틱 번호, 입력)만의 함수여야 한다.
- 입력은 틱 단위로 기록 가능한 형태로 수집한다 (리플레이 = 입력 시퀀스 재생).

근거는 [[../04-decisions/ADR-0003-deterministic-fixed-timestep|ADR-0003]].

## 캡처 볼륨 계약

- 캡처는 화면 프레임이 아니라 월드 공간의 시선 정렬 정육면체 볼륨이다. 조준한 첫 표면을 중심으로 3m 정육면체 안의 셀을 선택한다.
- 볼륨 크기와 사거리는 월드 단위로 고정하므로 창 크기와 무관하다.
- 상세 계약의 원본은 [[capture-pipeline|Capture Pipeline]]과 [[../06-code/pivot-runtime|Pivot Runtime]]이다.

근거는 [[../04-decisions/ADR-0010-pivot-to-third-person-capture-action|ADR-0010]].

## 코드 컨벤션

- TypeScript strict. 게임 상수는 해당 도메인 모듈 최상단에 export 상수로 모은다 (CELL_SIZE, WIRE_RANGE, PLAYER_SHOT_SPEED 등).
- 좌표·변환은 Three.js 기본인 오른손 좌표계(+X 오른쪽, +Y 위, 기준 정면 뷰에서 +Z 화면 바깥쪽)와 열벡터 `v′ = Mv`를 따르며, 카메라 전방은 세계축이 아니라 카메라 로컬 -Z다. `Matrix4.set(...)` 인수·문서 표기는 행 우선이지만 내부 `elements` 저장과 계산은 열 우선이므로 혼동하지 않는다.
- 주석·커밋은 한글, 식별자는 영어. 매직 넘버 금지.
- console.log는 디버그 플래그 뒤에 둔다.
