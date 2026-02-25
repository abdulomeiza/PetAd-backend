import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusTransitionValidator } from './validators/status-transition.validator';
import { UserRole, PetStatus } from '@prisma/client';

/**
 * Pet Service
 * Handles pet lifecycle management including status transitions
 */
@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get pet by ID
   * @param petId - The pet's ID
   * @throws NotFoundException if pet doesn't exist
   */
  async getPetById(petId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      include: { currentOwner: true },
    });

    if (!pet) {
      throw new NotFoundException(`Pet with ID ${petId} not found`);
    }

    return pet;
  }

  /**
   * Update pet status with validation
   * Enforces state machine transitions
   *
   * @param petId - The pet's ID
   * @param newStatus - The desired new status
   * @param userId - The user making the change (for authorization)
   * @param userRole - The user's role (ADMIN, USER, SHELTER)
   * @param reason - Optional reason for the status change (logged in audit)
   * @throws BadRequestException if transition is invalid
   * @throws NotFoundException if pet doesn't exist
   * @throws ForbiddenException if user not authorized
   * @returns Updated pet with new status
   *
   * @example
   * // Approve adoption (change PENDING → ADOPTED)
   * await petsService.updatePetStatus(
   *   petId,
   *   PetStatus.ADOPTED,
   *   userId,
   *   UserRole.ADMIN,
   *   'Adoption approved by admin'
   * );
   *
   * // Complete custody (change IN_CUSTODY → AVAILABLE)
   * await petsService.updatePetStatus(
   *   petId,
   *   PetStatus.AVAILABLE,
   *   userId,
   *   UserRole.ADMIN,
   *   'Custody period completed'
   * );
   *
   * // Admin override: Return adopted pet
   * await petsService.updatePetStatus(
   *   petId,
   *   PetStatus.AVAILABLE,
   *   adminUserId,
   *   UserRole.ADMIN,
   *   'Returned by admin - adoption cancelled'
   * );
   */
  async updatePetStatus(
    petId: string,
    newStatus: PetStatus,
    userId: string,
    userRole: UserRole,
    reason?: string,
  ) {
    const pet = await this.getPetById(petId);

    // Validate the transition
    StatusTransitionValidator.validate(pet.status, newStatus, userRole);

    // Additional authorization checks for sensitive transitions
    this.authorizeStatusUpdate(pet, newStatus, userId, userRole);

    // Perform the update
    const updatedPet = await this.prisma.pet.update({
      where: { id: petId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
      include: { currentOwner: true },
    });

    // Log the status change for audit trail
    this.logStatusChange(petId, pet.status, newStatus, userId, reason);

    return updatedPet;
  }

  /**
   * Get allowed status transitions for a pet
   * Useful for UI to show available actions
   *
   * @param petId - The pet's ID
   * @param userRole - The user's role (optional, to show admin-only transitions)
   */
  async getAllowedTransitions(petId: string, userRole?: UserRole) {
    const pet = await this.getPetById(petId);
    return StatusTransitionValidator.getAllowedTransitions(
      pet.status,
      userRole,
    );
  }

  /**
   * Get transition information for a pet
   * Includes current status, allowed transitions, and descriptions
   */
  async getTransitionInfo(petId: string) {
    const pet = await this.getPetById(petId);
    return StatusTransitionValidator.getTransitionInfo(pet.status);
  }

  /**
   * Change pet status (internal use by adoption/custody services)
   * Called automatically when adoption/custody workflows trigger status changes
   *
   * @internal This should be called by adoption/custody services
   */
  async changeStatusInternal(
    petId: string,
    newStatus: PetStatus,
    reason?: string,
  ) {
    const pet = await this.getPetById(petId);

    // Validate transition (without role restriction for internal calls)
    StatusTransitionValidator.validate(pet.status, newStatus, UserRole.ADMIN);

    const updatedPet = await this.prisma.pet.update({
      where: { id: petId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
      include: { currentOwner: true },
    });

    // Log the change
    this.logStatusChange(
      petId,
      pet.status,
      newStatus,
      undefined, // No user actor for system changes
      reason || 'System-triggered status change',
    );

    return updatedPet;
  }

  /**
   * Authorize status update based on user role and pet ownership
   * @private
   */
  private authorizeStatusUpdate(
    _pet: any,
    newStatus: PetStatus,
    _userId: string,
    userRole: UserRole,
  ) {
    // Only ADMIN can perform certain transitions
    if (newStatus === PetStatus.ADOPTED || newStatus === PetStatus.AVAILABLE) {
      if (userRole !== UserRole.ADMIN) {
        throw new ForbiddenException(
          `Only administrators can change pet status to ${newStatus}`,
        );
      }
    }

    // Pet owner can initiate some transitions (for future enhancement)
    // For now, most transitions require ADMIN
  }

  /**
   * Log status change for audit trail
   * @private
   */
  private logStatusChange(
    petId: string,
    oldStatus: PetStatus,
    newStatus: PetStatus,
    userId?: string,
    reason?: string,
  ) {
    // TODO: Implement event logging to EventLog table
    // This will track all status changes for audit purposes
    console.log(
      `[PET STATUS CHANGE] ${petId}: ${oldStatus} → ${newStatus}${userId ? ` by ${userId}` : ' (system)'}${reason ? ` - ${reason}` : ''}`,
    );
  }
}
