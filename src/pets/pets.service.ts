import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusTransitionValidator } from './validators/status-transition.validator';
import { UserRole, PetStatus } from '../common/enums';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

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

    // Validate the transition (cast Prisma status to our enum)
    StatusTransitionValidator.validate(
      pet.status as PetStatus,
      newStatus,
      userRole,
    );

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
    this.logStatusChange(
      petId,
      pet.status as PetStatus,
      newStatus,
      userId,
      reason,
    );

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
      pet.status as PetStatus,
      userRole,
    );
  }

  /**
   * Get transition information for a pet
   * Includes current status, allowed transitions, and descriptions
   */
  async getTransitionInfo(petId: string) {
    const pet = await this.getPetById(petId);
    return StatusTransitionValidator.getTransitionInfo(pet.status as PetStatus);
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
    StatusTransitionValidator.validate(
      pet.status as PetStatus,
      newStatus,
      UserRole.ADMIN,
    );

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
      pet.status as PetStatus,
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

  /**
   * Create a new pet
   * @param createPetDto - Data for creating the pet
   * @param ownerId - The ID of the owner (user) adopting the pet
   * @returns The created pet
   */
  async create(createPetDto: CreatePetDto, ownerId: string) {
    return this.prisma.pet.create({
      data: {
        ...createPetDto,
        currentOwnerId: ownerId,
        status: 'AVAILABLE',
      },
      include: { currentOwner: true },
    });
  }

  /**
   * Find all pets
   * @returns List of available pets
   */
  async findAll() {
    return this.prisma.pet.findMany({
      where: { status: 'AVAILABLE' },
      include: { currentOwner: true },
    });
  }

  /**
   * Find a pet by ID
   * @param id - The pet's ID
   * @returns The found pet
   * @throws NotFoundException if pet doesn't exist
   */
  async findOne(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: { currentOwner: true },
    });
    if (!pet) throw new NotFoundException('Pet not found');
    return pet;
  }

  /**
   * Update a pet
   * @param id - The pet's ID
   * @param updatePetDto - Data for updating the pet
   * @param userId - The ID of the user making the request
   * @param userRole - The role of the user (ADMIN, USER, SHELTER)
   * @returns The updated pet
   * @throws NotFoundException if pet doesn't exist
   * @throws ForbiddenException if user not authorized
   */
  async update(
    id: string,
    updatePetDto: UpdatePetDto,
    userId: string,
    userRole: string,
  ) {
    const pet = await this.prisma.pet.findUnique({ where: { id } });
    if (!pet) throw new NotFoundException('Pet not found');
    if (pet.currentOwnerId !== userId && userRole !== 'ADMIN')
      throw new ForbiddenException('Not authorized');
    return this.prisma.pet.update({
      where: { id },
      data: updatePetDto,
      include: { currentOwner: true },
    });
  }

  /**
   * Remove a pet
   * @param id - The pet's ID
   * @param userRole - The role of the user (ADMIN, USER, SHELTER)
   * @returns Success message
   * @throws NotFoundException if pet doesn't exist
   * @throws ForbiddenException if user not authorized
   */
  async remove(id: string, userRole: string) {
    const pet = await this.prisma.pet.findUnique({ where: { id } });
    if (!pet) throw new NotFoundException('Pet not found');
    if (userRole !== 'ADMIN')
      throw new ForbiddenException('Only admin can delete');
    await this.prisma.pet.delete({ where: { id } });
    return { message: 'Pet deleted successfully' };
  }
}
