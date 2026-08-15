export interface ValidationMemo<T extends object> {
  assert(value: T): void
  markValidated(value: T): void
}

export function createValidationMemo<T extends object>(
  validate: (value: T) => void,
): ValidationMemo<T> {
  const validated = new WeakSet<T>()
  return {
    assert(value): void {
      if (Object.isFrozen(value) && validated.has(value)) return
      validate(value)
      if (Object.isFrozen(value)) validated.add(value)
    },
    markValidated(value): void {
      if (Object.isFrozen(value)) validated.add(value)
    },
  }
}
