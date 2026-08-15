export interface ValidationMemo<T extends object> {
  assert(value: T): void
  markValidated(value: T): void
}

export function createValidationMemo<T extends object>(
  validate: (value: T) => void,
): ValidationMemo<T> {
  return {
    assert(value): void {
      validate(value)
    },
    markValidated(): void {},
  }
}
