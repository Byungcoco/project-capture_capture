export interface ValidationMemo<T extends object> {
  assert(value: T): void
}

export function createValidationMemo<T extends object>(
  validate: (value: T) => void,
  canMemoize: (value: T) => boolean = Object.isFrozen,
): ValidationMemo<T> {
  const validated = new WeakSet<T>()
  return {
    assert(value): void {
      if (canMemoize(value) && validated.has(value)) return
      validate(value)
      if (canMemoize(value)) validated.add(value)
    },
  }
}
