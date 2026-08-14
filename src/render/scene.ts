import * as THREE from 'three'

import type { ColumnMajorMatrix4 } from '../capture/types'
import { CAMERA_AIM_SPEED_DEGREES } from '../core/constants'
import { PLAYER_HALF_SIZE } from '../core/constants'
import { STAGE_BOXES } from '../core/stage'
import type { Vec2 } from '../core/types'
import { createCameraOrbit, orbitPosition } from './camera-orbit'

const CAMERA_HEIGHT = 12
const CAMERA_DEPTH = 16
const VIEW_HEIGHT = 12
const PLAYER_DEPTH = 0.8
const PLAYER_Z = 1 + PLAYER_DEPTH / 2 + 0.05
const CAMERA_TARGET = { x: 0, y: -1, z: 0 } as const
const CAMERA_RADIUS = Math.hypot(10, CAMERA_DEPTH)
const CAMERA_HEIGHT_OFFSET = CAMERA_HEIGHT - CAMERA_TARGET.y
const INITIAL_CAMERA_YAW = (Math.atan2(10, CAMERA_DEPTH) * 180) / Math.PI
const TERRAIN_COLORS = [0x54738f, 0x6389a8, 0x54738f, 0x7398b5, 0x54738f]

export interface GameScene {
  render: (playerPosition: Vec2) => void
  resize: () => void
  rotateAim: (deltaSeconds: number, direction: -1 | 0 | 1) => void
  resetAim: () => void
  getCameraYawDegrees: () => number
  getViewProjectionElements: () => ColumnMajorMatrix4
}

export function createGameScene(container: HTMLElement): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x101621)

  const camera = new THREE.OrthographicCamera()
  camera.position.set(10, CAMERA_HEIGHT, CAMERA_DEPTH)
  camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z)
  const cameraOrbit = createCameraOrbit(INITIAL_CAMERA_YAW)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  container.append(renderer.domElement)

  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x26313e, 2.4))

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8)
  keyLight.position.set(-4, 10, 8)
  keyLight.castShadow = true
  scene.add(keyLight)

  STAGE_BOXES.forEach((terrain, index) => {
    const geometry = new THREE.BoxGeometry(
      terrain.halfSize.x * 2,
      terrain.halfSize.y * 2,
      terrain.halfSize.z * 2,
    )
    const material = new THREE.MeshStandardMaterial({
      color: TERRAIN_COLORS[index],
      roughness: 0.75,
      metalness: 0.05,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(terrain.center.x, terrain.center.y, terrain.center.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  })

  const playerGeometry = new THREE.BoxGeometry(
    PLAYER_HALF_SIZE.x * 2,
    PLAYER_HALF_SIZE.y * 2,
    PLAYER_DEPTH,
  )
  const playerMaterial = new THREE.MeshStandardMaterial({
    color: 0xf6c453,
    roughness: 0.65,
    metalness: 0.05,
  })
  const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial)
  playerMesh.castShadow = true
  scene.add(playerMesh)

  const resize = (): void => {
    const width = container.clientWidth
    const height = container.clientHeight
    const aspect = width / height
    camera.left = (-VIEW_HEIGHT * aspect) / 2
    camera.right = (VIEW_HEIGHT * aspect) / 2
    camera.top = VIEW_HEIGHT / 2
    camera.bottom = -VIEW_HEIGHT / 2
    camera.near = 0.1
    camera.far = 100
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  resize()

  const applyCameraOrbit = (): void => {
    const position = orbitPosition(
      cameraOrbit.yawDegrees,
      CAMERA_RADIUS,
      CAMERA_HEIGHT_OFFSET,
      CAMERA_TARGET,
    )
    camera.position.set(position.x, position.y, position.z)
    camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z)
    camera.updateMatrixWorld()
  }

  return {
    render: (playerPosition) => {
      playerMesh.position.set(playerPosition.x, playerPosition.y, PLAYER_Z)
      renderer.render(scene, camera)
    },
    resize,
    rotateAim: (deltaSeconds, direction) => {
      cameraOrbit.rotate(
        direction,
        CAMERA_AIM_SPEED_DEGREES * deltaSeconds,
      )
      applyCameraOrbit()
    },
    resetAim: () => {
      cameraOrbit.reset()
      applyCameraOrbit()
    },
    getCameraYawDegrees: () => cameraOrbit.yawDegrees,
    getViewProjectionElements: () => {
      camera.updateMatrixWorld()
      const viewProjection = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      )
      return [...viewProjection.elements] as ColumnMajorMatrix4
    },
  }
}
