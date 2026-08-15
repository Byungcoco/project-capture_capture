import * as THREE from 'three'

import type { CameraAim } from './browser-input'
import type { GameSnapshot } from '../domain/session'
import type { StaticCollider } from '../domain/player'

const PLAYER_COLOR = 0xffd166
const TERRAIN_COLOR = 0x29465b
const WIREABLE_COLOR = 0x32d9c6

export interface PivotScene {
  canvas: HTMLCanvasElement
  render(snapshot: GameSnapshot, aim: CameraAim): void
  resize(): void
}

export function createPivotScene(
  root: HTMLElement,
  colliders: readonly StaticCollider[],
): PivotScene {
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

  const collisionMeshes = colliders.map((collider) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        collider.halfSize.x * 2,
        collider.halfSize.y * 2,
        collider.halfSize.z * 2,
      ),
      new THREE.MeshStandardMaterial({
        color: collider.wireable ? WIREABLE_COLOR : TERRAIN_COLOR,
        roughness: 0.72,
        metalness: collider.wireable ? 0.15 : 0,
        emissive: collider.wireable ? 0x063b39 : 0x000000,
      }),
    )
    mesh.position.set(collider.center.x, collider.center.y, collider.center.z)
    mesh.receiveShadow = true
    mesh.castShadow = true
    scene.add(mesh)
    return mesh
  })

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

  function resize(): void {
    const width = root.clientWidth
    const height = root.clientHeight
    camera.aspect = width / Math.max(height, 1)
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }
  resize()

  return {
    canvas: renderer.domElement,
    resize,
    render(snapshot, aim): void {
      const { position } = snapshot.player
      player.position.set(position.x, position.y, position.z)
      const forward = new THREE.Vector3(
        Math.sin(aim.yaw) * Math.cos(aim.pitch),
        Math.sin(aim.pitch),
        -Math.cos(aim.yaw) * Math.cos(aim.pitch),
      )
      const right = new THREE.Vector3(Math.cos(aim.yaw), 0, Math.sin(aim.yaw))
      cameraTarget.set(position.x, position.y + 0.65, position.z)
      desiredCamera.copy(cameraTarget)
        .addScaledVector(forward, -6)
        .addScaledVector(right, 1.15)
        .add(verticalOffset)
      cameraOffset.copy(desiredCamera).sub(cameraTarget)
      const desiredDistance = cameraOffset.length()
      raycaster.set(cameraTarget, cameraOffset.normalize())
      raycaster.far = desiredDistance
      const hit = raycaster.intersectObjects(collisionMeshes, false)[0]
      const cameraDistance = hit === undefined
        ? desiredDistance
        : Math.max(0.35, hit.distance - 0.2)
      camera.position.copy(cameraTarget).addScaledVector(cameraOffset, cameraDistance)
      camera.lookAt(cameraTarget.clone().addScaledVector(forward, 12))

      if (snapshot.player.wire === null) {
        wire.visible = false
      } else {
        wire.visible = true
        wireGeometry.setFromPoints([
          new THREE.Vector3(position.x, position.y + 0.6, position.z),
          new THREE.Vector3(
            snapshot.player.wire.anchor.x,
            snapshot.player.wire.anchor.y,
            snapshot.player.wire.anchor.z,
          ),
        ])
      }
      renderer.render(scene, camera)
    },
  }
}
