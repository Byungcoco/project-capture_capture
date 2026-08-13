import * as THREE from 'three'

const CAMERA_HEIGHT = 12
const CAMERA_DEPTH = 16
const VIEW_HEIGHT = 12
const TERRAIN_DEPTH = 2

interface TerrainBox {
  x: number
  y: number
  width: number
  height: number
  color: number
}

const TERRAIN: readonly TerrainBox[] = [
  { x: -7, y: -3.5, width: 5, height: 1, color: 0x54738f },
  { x: -3, y: -2.5, width: 3, height: 3, color: 0x6389a8 },
  { x: 0.5, y: -3.5, width: 4, height: 1, color: 0x54738f },
  { x: 4, y: -2.75, width: 2, height: 2.5, color: 0x7398b5 },
  { x: 7, y: -3.5, width: 4, height: 1, color: 0x54738f },
]

export interface GameScene {
  render: () => void
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

  for (const terrain of TERRAIN) {
    const geometry = new THREE.BoxGeometry(
      terrain.width,
      terrain.height,
      TERRAIN_DEPTH,
    )
    const material = new THREE.MeshStandardMaterial({
      color: terrain.color,
      roughness: 0.75,
      metalness: 0.05,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(terrain.x, terrain.y, 0)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }

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
    render: () => renderer.render(scene, camera),
    resize,
  }
}
