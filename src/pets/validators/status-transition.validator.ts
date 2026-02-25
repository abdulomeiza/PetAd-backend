import { BadRequestException } from '@nestjs/common';
import { PetStatus, UserRole } from '../../common/enums';

/**
 * Pet Status Transition Validator
 * Implements state machine for pet status lifecycle
 *
 * Valid Transitions:
 * AVAILABLE → PENDING (adoption request created)
 * AVAILABLE → IN_CUSTODY (custody agreement created)
 * PENDING → ADOPTED (adoption approved)
 * PENDING → AVAILABLE (adoption rejected)
 * IN_CUSTODY → AVAILABLE (custody completed)
 * ADOPTED → AVAILABLE (admin return process only)
 */
export class StatusTransitionValidator {
  /**
   * Defines allowed status transitions
   * Maps from current status to array of allowed target statuses
   */
  private static readonly ALLOWED_TRANSITIONS: Record<PetStatus, PetStatus[]> =
    {
      [PetStatus.AVAILABLE]: [PetStatus.PENDING, PetStatus.IN_CUSTODY],
      [PetStatus.PENDING]: [PetStatus.ADOPTED, PetStatus.AVAILABLE],
      [PetStatus.IN_CUSTODY]: [PetStatus.AVAILABLE],
      [PetStatus.ADOPTED]: [],
    };

  private static readonly ADMIN_ONLY_TRANSITIONS: Record<
    PetStatus,
    PetStatus[]
  > = {
    [PetStatus.AVAILABLE]: [],
    [PetStatus.PENDING]: [],
    [PetStatus.IN_CUSTODY]: [],
    [PetStatus.ADOPTED]: [PetStatus.AVAILABLE], // Return adopted pet
  };

  /**
   * Validates if a transition from currentStatus to newStatus is allowed
   *
   * @param currentStatus - The pet's current status
   * @param newStatus - The desired new status
   * @param userRole - The role of the user attempting the transition (optional, for admin overrides)
   * @throws BadRequestException if transition is invalid
   * @returns true if transition is valid
   *
   * @example
   * // Valid transition
   * StatusTransitionValidator.validate('AVAILABLE', 'PENDING'); // ✓
   *
   * // Invalid transition (no-op)
   * StatusTransitionValidator.validate('AVAILABLE', 'AVAILABLE'); // ✗
   *
   * // Admin override
   * StatusTransitionValidator.validate('ADOPTED', 'AVAILABLE', 'ADMIN'); // ✓
   */
  static validate(
    currentStatus: PetStatus,
    newStatus: PetStatus,
    userRole?: UserRole,
  ): boolean {
    // Check for no-op (same status)
    if (currentStatus === newStatus) {
      throw new BadRequestException(
        `Pet status is already ${currentStatus}. No transition needed.`,
      );
    }

    // Check if valid status values
    if (!Object.values(PetStatus).includes(currentStatus)) {
      throw new BadRequestException(`Invalid current status: ${currentStatus}`);
    }
    if (
      !Object.values(StatusTransitionValidator.ALLOWED_TRANSITIONS)
        .flat()
        .includes(newStatus)
    ) {
      throw new BadRequestException(`Invalid new status: ${newStatus}`);
    }

    // Check standard allowed transitions
    const allowedTransitions =
      StatusTransitionValidator.ALLOWED_TRANSITIONS[currentStatus] || [];
    const isAllowedTransition = allowedTransitions.includes(newStatus);

    if (isAllowedTransition) {
      return true;
    }

    // Check admin-only transitions
    const adminOnlyTransitions =
      StatusTransitionValidator.ADMIN_ONLY_TRANSITIONS[currentStatus];
    if (adminOnlyTransitions && adminOnlyTransitions.includes(newStatus)) {
      if (userRole === UserRole.ADMIN) {
        return true;
      }
      throw new BadRequestException(
        `Cannot change status from ${currentStatus} to ${newStatus}. This action requires ADMIN role.`,
      );
    }

    // Invalid transition
    throw new BadRequestException(
      `Cannot change status from ${currentStatus} to ${newStatus}. This transition is not allowed.`,
    );
  }

  /**
   * Get all allowed transitions from a given status
   *
   * @param currentStatus - The pet's current status
   * @param userRole - The role of the user (optional, to include admin-only transitions)
   * @returns Array of allowed target statuses
   */
  static getAllowedTransitions(
    currentStatus: PetStatus,
    userRole?: UserRole,
  ): PetStatus[] {
    const standardTransitions = this.ALLOWED_TRANSITIONS[currentStatus] || [];
    const adminTransitions =
      userRole === UserRole.ADMIN
        ? this.ADMIN_ONLY_TRANSITIONS[currentStatus] || []
        : [];

    return Array.from(new Set([...standardTransitions, ...adminTransitions]));
  }

  /**
   * Check if a transition is valid (does not throw)
   * Useful for conditional logic instead of try-catch
   *
   * @param currentStatus - The pet's current status
   * @param newStatus - The desired new status
   * @param userRole - The role of the user (optional)
   * @returns true if transition is valid, false otherwise
   */
  static isTransitionValid(
    currentStatus: PetStatus,
    newStatus: PetStatus,
    userRole?: UserRole,
  ): boolean {
    try {
      return this.validate(currentStatus, newStatus, userRole);
    } catch {
      return false;
    }
  }

  /**
   * Get detailed transition information
   * Useful for UI feedback and documentation
   */
  static getTransitionInfo(currentStatus: PetStatus) {
    return {
      currentStatus,
      allowedTransitions: this.ALLOWED_TRANSITIONS[currentStatus] || [],
      adminOnlyTransitions: this.ADMIN_ONLY_TRANSITIONS[currentStatus] || [],
      description: this.getStatusDescription(currentStatus),
    };
  }

  /**
   * Get human-readable description for a status
   */
  private static getStatusDescription(status: PetStatus): string {
    const descriptions: Record<PetStatus, string> = {
      AVAILABLE: 'Pet is available for adoption',
      PENDING: 'Pet has a pending adoption request',
      IN_CUSTODY: 'Pet is in temporary custody',
      ADOPTED: 'Pet has been adopted',
    };
    return descriptions[status];
  }
}
