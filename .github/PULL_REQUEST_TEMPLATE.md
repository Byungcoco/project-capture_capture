## 변경 목적

- 무엇을 왜 바꿨는가:

## 영향

- 계약/도메인/런타임/결정론 영향:

## 검증

- [ ] 위키 검사 (`python tools/wiki_sync.py check`)
- [ ] 관련 테스트와 빌드 (타입 검사, Vitest, `pnpm build`)
- [ ] 결정론 규칙 위반 없음 (가변 dt, Math.random 미사용)
- [ ] 새 판단은 ADR 및 원본 문서에 반영

## Git Flow

- [ ] 대상 브랜치와 source branch가 저장소 규칙에 맞음
- [ ] release/hotfix를 main에 병합한 뒤 develop back-merge 계획이 있음
