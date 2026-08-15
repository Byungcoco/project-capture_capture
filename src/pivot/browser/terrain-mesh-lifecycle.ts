export interface DisposableTerrainMesh {
  dispose(): void
}

export interface TerrainMeshLifecycle<T extends DisposableTerrainMesh> {
  current(): readonly T[]
  replace(meshes: readonly T[]): void
  dispose(): void
}

export function createTerrainMeshLifecycle<T extends DisposableTerrainMesh>(): TerrainMeshLifecycle<T> {
  let meshes: readonly T[] = []
  return {
    current: () => meshes,
    replace(next): void {
      meshes = [...next]
    },
    dispose(): void {
      meshes = []
    },
  }
}
