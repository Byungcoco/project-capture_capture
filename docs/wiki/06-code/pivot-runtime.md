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
- E press는 현재 wire origin과 hit point의 거리를 로프 길이로 저장한다. 홀드 중 48틱 만료나 앵커 도착으로 자동 회수하지 않는다.
- 홀드 중 기본 중력 `-24m/s²`와 접평면 WASD 조향 `12m/s²`를 적용한다. 로프 길이를 초과하는 위치와 바깥 radial velocity만 제한하고 접선 운동량은 보존한다.
- 충돌 권위 이동 뒤 로프 보정으로 벽을 관통하지 않는다. 장력 또는 실제 접선 이동을 막는 비지상 contact에서는 와이어를 종료하며 지면 지지만으로 수평 swing을 끊지 않는다.
- E release는 수평·접선 운동량을 보존하고 수직 속도를 최소 `11m/s`로 올린 뒤 전체 속도를 `30m/s` 안에서 제한한다. 이후 일반 중력의 포물선 운동으로 앵커 지형 상단에 접근한다.
- 와이어 선은 홀드 snapshot에서만 표시하며 고정 position buffer를 재사용한다. release snapshot부터 즉시 숨긴다.

## 검증 상태

- 자동 검증: Vitest 전체 26 files, 120 tests 및 프로덕션 build 통과.
- 브라우저: 초기 3D terrain/player/HUD와 console error 0 확인.
- 미검증: 인앱 브라우저에서 pointer lock이 활성화되지 않아 실제 캡처, Q 배치와 E 홀드 진자·릴리스 착지 조작감은 수동 플레이테스트가 필요하다.
- 알려진 비기능 경고: Three.js 프로덕션 chunk가 500kB를 초과한다.
