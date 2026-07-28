export interface DomainValidationError {
  readonly code: string
  readonly message: string
  readonly field?: string
}

export type DomainResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly errors: readonly DomainValidationError[] }
