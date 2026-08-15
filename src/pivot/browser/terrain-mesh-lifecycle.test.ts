import { describe, expect, it, vi } from 'vitest'

import { createTerrainMeshLifecycle } from './terrain-mesh-lifecycle'

describe('terrain InstancedMesh 수명주기', () => {
  it('terrain 교체와 scene dispose에서 각 mesh dispose를 정확히 한 번 호출한다', () => {
    const first = { dispose: vi.fn() }
    const second = { dispose: vi.fn() }
    const replacement = { dispose: vi.fn() }
    const lifecycle = createTerrainMeshLifecycle<typeof first>()

    lifecycle.replace([first, second])
    lifecycle.replace([replacement])

    expect(first.dispose).toHaveBeenCalledTimes(1)
    expect(second.dispose).toHaveBeenCalledTimes(1)
    expect(replacement.dispose).not.toHaveBeenCalled()

    lifecycle.dispose()
    expect(replacement.dispose).toHaveBeenCalledTimes(1)
    lifecycle.dispose()
    expect(replacement.dispose).toHaveBeenCalledTimes(1)
  })
})
