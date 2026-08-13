export interface FixedStepAdvance {
  steps: number
  remainderSeconds: number
  alpha: number
}

export function advanceFixedStep(
  accumulatedSeconds: number,
  stepSeconds: number,
  maxSteps = Number.POSITIVE_INFINITY,
): FixedStepAdvance {
  const fractionalSteps = accumulatedSeconds / stepSeconds
  const availableSteps = Math.floor(fractionalSteps)
  const steps = Math.min(availableSteps, maxSteps)
  const droppedTime = availableSteps > maxSteps
  const alpha = droppedTime ? 0 : fractionalSteps - steps
  const remainderSeconds = alpha * stepSeconds

  return {
    steps,
    remainderSeconds,
    alpha,
  }
}
