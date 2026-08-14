---
title: Core Simulation
type: implementation
status: verified
tags: [player-physics, collision, determinism]
updated: 2026-08-14
summary: 마일스톤 2의 틱 입력, 관성형 플레이어 물리와 확장 가능한 충돌 해결 계약.
---

# Core Simulation

## 공개 계약

- `createTickInput(pressedCodes, jumpQueued)`는 DOM 키 상태를 틱 단위 `PlayerInput`으로 바꾼다. A/D 동시 입력은 상쇄하고 Space는 호출자가 한 틱만 전달한다.
- `stepPlayer(state, input, colliders, stepSeconds)`는 렌더·DOM과 무관한 순수 함수다. 동일한 초기 상태와 입력 시퀀스는 동일한 결과를 만든다.
- `resolvePlayerMotion(position, velocity, halfSize, colliders, stepSeconds)`가 플레이어와 지형 사이의 충돌 해결 경계다. 현재 `BoxCollider`만 지원하며 플레이어 시뮬레이션은 구체적인 충돌 도형을 판별하지 않는다.
- 좌표와 행렬 규칙은 [[../03-tech/architecture|Architecture]]를 따른다. 코어 충돌은 플레이 평면의 `(x, y)`만 사용한다.

## 현재 튜닝과 확장 경계

- 지상 가속과 감속은 모두 초당 36이며, 공중 수평 가속은 지상의 40%다. 공중에서 수평 입력이 없으면 초당 8씩 감속한다.
- 점프 속도는 시작 플랫폼보다 2유닛 높은 첫 박스를 달리며 넘을 수 있는 입력 시퀀스로 검증한다.
- 축별 스윕 AABB가 바닥·양쪽 벽·천장 관통을 막는다.
- 캡처 다각형 충돌은 마일스톤 4에서 충돌 해결 경계 내부에 추가한다. 플레이어·입력 API에는 다각형 분기를 노출하지 않는다.
- `transitionGameMode`는 Platform / CaptureAim / Paste와 선택 슬롯만 다루는 순수 FSM이며 Stamp 데이터를 알지 못한다.
- `stepSession`은 Platform에서만 `stepPlayer`를 호출하고 CaptureAim/Paste에서는 PlayerState를 그대로 보존한다.

## 검증

- Vitest가 가속 상한, 지상 감속, 공중 방향 전환, 중복 점프 차단, 양방향 벽·바닥·천장 충돌, 스테이지 착지·첫 장애물 통과와 짧은 입력 시퀀스 결정론 스모크를 검증한다.
