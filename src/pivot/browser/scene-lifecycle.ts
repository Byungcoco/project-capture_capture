export interface DisposableSceneInstance {
  dispose(): void
}

export interface PageHideLikeEvent {
  persisted: boolean
}

export function createPageHideHandler(disposeScene: () => void): (event: PageHideLikeEvent) => void {
  return () => disposeScene()
}

export function createSceneDispose(
  _previewCells: DisposableSceneInstance,
  disposeResources: () => void,
): () => void {
  return () => disposeResources()
}
