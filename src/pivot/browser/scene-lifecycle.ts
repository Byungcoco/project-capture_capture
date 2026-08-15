export interface DisposableSceneInstance {
  dispose(): void
}

export interface PageHideLikeEvent {
  persisted: boolean
}

export function createPageHideHandler(disposeScene: () => void): (event: PageHideLikeEvent) => void {
  let disposed = false
  return (event) => {
    if (event.persisted || disposed) return
    disposed = true
    disposeScene()
  }
}

export function createSceneDispose(
  previewCells: DisposableSceneInstance,
  disposeResources: () => void,
): () => void {
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    previewCells.dispose()
    disposeResources()
  }
}
