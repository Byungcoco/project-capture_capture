---
title: Current
type: progress
status: verified
tags: [current-scope, vertical-slice]
updated: 2026-08-15
summary: 지금 참인 상태, 다음 목표와 완료 조건만 유지하는 작업 원본.
---

# Current

## 현재 상태

- 2026-08-15 피벗 승인. 장르·핵심 동사와 아키텍처가 [[../04-decisions/ADR-0010-pivot-to-third-person-capture-action|ADR-0010]]·[[../04-decisions/ADR-0011-cell-terrain-authority-architecture|ADR-0011]]로 확정되고 Concept·Game Rules·Architecture·Capture Pipeline 원본에 반영됐다. 직교 퍼즐 시절 ADR 5개는 deprecated다.

- 설계 확정, 저장소 세팅 완료. 브라우저 데모로 캡처 파이프라인 개념 검증 완료.
- 마일스톤 1 완료: Vite+TS 뼈대, 고정 타임스텝 루프, 직교 카메라 씬에 박스 지형 렌더 동작.
- 마일스톤 2 완료: 관성형 이동·점프와 박스 지형 2D AABB 충돌 동작. 공중 수평 가속 40%, 공중 무입력 감속 초당 8, 지상 감속 초당 36.
- 마일스톤 3 구현 완료: GameMode FSM, CaptureAim 시간 정지, Y축 360도 직교 카메라 회전, 30% × 40% 프레임, 순수 캡처 기하, 3개 슬롯, SVG 디버그 미리보기와 Prototype 키 도움말 동작. 플레이테스트 대기.
- `develop-jaehyeok` 피벗 브랜치는 3인칭 이동·대시·더블 점프, 0.5m 셀 지형 절취 캡처, LIFO 스택, 공중 배치와 배치 지형 와이어 연결까지 자동 검증을 완료했다. 와이어는 8도 에임 보정과 머리 위 근거리 자동 연결, E 홀드 진자 가속과 E 해제 상향 포물선 방식이다. 본류 계약과 분리된 상태이며 실제 pointer lock Q/E 플레이테스트는 대기 중이다.
- 피벗 테스트맵을 수평 65m·높이 24.1m까지 확장하고 발판 위 enemy 4마리, 좌클릭 슈팅과 enemy 투사체까지 자동 검증을 완료했다. 실제 발사·피격 조작감은 pointer lock 플레이테스트 대기 중이다.

## 다음 목표 — 피벗 브랜치 통합과 수동 플레이테스트

`develop-jaehyeok`를 `feature/*` 브랜치로 옮겨 develop에 PR로 병합한다. CI는 develop 대상 PR의 head를 `feature/*`, `release/*`, `hotfix/*`, `main`만 허용한다.

병합 전후로 데스크톱 브라우저에서 pointer lock을 잡고 `우클릭 절취 → Q 공중 배치 → E 홀드 진자 → E 탭 회수 → 앵커 상단 착지`와 `좌클릭 사격 → enemy 처치 → 피격 HP 감소`를 직접 확인한다. 자동 검증은 통과했으나 조작감은 미검증이다.

이후 순서:

- 데모 루프 완성: 보스와 데모 섬 콘텐츠 (제출물 본체)
- terrain JSON 덤프로 맵 저작 경로 확보
- 입력 리플레이 기록·재생 (디버깅 + Release Potential)
- GitHub Pages 배포 워크플로

## 완료 조건

- pnpm dev 로컬 실행, pnpm build 성공, 새로고침 후 재현 가능, 콘솔 에러 0
- core/capture/stamp 모듈이 Three.js·DOM을 import하지 않음
- 같은 입력 시퀀스 재생 시 같은 결과 (결정론 스모크 테스트)

## 이번 범위에서 제외

속성 시스템, 다중 스테이지, 리플레이 저장, 아트, 사운드, 메뉴 UI
