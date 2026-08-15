import { describe, expect, it } from 'vitest'

import { IDLE_PLAYER_COMMAND } from '../domain/commands'
import type { CollisionRayHit, CollisionWorld } from '../domain/collision-world'
import type { Vec3 } from '../domain/math'
import { createPlayerState, stepPlayer } from '../domain/player'
import { solveCameraAim } from './aim'

const STEP_SECONDS = 1 / 60
const CAMERA_FORWARD = { x: 0, y: 0, z: -1 }
const CAMERA_ORIGIN = { x: 2, y: 4, z: 5 }
const PLAYER_WIRE_ORIGIN = { x: 0, y: 1.5, z: 0 }

describe('카메라 이동 basis와 wire parallax 통합', () => {
  it('같은 yaw에서는 reticle hit 거리에 관계없이 W 이동과 무입력 dash XZ 방향이 같다', () => {
    const aimDirections = [
      solveCameraAim(
        queryWorld(cameraHitAt(-4)),
        CAMERA_ORIGIN,
        CAMERA_FORWARD,
        PLAYER_WIRE_ORIGIN,
        30,
      ).aimDirection,
      solveCameraAim(
        queryWorld(cameraHitAt(-20)),
        CAMERA_ORIGIN,
        CAMERA_FORWARD,
        PLAYER_WIRE_ORIGIN,
        30,
      ).aimDirection,
      solveCameraAim(
        queryWorld(null),
        CAMERA_ORIGIN,
        CAMERA_FORWARD,
        PLAYER_WIRE_ORIGIN,
        30,
      ).aimDirection,
    ]

    const movementDirections = aimDirections.map((wireAimDirection) => {
      const player = stepPlayer(
        createPlayerState(),
        {
          ...IDLE_PLAYER_COMMAND,
          moveZ: 1,
          aimDirection: wireAimDirection,
          cameraForward: CAMERA_FORWARD,
          wireAimDirection,
        },
        integratingWorld(),
        STEP_SECONDS,
      )
      return horizontalDirection(player.velocity)
    })
    const dashDirections = aimDirections.map((wireAimDirection) => {
      const player = stepPlayer(
        createPlayerState(),
        {
          ...IDLE_PLAYER_COMMAND,
          dashPressed: true,
          aimDirection: wireAimDirection,
          cameraForward: CAMERA_FORWARD,
          wireAimDirection,
        },
        integratingWorld(),
        STEP_SECONDS,
      )
      return horizontalDirection(player.velocity)
    })

    for (const direction of [...movementDirections, ...dashDirections]) {
      expect(direction.x).toBeCloseTo(CAMERA_FORWARD.x, 10)
      expect(direction.z).toBeCloseTo(CAMERA_FORWARD.z, 10)
    }
  })
})

function cameraHitAt(z: number): CollisionRayHit {
  return {
    point: { x: CAMERA_ORIGIN.x, y: CAMERA_ORIGIN.y, z },
    distance: CAMERA_ORIGIN.z - z,
    wireable: true,
  }
}

function queryWorld(hit: CollisionRayHit | null): CollisionWorld {
  return {
    raycast: (_origin, _direction, maximumDistance) => (
      hit !== null && hit.distance <= maximumDistance ? hit : null
    ),
    moveAabb: (position, velocity) => ({
      position,
      velocity,
      grounded: false,
      blocked: false,
      contacts: [],
    }),
  }
}

function integratingWorld(): CollisionWorld {
  return {
    raycast: () => null,
    moveAabb(position, velocity, _halfSize, stepSeconds) {
      return {
        position: {
          x: position.x + velocity.x * stepSeconds,
          y: position.y + velocity.y * stepSeconds,
          z: position.z + velocity.z * stepSeconds,
        },
        velocity: { ...velocity },
        grounded: false,
        blocked: false,
        contacts: [],
      }
    },
  }
}

function horizontalDirection(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.z)
  return { x: vector.x / length, y: 0, z: vector.z / length }
}
