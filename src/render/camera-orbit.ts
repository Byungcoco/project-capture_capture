export interface OrbitTarget {
  x: number
  y: number
  z: number
}

export interface CameraOrbit {
  readonly yawDegrees: number
  rotate: (direction: -1 | 0 | 1, amountDegrees: number) => void
  reset: () => void
}

export function createCameraOrbit(initialYawDegrees: number): CameraOrbit {
  let yawDegrees = initialYawDegrees
  return {
    get yawDegrees() {
      return yawDegrees
    },
    rotate: (direction, amountDegrees) => {
      yawDegrees = advanceYawDegrees(yawDegrees, direction, amountDegrees)
    },
    reset: () => {
      yawDegrees = initialYawDegrees
    },
  }
}

export function advanceYawDegrees(
  yawDegrees: number,
  direction: -1 | 0 | 1,
  amountDegrees: number,
): number {
  return (yawDegrees + direction * amountDegrees + 360) % 360
}

export function orbitPosition(
  yawDegrees: number,
  radius: number,
  heightOffset: number,
  target: OrbitTarget,
): OrbitTarget {
  const radians = (yawDegrees * Math.PI) / 180
  return {
    x: clean(target.x + Math.sin(radians) * radius),
    y: clean(target.y + heightOffset),
    z: clean(target.z + Math.cos(radians) * radius),
  }
}

function clean(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value
}
