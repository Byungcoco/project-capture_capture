---
title: "ADR-0011: 셀 지형 권위 아키텍처"
type: decision
status: accepted
tags: [architecture, cell-terrain, determinism, module-boundary]
updated: 2026-08-15
summary: 0.5m 셀 지형 배열을 시뮬레이션 권위 원본으로 두고 2D 스탬프 폴백 코어를 대체하는 결정.
---

# ADR-0011: 셀 지형 권위 아키텍처

## 맥락

[[ADR-0010-pivot-to-third-person-capture-action|ADR-0010]]으로 절취와 배치가 권위 시뮬레이션 안으로 들어왔다. 기존 아키텍처(ADR-0004)는 코어를 "2D 스탬프를 받아 지형으로 배치하는 게임"으로 정의하고 직교 캡처를 떼어낼 수 있는 소스 모듈로 두었다. 지형이 런타임에 잘리고 생기는 구조에서는 이 경계가 성립하지 않는다.

## 결정

- 0.5m 셀 지형 배열이 충돌, 캡처, 배치 검증, 와이어 raycast, 투사체 차폐와 렌더의 **단일 권위 원본**이다.
- 순수 TypeScript session이 플레이어, 지형, 캡처 스택, 전투 상태를 모두 소유한다. 렌더와 DOM은 스냅샷을 읽기만 한다.
- 모듈 경계는 `src/pivot/domain`(Three.js·DOM 미참조), `src/pivot/browser`(렌더·입력), `src/pivot/demo`(콘텐츠)다.
- 한 틱의 계산 순서를 고정한다: capture → placement transaction → player shot spawn → enemy spawn → 투사체 이동·충돌·피해 → 플레이어 이동. 같은 틱에 생성된 셀도 그 틱의 충돌·와이어·차폐 대상이다.
- 외부에서 주입되는 상태(적, 투사체, 캡처 청크)는 신뢰 경계로 취급해 구조와 범위를 검증하고 안정 error code로 거부한다.

이 결정은 [[ADR-0004-fallback-core-architecture|ADR-0004]]를 대체하고, 모드 FSM 부분에서 [[ADR-0007-game-mode-fsm|ADR-0007]]을 대체한다.

## 이유

- 절취·배치가 매 틱 지형을 바꾸므로 "코어는 capture를 모른다"는 폴백 경계를 유지할 수 없다. 지형 자체가 코어다.
- 셀 표현은 임의 지점 절취와 정확한 구멍을 O(셀 수)로, 부동소수 boolean 없이 결정론적으로 만든다. 충돌은 AABB, 렌더는 재질별 InstancedMesh, 후보 질의는 BVH로 각각 값싸게 얹힌다.
- 계산 순서를 고정하면 "같은 틱에 놓은 발판이 이번 틱 총알을 막는가" 같은 질문이 규칙으로 답해지고 회귀 테스트로 고정된다.
- 폴백은 사라지지 않고 형태가 바뀐다. 셀 지형과 순수 도메인은 콘텐츠(보스·섬)가 미완이어도 그 자체로 플레이 가능한 빌드를 낸다.

## 고려한 대안

- **런타임 메시 CSG**: 임의 형상 절취가 가능하나 boolean 안정성, 콜라이더 재생성, 결정론, 웹 성능을 동시에 풀어야 해 기한 내 제출 위험이 크다. 기각.
- **ADR-0004의 2D 스탬프 폴백 유지**: 피벗 장르와 양립하지 않는다. 기각.
- **셀 크기 0.25m**: 절단면이 고와지지만 같은 캡처 볼륨이 8배 셀이 된다. 플레이테스트에서 거칠다는 판정이 나오기 전까지 0.5m 유지.

## 영향

- 결정론 규칙([[ADR-0003-deterministic-fixed-timestep|ADR-0003]])은 그대로다. 고정 60Hz, `Math.random()` 금지, 상태는 (틱, 입력)의 함수다.
- 시각적 격자감은 표현 계층에서 다룬다. 면 병합과 절단면 재질은 시뮬레이션을 건드리지 않고 나중에 얹을 수 있다.
- 코드 계약의 원본은 [[../06-code/pivot-runtime|Pivot Runtime]]이다.
- 기존 `src/core`, `src/stamp`, `src/capture`, `src/render`, `src/ui`는 목표 플레이 경로에서 빠진다.
