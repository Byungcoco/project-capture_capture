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
  const release = (): void => {
    for (const mesh of meshes) mesh.dispose()
    meshes = []
  }
  return {
    current: () => meshes,
    replace(next): void {
      release()
      meshes = [...next]
    },
    dispose(): void {
      release()
    },
  }
}
