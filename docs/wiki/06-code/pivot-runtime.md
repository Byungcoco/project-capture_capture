---
title: Pivot Runtime
type: implementation
status: verified
tags: [pivot-runtime, cell-terrain, placement, wire-action]
updated: 2026-08-15
summary: develop-jaehyeok 피벗 런타임의 결정론 상태, 캡처·배치·와이어 계산 순서와 브라우저 경계.
---

# Pivot Runtime

## 범위와 격리

피벗 구현은 `src/pivot/domain`, `src/pivot/browser`, `src/pivot/demo`에 격리한다. 기존 본류 `src/core`, `src/capture`, `src/stamp`, `src/render`, `src/ui`의 계약은 변경하지 않는다. 상세 제품 방향과 기술 선택은 [[../04-decisions/proposals/develop-jaehyeok-pivot|피벗 제안]]과 [[../03-tech/proposals/develop-jaehyeok-implementation-design|구현 설계]]가 원본이다.

## 권위 상태와 틱 순서

- 순수 TypeScript session이 플레이어, 0.5m 셀 terrain과 최대 5개 LIFO capture stack을 소유한다.
- terrain 배열이 collision, capture, placement validation, wire raycast와 렌더의 단일 원본이다.
- snapshot의 terrain과 stack은 중첩 값까지 동결하며 검증된 내부 snapshot만 검증 memo에 등록한다.
- 한 틱의 action 우선순위는 capture가 placement보다 앞선다. capture가 확정된 틱에는 placement를 실행하지 않는다.
- placement 성공 시 새 terrain collision world를 먼저 만들고, 그 world로 wire aim을 다시 푼 뒤 ordered wire edges와 이동을 계산한다. 따라서 같은 틱에 생성된 셀도 충돌과 와이어 대상이다.

## 캡처 계약

- 오른쪽 클릭은 사거리 18m의 조준 ray와 시선 basis를 command에 확정한다.
- 첫 collidable 표면을 중심으로 시선 정렬 3m 정육면체 안의 셀 중심을 선택한다.
- 성공은 선택 셀을 원자적으로 제거하고 `capture-<tick>` 청크를 stack에 push한다. 최대 216셀이고 stack 5개에서 추가 캡처는 상태를 바꾸지 않는다.
- `gridOffset`은 유한 정수이고 청크 안에서 고유해야 한다. public session 입력은 비정상 offset, 중복과 216셀 초과를 안정 error code로 거부한다.

## 공중 배치 계약

- Q hold는 dry-run preview, Q release는 한 번의 placement transaction이다. 키 반복은 transaction을 늘리지 않으며 blur와 pointer unlock은 hold와 queue를 비운다.
- stack 마지막 청크를 사용한다. ray hit가 있으면 outward normal 지배축의 바깥 한 셀, 없으면 정규화한 ray의 20m 끝점을 floor 양자화한 셀이 anchor다.
- normal 절댓값 동률은 X, Y, Z 순서다. world index는 각 축 -256부터 256까지 허용한다.
- 현재 구현은 회전 없이 청크의 `gridOffset` 형상을 보존한다.
- terrain 중복, 플레이어 AABB 양의 부피 겹침, 사거리·경계 초과와 중복 target은 전체 실패다. preview와 commit은 같은 planner와 failure code를 사용한다.
- 성공 셀은 `owner: player`, 원본 material과 chunk id를 가지며 collidable, wireable, capturable, destructible이다. terrain 증가와 stack pop은 원자적이다.

## 이동과 와이어

- 카메라 기준 WASD, 점프·더블 점프, 대시와 최대 30m 와이어를 지원한다.
- wire 입력은 press/release 순서가 보존되는 edge queue다. 로프는 도메인 오브젝트가 아니며 목표와 당김 상태만 시뮬레이션한다.
- 배치로 terrain이 바뀐 프레임은 action camera ray를 새 world에서 다시 계산해 shoulder camera parallax로 새 셀을 놓치지 않는다.

## 검증 상태

- 자동 검증: Vitest 전체 26 files, 111 tests 및 프로덕션 build 통과.
- 브라우저: 초기 3D terrain/player/HUD와 console error 0 확인.
- 미검증: 인앱 브라우저에서 pointer lock이 활성화되지 않아 실제 캡처, Q ghost/release 배치와 E wire 조작감은 수동 플레이테스트가 필요하다.
- 알려진 비기능 경고: Three.js 프로덕션 chunk가 500kB를 초과한다.
