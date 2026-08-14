---
title: Wiki Index
type: reference
status: verified
tags: [wiki, generated-index, llm-context]
updated: 2026-08-14
generated: true
summary: 원본 위키 문서를 유형별로 나열한 LLM용 정적 인덱스.
---

# Wiki Index

> 생성 파일이다. 직접 편집하지 말고 `python tools/wiki_sync.py sync`를 실행한다.

- 생성 시각: 2026-08-14T19:28:11+09:00
- 원본 문서: 17개

## product

| 문서 | 상태 | 태그 | 요약 | 갱신 |
|---|---|---|---|---|
| [[../01-product/concept|Concept and Judging Criteria]] | verified | concept, judging-criteria, hive | 게임 한 줄 컨셉, 세계관과 심사기준 5개 대응 전략의 원본. | 2026-08-13 |

## design

| 문서 | 상태 | 태그 | 요약 | 갱신 |
|---|---|---|---|---|
| [[../02-design/index|Design Index]] | verified | design-navigation, llm-context | 기획 원본 탐색 허브. 상세 규칙은 각 분야 원본에만 둔다. | 2026-08-13 |
| [[../02-design/gameplay/game-rules|Game Rules]] | verified | rules, controls, level-design | 확정된 게임 규칙, 조작 스킴 v2와 레벨 커리큘럼의 원본. | 2026-08-14 |

## technology

| 문서 | 상태 | 태그 | 요약 | 갱신 |
|---|---|---|---|---|
| [[../03-tech/architecture|Architecture]] | verified | architecture, determinism, module-boundary | 기술 스택, 폴백 가능한 모듈 경계와 결정론 규칙의 원본. | 2026-08-14 |
| [[../03-tech/capture-pipeline|Capture Pipeline]] | verified | capture, geometry, silhouette | 캡처→스탬프→붙여넣기 알고리즘 스펙의 원본. | 2026-08-13 |

## decision

| 문서 | 상태 | 태그 | 요약 | 갱신 |
|---|---|---|---|---|
| [[../04-decisions/ADR-0001-orthographic-capture-concept|ADR-0001: 직교 캡처 퍼즐 플랫포머 컨셉 채택]] | accepted | concept, originality | 원안 2D 캡처를 직교 3D 캡처 + 지형 속성으로 확장 채택한 이유와 대안. | 2026-08-13 |
| [[../04-decisions/ADR-0002-web-stack-vite-ts-three|ADR-0002: Vite + TypeScript + Three.js 스택]] | accepted | stack, web-build | 웹 빌드 제출 요건과 사람-AI 협업을 전제로 한 스택 선택 이유. | 2026-08-13 |
| [[../04-decisions/ADR-0003-deterministic-fixed-timestep|ADR-0003: 결정론 고정 타임스텝 시뮬레이션]] | accepted | determinism, replay | 리플레이 기반 Hive 확장의 전제인 결정론을 첫 마일스톤부터 강제하는 이유. | 2026-08-13 |
| [[../04-decisions/ADR-0004-fallback-core-architecture|ADR-0004: 폴백 가능한 코어 아키텍처]] | accepted | architecture, risk | 직교 캡처 리스크에 대비해 코어를 2D 스탬프 게임으로 정의하고 판정일을 두는 결정. | 2026-08-13 |
| [[../04-decisions/ADR-0005-puzzle-rules-hybrid-and-snap|ADR-0005: 혼합형 퍼즐 + 붙여넣기 스냅 규칙]] | accepted | game-rules, level-design | 다해법 허용 + 최소 캡처 기록, 프레임 자유 + 붙여넣기 스냅을 택한 이유. | 2026-08-13 |
| [[../04-decisions/ADR-0006-adopt-flee-workflow|ADR-0006: project-flee 작업 체계 전면 채택]] | accepted | workflow, collaboration | 팀원의 검증된 협업 체계(위키·wiki_sync·TDD·Git Flow·dispatch)를 그대로 채택한 결정. | 2026-08-13 |
| [[../04-decisions/ADR-0007-game-mode-fsm|ADR-0007: 게임 모드 FSM — core가 소유하고 render가 파생한다]] | accepted | game-mode, fsm, input, replay, determinism | 단일 GameMode FSM, 슬롯 기반 캡처, 조준을 리플레이에서 제외하는 이벤트 기록 방식을 정한 결정. | 2026-08-14 |

## progress

| 문서 | 상태 | 태그 | 요약 | 갱신 |
|---|---|---|---|---|
| [[../05-progress/current|Current]] | verified | current-scope, vertical-slice | 지금 참인 상태, 다음 목표와 완료 조건만 유지하는 작업 원본. | 2026-08-14 |

## implementation

| 문서 | 상태 | 태그 | 요약 | 갱신 |
|---|---|---|---|---|
| [[../06-code/index|Code Knowledge Index]] | verified | code-knowledge, navigation | 구현 지식이 쌓일 자리와 기록 기준을 정의하는 허브. | 2026-08-14 |
| [[../06-code/core|Core Simulation]] | verified | player-physics, collision, determinism | 마일스톤 2의 틱 입력, 관성형 플레이어 물리와 확장 가능한 충돌 해결 계약. | 2026-08-14 |

## reference

| 문서 | 상태 | 태그 | 요약 | 갱신 |
|---|---|---|---|---|
| [[../index|Capture Capture Project Wiki]] | verified | wiki, navigation, llm-context | 사람과 LLM이 프로젝트 원본 지식에 진입하는 최소 탐색 허브. | 2026-08-13 |
| [[../80-inbox/README|Inbox]] | verified | inbox, triage | 위치가 불명확하지만 가치 있는 정보를 임시로 두는 곳. 다음 정리 때 원본으로 이동한다. | 2026-08-13 |

