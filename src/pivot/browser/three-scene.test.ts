import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import type { CapturePreview } from '../domain/capture'
import type { PlacementPreview } from '../domain/placement'
import type { TerrainCell } from '../domain/cell-world'
import {
  capturePreviewCellCount,
  placementPreviewCellCount,
  terrainNeedsSync,
} from './three-scene'
import * as threeScene from './three-scene'

describe('피벗 terrain renderer cache', () => {
  it('같은 frozen terrain 참조는 renderer 재동기화를 요구하지 않는다', () => {
    const terrain = Object.freeze(Array.from(
      { length: 2_000 },
      (_, x): TerrainCell => ({
        index: { x, y: 0, z: 0 },
        material: 'rock',
        collidable: true,
        wireable: false,
        capturable: true,
        destructible: true,
        owner: 'level',
      }),
    ))

    expect(terrainNeedsSync(null, terrain)).toBe(true)
    expect(terrainNeedsSync(terrain, terrain)).toBe(false)
  })

  it('실패 preview는 성공 셀 highlight를 표시하지 않는다', () => {
    const invalidPreview = {
      valid: false,
      failureCode: 'STACK_FULL',
      cubeCenter: { x: 0, y: 0, z: 0 },
      basis: {
        right: { x: 1, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        forward: { x: 0, y: 0, z: -1 },
      },
      cells: [{
        index: { x: 0, y: 0, z: 0 },
        material: 'rock',
        collidable: true,
        wireable: false,
        capturable: true,
        destructible: true,
        owner: 'level',
      }],
    } satisfies CapturePreview

    expect(capturePreviewCellCount(invalidPreview)).toBe(0)
  })

  it('Q hold placement preview는 valid와 invalid 모두 domain target cell만 ghost로 표시한다', () => {
    const cells = [{
      index: { x: 2, y: 3, z: 4 },
      material: 'wood',
      collidable: true,
      wireable: true,
      capturable: true,
      destructible: true,
      owner: 'player',
    }] satisfies TerrainCell[]
    const valid = {
      valid: true,
      failureCode: null,
      anchor: { x: 2, y: 3, z: 4 },
      cells,
    } satisfies PlacementPreview
    const invalid = {
      ...valid,
      valid: false,
      failureCode: 'PLAYER_OVERLAP',
    } satisfies PlacementPreview

    expect(placementPreviewCellCount(valid)).toBe(1)
    expect(placementPreviewCellCount(invalid)).toBe(1)
    expect(placementPreviewCellCount(null)).toBe(0)
  })

  it('실제 placement ghost는 capture cube를 숨기고 invalid 색과 target matrix를 적용한다', () => {
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    )
    const selected = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      2,
    )
    const updatePreview = (
      threeScene as unknown as Record<string, unknown>
    ).updatePreview
    expect(typeof updatePreview).toBe('function')
    if (typeof updatePreview !== 'function') return

    updatePreview(cube, selected, null, {
      valid: false,
      failureCode: 'PLAYER_OVERLAP',
      anchor: { x: 2, y: 3, z: 4 },
      cells: [{
        index: { x: 2, y: 3, z: 4 },
        material: 'wood',
        collidable: true,
        wireable: true,
        capturable: true,
        destructible: true,
        owner: 'player',
      }],
    })

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    selected.getMatrixAt(0, matrix)
    position.setFromMatrixPosition(matrix)
    expect(cube.visible).toBe(false)
    expect(selected.visible).toBe(true)
    expect(selected.count).toBe(1)
    expect((selected.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xff6b6b)
    expect(position.toArray()).toEqual([1.25, 1.75, 2.25])
  })
})
