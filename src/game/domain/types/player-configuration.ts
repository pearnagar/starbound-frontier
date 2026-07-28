export const PLAYER_CONTROL_TYPES = ['human', 'ai'] as const

export type PlayerControlType = (typeof PLAYER_CONTROL_TYPES)[number]

export const AI_DIFFICULTIES = ['cadet', 'commander', 'admiral'] as const

export type AiDifficulty = (typeof AI_DIFFICULTIES)[number]

export interface HumanPlayerConfiguration {
  readonly controlType: 'human'
}

export interface AiPlayerConfiguration {
  readonly controlType: 'ai'
  readonly difficulty: AiDifficulty
}

/**
 * Discriminated union so a human configuration structurally cannot carry an
 * AI difficulty, and an AI configuration cannot omit one.
 */
export type PlayerControlConfiguration = HumanPlayerConfiguration | AiPlayerConfiguration

export function isAiPlayerConfiguration(
  config: PlayerControlConfiguration,
): config is AiPlayerConfiguration {
  return config.controlType === 'ai'
}

export function isValidPlayerControlConfiguration(config: PlayerControlConfiguration): boolean {
  switch (config.controlType) {
    case 'human':
      return true
    case 'ai':
      return AI_DIFFICULTIES.includes(config.difficulty)
  }
}
