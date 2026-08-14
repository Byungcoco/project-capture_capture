---
title: Capture and Prototype UI
type: implementation
status: verified
tags: [capture, stamp, game-mode, prototype-ui]
updated: 2026-08-14
summary: 마일스톤 3의 순수 캡처 기하, 카메라 조준, 슬롯과 디버그 UI 구현 계약.
---

# Capture and Prototype UI

## 순수 캡처 계약

- `captureBoxes(boxes, viewProjection, frame)`는 Three.js·DOM 없이 Stamp를 만든다.
- view-projection은 Three.js `Matrix4.elements`와 같은 열 우선 16개 숫자 배열이다.
- 화면 정규화 좌표는 좌하단 원점의 `[0,1]` 범위다. Stamp 정점은 캡처 프레임 좌하단 기준 `[0,1]`로 다시 정규화한다.
- 각 박스의 8개 꼭짓점을 투영하고 monotone chain 볼록 껍질과 Sutherland–Hodgman 사각형 클리핑을 적용한다. 결과가 3개 정점 미만이면 제외한다.
- 박스별 조각을 유지하며 각 조각은 원본 ID와 지형 태그를 가진다. 동일 입력은 정점 순서까지 같은 결과를 만든다.

## 런타임 경계

- `render/scene`은 무대 중심 주위 Y축 궤도와 열 우선 view-projection 복사본을 제공한다.
- CaptureAim에서 Paste까지 조준 각도를 유지하고, Platform 복귀 시 테스트용 초기 pose인 약 32도로 즉시 리셋한다. 향후 기본 pose만 정면 직교 2D 구도로 교체할 수 있다.
- `ui/game-ui`는 비네트·고정 프레임·슬롯 HUD·SVG 미리보기·키 도움말을 표현하며 게임 상태를 소유하지 않는다.
- UI는 모든 모드에서 최신 DOM 포인터 위치를 로컬로 추적하고 CaptureAim 진입 순간 프레임을 그 위치에 배치한다. 이전 캡처 프레임 위치를 재사용하지 않으며 이 포인터 상태는 리플레이 대상이 아니다.
- `main`은 확정 시점에만 카메라 행렬과 프레임을 capture에 전달하고 결과를 선택 슬롯에 저장한다.
- CaptureAim 조준 상태는 리플레이 대상이 아니며 A/D 회전은 렌더 프레임에서 갱신한다. 월드 플레이어 갱신은 `stepSession`이 차단한다.

## 검증

- Vitest로 모드 전이, 슬롯 자동·수동 선택, 시간 정지, 투영, 볼록 껍질, 클리핑, 결정론과 프레임 경계 제한을 검증한다.
- 브라우저에서 Platform → CaptureAim → Paste와 슬롯 1의 3개 조각 SVG 미리보기를 확인했다. 연속 360도 회전 감각과 다양한 프레임 위치의 캡처 결과는 플레이테스트 대기다.
