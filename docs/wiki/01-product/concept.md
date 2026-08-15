---
title: Concept and Judging Criteria
type: product
status: verified
tags: [concept, judging-criteria, hive]
updated: 2026-08-15
summary: 게임 한 줄 컨셉, 세계관과 심사기준 5개 대응 전략의 원본.
---

# Concept

OpenAI Game Builders Seoul 제출작. 브라우저에서 바로 실행되는 웹 빌드 필수.

## 한 줄 컨셉

공중 섬을 누비는 3인칭 액션. 바라보는 곳의 지형을 정육면체로 **잘라내어** 스택에 담고, 공중 어디든 다시 붙여 발판·엄폐물·와이어 앵커를 만들며 싸운다.

세계관 한 줄: 세계는 손대면 떨어져 나가는 조각으로 이루어져 있고, 주인공은 그 조각을 뜯어 자기 길을 만든다.

근거는 [[../04-decisions/ADR-0010-pivot-to-third-person-capture-action|ADR-0010]]이다.

## 심사기준 대응

- Playability — 캡처가 별도 모드가 아니라 전투 중 즉시 쓰는 동사다. 모드 전환과 시간 정지가 없어 처음 잡아도 조작이 하나로 이어진다
- Originality — 고유 동사 "세계를 잘라 이동과 전투 자원으로 재편집한다". 지형을 복사하는 게임은 있어도 잘라낸 자리와 잘린 조각을 동시에 전술로 쓰는 게임은 드물다
- Codex Collaboration — 절취·배치·와이어·전투 계약을 실패 테스트 우선으로 쌓은 커밋 히스토리와 대화 로그가 증빙
- Release Potential — 결정론 시뮬레이션 → 입력 리플레이 → 해법·기록 공유로 이어지는 Hive 확장 스토리. 구현은 결정론까지, 리플레이부터는 로드맵
- Presentation — 시연 하이라이트: 지형을 잘라 공중에 붙이고 그 발판에 와이어로 붙어 올라가는 한 호흡

## 이전 컨셉

직교 카메라 실루엣을 2D 스탬프로 복사하는 퍼즐 플랫포머였다. 마일스톤 3까지 동작했으나 캡처가 별도 모드에 갇혀 액션과 결합하지 못해 피벗했다. 이력은 [[../04-decisions/ADR-0001-orthographic-capture-concept|ADR-0001]]에 보존한다.
