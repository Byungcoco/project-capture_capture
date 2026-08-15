import type { Vec3 } from '../domain/math'
import type { CaptureBasis } from '../domain/commands'

export interface Ray3 {
  origin: Vec3
  direction: Vec3
  basis: CaptureBasis
}
