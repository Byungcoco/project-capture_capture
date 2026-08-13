---
title: "ADR-0006: project-flee 작업 체계 전면 채택"
type: decision
status: accepted
tags: [workflow, collaboration]
updated: 2026-08-13
summary: 팀원의 검증된 협업 체계(위키·wiki_sync·TDD·Git Flow·dispatch)를 그대로 채택한 결정.
---

# ADR-0006: project-flee 작업 체계 전면 채택

## 맥락
2인 팀 협업이 예정되어 있고, 팀원은 project-flee에서 단일 AGENTS.md + 위키 지식베이스 + wiki_sync 자동화 + 전면 TDD + Git Flow + dispatch 스킬로 구성된 AI 협업 체계를 이미 운용해 왔다. 축소 채택안(자동화·전면 TDD 제외)을 검토했으나 두 벌의 작업 방식이 공존하면 한쪽은 반드시 무너진다.

## 결정
project-flee의 작업 체계를 구조·규칙·자동화까지 전면 채택한다. wiki_sync.py, pre-commit 훅, dispatch 스킬, PR 템플릿, 브랜치 정책 CI를 이관하고, 위키는 동일 골격(docs/wiki, frontmatter, wikilink)을 따른다. 단 하나의 상위 조항을 둔다: 기한 내 제출이 다른 모든 목표보다 우선하며, 절차가 제출을 위협하면 줄이고 그 사실을 ADR로 남긴다.

## 이유
- 팀원이 검증한 체계를 그대로 쓰면 온보딩 비용이 0에 수렴하고, 규칙 논쟁 대신 게임 개발에 시간을 쓴다.
- wiki_sync·TDD·보안 게이트는 AI의 허위 완료 보고와 문서 부패를 막는 실질 장치다.
- 서버·DB 등 본 게임에 없는 표면의 규칙은 실제로 발동하지 않으므로 채택 비용이 낮다.

## 고려한 대안
- 축소 채택(자동화·전면 TDD 제외): 초기 속도는 빠르나 팀원 합류 시 규칙 이원화. 기각.
- GitHub Wiki 탭: 코드와 커밋이 분리되어 AI 접근성과 동기화에서 손해. 기각.

## 영향
모든 작업 완료 전 wiki_sync finalize가 의무화된다. 우선순위 조항 발동으로 절차를 줄일 때는 반드시 ADR을 남긴다.
