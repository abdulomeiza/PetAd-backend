/**
 * Pet Status Enum
 * Represents the lifecycle states of a pet
 */
export enum PetStatus {
  /**
   * Pet is available for adoption
   */
  AVAILABLE = 'AVAILABLE',

  /**
   * Pet has a pending adoption request
   */
  PENDING = 'PENDING',

  /**
   * Pet is in temporary custody
   */
  IN_CUSTODY = 'IN_CUSTODY',

  /**
   * Pet has been adopted (final state)
   */
  ADOPTED = 'ADOPTED',
}

/**
 * Type definitions for better TypeScript support
 */
export type PetStatusType = keyof typeof PetStatus;

