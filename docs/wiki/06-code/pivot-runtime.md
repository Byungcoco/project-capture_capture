---
title: Pivot Runtime
type: implementation
status: verified
tags: [pivot-runtime, cell-terrain, placement, wire-action, combat]
updated: 2026-08-15
summary: develop-jaehyeok 피벗 런타임의 결정론 상태, 캡처·배치·와이어·전투 계산 순서와 브라우저 경계.
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
- E press의 anchor 선택 우선순위는 직접 wireable 명중, 에임 8도 원뿔 보정, 머리 위 자동 보정 순이다. 머리 위 후보는 wire origin보다 최소 1m 높고 수평 5m·전체 12m 안에 있어야 한다.
- 보정 후보는 실제 표면점까지의 첫 ray hit가 같은 wireable 표면일 때만 허용하므로 non-wireable 장애물이나 벽 너머에는 붙지 않는다. 동거리에서는 non-wireable 차폐를 우선한다.
- 후보 선택은 각도·거리·좌표의 안정 순서를 사용한다. 셀/AABB 월드는 BVH 일괄 가시성 조회로 전 후보 의미를 보존하며 큰 지형에서 후보별 전수 raycast를 피한다.
- collision world는 생성 시 collider 값을 내부 불변 snapshot으로 복사해 move, raycast, assist query와 BVH가 항상 같은 기하를 본다.
- E press는 현재 wire origin과 hit point의 거리를 로프 길이로 저장한다. 홀드 중 48틱 만료나 앵커 도착으로 자동 회수하지 않는다.
- 홀드 중 기본 중력 `-24m/s²`와 접평면 WASD 조향 `12m/s²`를 적용한다. 로프 길이를 초과하는 위치와 바깥 radial velocity만 제한하고 접선 운동량은 보존한다.
- 충돌 권위 이동 뒤 로프 보정으로 벽을 관통하지 않는다. 장력 또는 실제 접선 이동을 막는 비지상 contact에서는 와이어를 종료하며 지면 지지만으로 수평 swing을 끊지 않는다.
- 부착 후 12틱 이내의 E release와 매달린 상태의 점프 입력은 회수 발사다. 앵커 바로 위에서 아래로 쏜 raycast로 상단면을 찾고(실패하면 앵커 자체) 그 위 `반높이 + 0.6 + 0.3m`를 목표점으로 `v = (target - origin) / T - 0.5gT`를 푼다. `T`는 거리/18m/s를 0.35~1.2초로 제한한 값이고 결과 속도는 30m/s 상한을 따른다. 비행 틱 동안 공중 감속을 걸지 않으며 착지하면 초기화한다. 근거는 [[../04-decisions/ADR-0009-wire-reel-launch|ADR-0009]]다.
- 12틱을 넘겨 매달린 뒤의 E release는 수평·접선 운동량을 보존하고 수직 속도를 최소 `11m/s`로 올린 뒤 전체 속도를 `30m/s` 안에서 제한한다. 이후 일반 중력의 포물선 운동으로 앵커 지형 상단에 접근한다.
- 와이어 선은 홀드 snapshot에서만 표시하며 고정 position buffer를 재사용한다. release snapshot부터 즉시 숨긴다.

## 전투 계약

- 틱 순서는 capture/placement transaction → player shot spawn → enemy scheduled spawn → projectile 이동·충돌·피해 → player 이동이다. 같은 틱에 배치된 셀도 그 틱의 탄환을 차폐한다.
- 좌클릭은 pointer lock에서 boolean edge 하나로 합쳐지고 첫 physics sample에서 소비된다. unlock과 blur는 queue를 비운다.
- player shot은 cooldown 8틱, 속도 50m/s, 피해 25, TTL 108, 반경 0.12m이고 id는 틱당 하나인 `player-shot-<tick>`이다. camera origin이 player 중심에서 2m를 넘으면 중심 앞 0.6m로 보정한다.
- enemy는 고정형이고 HP 75, halfSize `{0.55,0.75,0.55}`다. 안정 id 순서와 정적 offset으로 150틱마다 발사 시점 player 중심을 향해 속도 10m/s, 피해 15, TTL 300 탄환을 만든다. HP 0이면 목록에서 제거된다.
- 충돌은 한 틱 이동 구간 전체의 swept 검사다. target은 확장 AABB, terrain은 BVH 가지치기 뒤 leaf에서 구-박스 face/edge/corner 접촉 시각을 풀어 횡방향 반경과 사선 접촉을 보존한다. 같은 거리면 terrain이 우선한다.
- 제거 조건은 TTL 0, y < -20, 각 축 절댓값 256m 초과다. 틱 시작 시 이미 위반한 탄환은 충돌·피해 계산 전에 선제 제거한다. player HP는 0 미만으로 내려가지 않는다.
- 외부 주입 enemy/projectile은 신뢰 경계다. 배열·entry·nested vector shape를 property 접근 전에 좁히고 finite 값, 고유 id, `player-shot-*`/`enemy-shot-*` 예약 namespace, hp/ttl/radius/halfSize·컬렉션 상한을 검사한다. 모든 실패 code는 `INVALID_COMBAT_STATE`다.
- id 정렬은 host locale이 아니라 UTF-16 code-unit 비교로 고정한다.
- 렌더는 `kind:owner:id` keyed cache로 생존 entity의 mesh와 GPU 자원을 재사용하고 위치만 갱신한다. 추가·제거된 변경분만 allocate/dispose한다.
- 데모 코스는 시작 섬 뒤로 10~30m 간격의 wireable 발판 4개를 두고 마지막 중심이 spawn에서 수평 65m 이상, 높이 24.1m다. 각 발판 위에 `enemy-01`~`enemy-04`가 있다.

## 검증 상태

- 자동 검증: Vitest 전체 30 files, 164 tests 및 프로덕션 build 통과.
- 브라우저: 확장 발판·enemy 4마리 렌더, HUD `HP 100 · ENEMY 4`와 `LMB FIRE`, console error 0 확인.
- 미검증: 인앱 브라우저에서 pointer lock이 활성화되지 않아 실제 캡처, Q 배치, E 조준 보정·머리 위 자동 연결, 진자·릴리스 착지와 좌클릭 사격·피격 조작감은 수동 플레이테스트가 필요하다.
- 알려진 비기능 경고: Three.js 프로덕션 chunk가 500kB를 초과한다.
