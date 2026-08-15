import { describe, expect, it, vi } from 'vitest'

import { createPageHideHandler, createSceneDispose } from './scene-lifecycle'

describe('피벗 scene page lifecycle', () => {
  it('BFCache pagehide는 보존하고 non-persisted pagehide만 scene을 한 번 정리한다', () => {
    const dispose = vi.fn()
    const handlePageHide = createPageHideHandler(dispose)

    handlePageHide({ persisted: true })
    expect(dispose).not.toHaveBeenCalled()

    handlePageHide({ persisted: false })
    handlePageHide({ persisted: false })
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('PivotScene dispose는 preview InstancedMesh와 나머지 자원을 정확히 한 번 정리한다', () => {
    const previewCells = { dispose: vi.fn() }
    const disposeResources = vi.fn()
    const disposeScene = createSceneDispose(previewCells, disposeResources)

    disposeScene()
    disposeScene()

    expect(previewCells.dispose).toHaveBeenCalledTimes(1)
    expect(disposeResources).toHaveBeenCalledTimes(1)
  })
})
