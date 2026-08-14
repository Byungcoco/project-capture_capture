import * as THREE from 'three'

import { PLAYER_HALF_SIZE } from '../core/constants'
import { STAGE_COLLIDERS } from '../core/stage'
import type { Vec2 } from '../core/types'

const CAMERA_HEIGHT = 12
const CAMERA_DEPTH = 16
const VIEW_HEIGHT = 12
const TERRAIN_DEPTH = 2
const PLAYER_DEPTH = 0.8
const PLAYER_Z = TERRAIN_DEPTH / 2 + PLAYER_DEPTH / 2 + 0.05
const TERRAIN_COLORS = [0x54738f, 0x6389a8, 0x54738f, 0x7398b5, 0x54738f]

export interface GameScene {
  render: (playerPosition: Vec2) => void
  resize: () => void
}

export function createGameScene(container: HTMLElement): GameScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x101621)

  const camera = new THREE.OrthographicCamera()
  camera.position.set(10, CAMERA_HEIGHT, CAMERA_DEPTH)
  camera.lookAt(0, -1, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  container.append(renderer.domElement)

  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x26313e, 2.4))

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8)
  keyLight.position.set(-4, 10, 8)
  keyLight.castShadow = true
  scene.add(keyLight)

  STAGE_COLLIDERS.forEach((terrain, index) => {
    const geometry = new THREE.BoxGeometry(
      terrain.halfSize.x * 2,
      terrain.halfSize.y * 2,
      TERRAIN_DEPTH,
    )
    const material = new THREE.MeshStandardMaterial({
      color: TERRAIN_COLORS[index],
      roughness: 0.75,
      metalness: 0.05,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(terrain.center.x, terrain.center.y, 0)
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

  return {
    render: (playerPosition) => {
      playerMesh.position.set(playerPosition.x, playerPosition.y, PLAYER_Z)
      renderer.render(scene, camera)
    },
    resize,
  }
}
