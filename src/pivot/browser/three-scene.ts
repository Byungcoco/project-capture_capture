import * as THREE from 'three'

import type { BrowserInputState } from './browser-input'
import type { Ray3 } from './types'
import type { GameSnapshot } from '../domain/session'
import { CAPTURE_CUBE_SIZE, CAPTURE_MAX_CELLS } from '../domain/capture'
import type { CapturePreview } from '../domain/capture'
import type { PlacementPreview } from '../domain/placement'
import { CELL_SIZE, cellCenter } from '../domain/cell-world'
import type { TerrainCell, TerrainMaterial } from '../domain/cell-world'
import { createTerrainMeshLifecycle } from './terrain-mesh-lifecycle'
import { createSceneDispose } from './scene-lifecycle'

const PLAYER_COLOR = 0xffd166
const TERRAIN_COLOR = 0x29465b
const WIREABLE_COLOR = 0x32d9c6
const MATERIAL_COLORS: Record<TerrainMaterial, number> = {
  soil: 0x6e5036,
  rock: TERRAIN_COLOR,
  wood: 0x8c653d,
  water: 0x296f9e,
}

export function terrainNeedsSync(
  previous: readonly TerrainCell[] | null,
  next: readonly TerrainCell[],
): boolean {
  return previous !== next
}

export function capturePreviewCellCount(preview: CapturePreview | null): number {
  return preview === null || !preview.valid
    ? 0
    : Math.min(preview.cells.length, CAPTURE_MAX_CELLS)
}

export function placementPreviewCellCount(preview: PlacementPreview | null): number {
  return preview === null ? 0 : Math.min(preview.cells.length, CAPTURE_MAX_CELLS)
}

export function wireShouldBeVisible(
  wire: GameSnapshot['player']['wire'],
): wire is NonNullable<GameSnapshot['player']['wire']> {
  return wire !== null
}

export interface PivotScene {
  canvas: HTMLCanvasElement
  getCameraRay(snapshot: GameSnapshot, view: BrowserInputState): Ray3
  render(
    snapshot: GameSnapshot,
    view: BrowserInputState,
    capturePreview?: CapturePreview | null,
    placementPreview?: PlacementPreview | null,
  ): void
  resize(): void
  dispose(): void
}

export function createPivotScene(root: HTMLElement): PivotScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x07121c)
  scene.fog = new THREE.Fog(0x07121c, 25, 70)
  const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 120)
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  root.append(renderer.domElement)

  scene.add(new THREE.HemisphereLight(0xa7ddff, 0x16202b, 2.2))
  const sun = new THREE.DirectionalLight(0xffffff, 2.8)
  sun.position.set(8, 18, 10)
  sun.castShadow = true
  scene.add(sun)

  const cellGeometry = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE)
  const cellMaterials = new Map<string, THREE.MeshStandardMaterial>()
  const terrainMeshLifecycle = createTerrainMeshLifecycle<THREE.InstancedMesh>()
  const cameraCollisionMeshes: THREE.InstancedMesh[] = []
  let renderedTerrain: readonly TerrainCell[] | null = null

  const previewCube = new THREE.Mesh(
    new THREE.BoxGeometry(CAPTURE_CUBE_SIZE, CAPTURE_CUBE_SIZE, CAPTURE_CUBE_SIZE),
    new THREE.MeshBasicMaterial({
      color: 0x62f4df,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      wireframe: true,
    }),
  )
  previewCube.visible = false
  scene.add(previewCube)
  const previewCells = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL_SIZE * 1.04, CELL_SIZE * 1.04, CELL_SIZE * 1.04),
    new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
    CAPTURE_MAX_CELLS,
  )
  previewCells.count = 0
  previewCells.visible = false
  scene.add(previewCells)

  const player = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.8, 0.8),
    new THREE.MeshStandardMaterial({ color: PLAYER_COLOR, roughness: 0.55 }),
  )
  player.castShadow = true
  scene.add(player)
  const wireGeometry = new THREE.BufferGeometry()
  const wire = new THREE.Line(
    wireGeometry,
    new THREE.LineBasicMaterial({ color: 0x9efff4 }),
  )
  wire.visible = false
  scene.add(wire)

  const raycaster = new THREE.Raycaster()
  const cameraTarget = new THREE.Vector3()
  const desiredCamera = new THREE.Vector3()
  const cameraOffset = new THREE.Vector3()
  const verticalOffset = new THREE.Vector3(0, 1.25, 0)
  const forward = new THREE.Vector3()
  let preparedSnapshot: GameSnapshot | null = null
  let preparedYaw = Number.NaN
  let preparedPitch = Number.NaN

  function syncTerrain(terrain: readonly TerrainCell[]): void {
    if (!terrainNeedsSync(renderedTerrain, terrain)) return
    renderedTerrain = terrain
    for (const mesh of terrainMeshLifecycle.current()) {
      scene.remove(mesh)
    }
    cameraCollisionMeshes.length = 0
    const nextTerrainMeshes: THREE.InstancedMesh[] = []
    const groups = new Map<string, TerrainCell[]>()
    for (const cell of terrain) {
      const materialKey = `${cell.material}:${cell.collidable}:${cell.wireable}`
      const group = groups.get(materialKey) ?? []
      group.push(cell)
      groups.set(materialKey, group)
    }
    const matrix = new THREE.Matrix4()
    for (const [materialKey, cells] of groups) {
      let material = cellMaterials.get(materialKey)
      if (material === undefined) {
        const sample = cells[0]
        if (sample === undefined) continue
        material = new THREE.MeshStandardMaterial({
          color: sample.wireable ? WIREABLE_COLOR : MATERIAL_COLORS[sample.material],
          roughness: 0.72,
          metalness: sample.wireable ? 0.15 : 0,
          emissive: sample.wireable ? 0x063b39 : 0,
          transparent: sample.material === 'water',
          opacity: sample.material === 'water' ? 0.7 : 1,
        })
        cellMaterials.set(materialKey, material)
      }
      const mesh = new THREE.InstancedMesh(cellGeometry, material, cells.length)
      for (let index = 0; index < cells.length; index += 1) {
        const cell = cells[index]
        if (cell === undefined) continue
        const center = cellCenter(cell.index)
        matrix.makeTranslation(center.x, center.y, center.z)
        mesh.setMatrixAt(index, matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.receiveShadow = true
      mesh.castShadow = true
      scene.add(mesh)
      nextTerrainMeshes.push(mesh)
      if (cells[0]?.collidable) cameraCollisionMeshes.push(mesh)
    }
    terrainMeshLifecycle.replace(nextTerrainMeshes)
  }

  function updateCamera(snapshot: GameSnapshot, view: BrowserInputState): void {
    const { position } = snapshot.player
    forward.set(
      Math.sin(view.yaw) * Math.cos(view.pitch),
      Math.sin(view.pitch),
      -Math.cos(view.yaw) * Math.cos(view.pitch),
    )
    const right = new THREE.Vector3(Math.cos(view.yaw), 0, Math.sin(view.yaw))
    cameraTarget.set(position.x, position.y + 0.65, position.z)
    desiredCamera.copy(cameraTarget)
      .addScaledVector(forward, -6)
      .addScaledVector(right, 1.15)
      .add(verticalOffset)
    cameraOffset.copy(desiredCamera).sub(cameraTarget)
    const desiredDistance = cameraOffset.length()
    raycaster.set(cameraTarget, cameraOffset.normalize())
    raycaster.far = desiredDistance
    const hit = raycaster.intersectObjects(cameraCollisionMeshes, false)[0]
    const cameraDistance = hit === undefined
      ? desiredDistance
      : Math.max(0.35, hit.distance - 0.2)
    camera.position.copy(cameraTarget).addScaledVector(cameraOffset, cameraDistance)
    camera.lookAt(cameraTarget.clone().addScaledVector(forward, 12))
    camera.updateMatrixWorld()
  }

  function prepareCamera(snapshot: GameSnapshot, view: BrowserInputState): void {
    syncTerrain(snapshot.terrain)
    if (
      preparedSnapshot === snapshot
      && preparedYaw === view.yaw
      && preparedPitch === view.pitch
    ) return
    updateCamera(snapshot, view)
    preparedSnapshot = snapshot
    preparedYaw = view.yaw
    preparedPitch = view.pitch
  }

  function resize(): void {
    const width = root.clientWidth
    const height = root.clientHeight
    camera.aspect = width / Math.max(height, 1)
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    preparedSnapshot = null
  }
  resize()
  const disposeScene = createSceneDispose(previewCells, () => {
    for (const mesh of terrainMeshLifecycle.current()) scene.remove(mesh)
    terrainMeshLifecycle.dispose()
    cellGeometry.dispose()
    for (const material of cellMaterials.values()) material.dispose()
    previewCube.geometry.dispose()
    disposeMaterial(previewCube.material)
    previewCells.geometry.dispose()
    disposeMaterial(previewCells.material)
    player.geometry.dispose()
    disposeMaterial(player.material)
    wireGeometry.dispose()
    disposeMaterial(wire.material)
    renderer.dispose()
  })

  return {
    canvas: renderer.domElement,
    resize,
    getCameraRay(snapshot, view): Ray3 {
      prepareCamera(snapshot, view)
      const direction = new THREE.Vector3()
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
      camera.getWorldDirection(direction)
      return {
        origin: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        direction: { x: direction.x, y: direction.y, z: direction.z },
        basis: {
          right: { x: right.x, y: right.y, z: right.z },
          up: { x: up.x, y: up.y, z: up.z },
          forward: { x: direction.x, y: direction.y, z: direction.z },
        },
      }
    },
    render(snapshot, view, capturePreview = null, placementPreview = null): void {
      prepareCamera(snapshot, view)
      const { position } = snapshot.player
      player.position.set(position.x, position.y, position.z)
      const activeWire = snapshot.player.wire
      if (!wireShouldBeVisible(activeWire)) {
        wire.visible = false
      } else {
        wire.visible = true
        wireGeometry.setFromPoints([
          new THREE.Vector3(position.x, position.y + 0.6, position.z),
          new THREE.Vector3(
            activeWire.anchor.x,
            activeWire.anchor.y,
            activeWire.anchor.z,
          ),
        ])
      }
      updatePreview(previewCube, previewCells, capturePreview, placementPreview)
      renderer.render(scene, camera)
    },
    dispose: disposeScene,
  }
}

function disposeMaterial(material: THREE.Material | readonly THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const entry of material) entry.dispose()
    return
  }
  ;(material as THREE.Material).dispose()
}

export function updatePreview(
  cube: THREE.Mesh,
  selected: THREE.InstancedMesh,
  capturePreview: CapturePreview | null,
  placementPreview: PlacementPreview | null,
): void {
  if (placementPreview !== null) {
    cube.visible = false
    selected.count = placementPreviewCellCount(placementPreview)
    selected.visible = selected.count > 0
    const material = selected.material as THREE.MeshBasicMaterial
    material.color.setHex(placementPreview.valid ? 0x62f4df : 0xff6b6b)
    updatePreviewCellMatrices(selected, placementPreview.cells)
    return
  }
  const preview = capturePreview
  if (preview === null) {
    cube.visible = false
    selected.visible = false
    selected.count = 0
    return
  }
  cube.visible = true
  cube.position.set(preview.cubeCenter.x, preview.cubeCenter.y, preview.cubeCenter.z)
  const cubeMaterial = cube.material as THREE.MeshBasicMaterial
  cubeMaterial.color.setHex(preview.valid ? 0x62f4df : 0xff6b6b)
  const basisMatrix = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(preview.basis.right.x, preview.basis.right.y, preview.basis.right.z),
    new THREE.Vector3(preview.basis.up.x, preview.basis.up.y, preview.basis.up.z),
    new THREE.Vector3(preview.basis.forward.x, preview.basis.forward.y, preview.basis.forward.z),
  )
  cube.quaternion.setFromRotationMatrix(basisMatrix)

  selected.count = capturePreviewCellCount(preview)
  selected.visible = selected.count > 0
  const material = selected.material as THREE.MeshBasicMaterial
  material.color.setHex(0xffd166)
  updatePreviewCellMatrices(selected, preview.cells)
}

function updatePreviewCellMatrices(
  selected: THREE.InstancedMesh,
  cells: readonly TerrainCell[],
): void {
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < selected.count; index += 1) {
    const cell = cells[index]
    if (cell === undefined) continue
    const center = cellCenter(cell.index)
    matrix.makeTranslation(center.x, center.y, center.z)
    selected.setMatrixAt(index, matrix)
  }
  selected.instanceMatrix.needsUpdate = true
}
