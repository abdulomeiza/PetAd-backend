import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PetsService } from '../pets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PetStatus } from '@prisma/client';
import { UserRole } from '@prisma/client';

describe('PetsService - Status Lifecycle', () => {
  let service: PetsService;

  const mockPrisma = {
    pet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockPet = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Buddy',
    species: 'DOG',
    breed: 'Golden Retriever',
    age: 3,
    description: 'Friendly dog',
    imageUrl: 'https://example.com/buddy.jpg',
    status: 'AVAILABLE' as PetStatus,
    currentOwnerId: '550e8400-e29b-41d4-a716-446655440001',
    createdAt: new Date(),
    updatedAt: new Date(),
    currentOwner: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'owner@example.com',
    },
  };

  const userId = '550e8400-e29b-41d4-a716-446655440002';
  const adminId = '550e8400-e29b-41d4-a716-446655440003';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PetsService>(PetsService);

    jest.clearAllMocks();
  });

  describe('getPetById', () => {
    it('should return a pet by ID', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(mockPet);

      const result = await service.getPetById(mockPet.id);

      expect(result).toEqual(mockPet);
      expect(mockPrisma.pet.findUnique).toHaveBeenCalledWith({
        where: { id: mockPet.id },
        include: { currentOwner: true },
      });
    });

    it('should throw NotFoundException if pet does not exist', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(null);

      await expect(service.getPetById('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePetStatus - Valid Transitions', () => {
    it('should allow AVAILABLE → PENDING transition (adoption request)', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(mockPet);
      mockPrisma.pet.update.mockResolvedValue({
        ...mockPet,
        status: 'PENDING' as PetStatus,
      });

      const result = await service.updatePetStatus(
        mockPet.id,
        'PENDING' as PetStatus,
        adminId,
        UserRole.ADMIN,
        'Adoption request received',
      );

      expect(result.status).toBe('PENDING' as PetStatus);
      expect(mockPrisma.pet.update).toHaveBeenCalled();
    });

    it('should allow AVAILABLE → IN_CUSTODY transition (custody created)', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(mockPet);
      mockPrisma.pet.update.mockResolvedValue({
        ...mockPet,
        status: 'IN_CUSTODY' as PetStatus,
      });

      const result = await service.updatePetStatus(
        mockPet.id,
        'IN_CUSTODY' as PetStatus,
        adminId,
        UserRole.ADMIN,
        'Custody agreement created',
      );

      expect(result.status).toBe('IN_CUSTODY' as PetStatus);
    });

    it('should allow PENDING → ADOPTED transition (adoption approved)', async () => {
      const pendingPet = { ...mockPet, status: 'PENDING' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(pendingPet);
      mockPrisma.pet.update.mockResolvedValue({
        ...pendingPet,
        status: 'ADOPTED' as PetStatus,
      });

      const result = await service.updatePetStatus(
        mockPet.id,
        'ADOPTED' as PetStatus,
        adminId,
        UserRole.ADMIN,
        'Adoption approved',
      );

      expect(result.status).toBe('ADOPTED' as PetStatus);
    });

    it('should allow PENDING → AVAILABLE transition (adoption rejected)', async () => {
      const pendingPet = { ...mockPet, status: 'PENDING' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(pendingPet);
      mockPrisma.pet.update.mockResolvedValue({
        ...pendingPet,
        status: 'AVAILABLE' as PetStatus,
      });

      const result = await service.updatePetStatus(
        mockPet.id,
        'AVAILABLE' as PetStatus,
        adminId,
        UserRole.ADMIN,
        'Adoption rejected',
      );

      expect(result.status).toBe('AVAILABLE' as PetStatus);
    });

    it('should allow IN_CUSTODY → AVAILABLE transition (custody completed)', async () => {
      const custodyPet = { ...mockPet, status: 'IN_CUSTODY' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(custodyPet);
      mockPrisma.pet.update.mockResolvedValue({
        ...custodyPet,
        status: 'AVAILABLE' as PetStatus,
      });

      const result = await service.updatePetStatus(
        mockPet.id,
        'AVAILABLE' as PetStatus,
        adminId,
        UserRole.ADMIN,
        'Custody period completed',
      );

      expect(result.status).toBe('AVAILABLE' as PetStatus);
    });
  });

  describe('updatePetStatus - Admin-Only Transitions', () => {
    it('should allow ADMIN to change ADOPTED → AVAILABLE (return pet)', async () => {
      const adoptedPet = { ...mockPet, status: 'ADOPTED' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(adoptedPet);
      mockPrisma.pet.update.mockResolvedValue({
        ...adoptedPet,
        status: 'AVAILABLE' as PetStatus,
      });

      const result = await service.updatePetStatus(
        mockPet.id,
        'AVAILABLE' as PetStatus,
        adminId,
        UserRole.ADMIN,
        'Pet returned by adopter',
      );

      expect(result.status).toBe('AVAILABLE' as PetStatus);
    });

    it('should prevent non-ADMIN from changing status to ADOPTED', async () => {
      const pendingPet = { ...mockPet, status: 'PENDING' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(pendingPet);

      await expect(
        service.updatePetStatus(
          mockPet.id,
          'ADOPTED' as PetStatus,
          userId,
          UserRole.USER,
          'Trying to approve adoption as regular user',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updatePetStatus - Invalid Transitions', () => {
    it('should block ADOPTED → PENDING transition', async () => {
      const adoptedPet = { ...mockPet, status: 'ADOPTED' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(adoptedPet);

      await expect(
        service.updatePetStatus(
          mockPet.id,
          'PENDING' as PetStatus,
          adminId,
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block ADOPTED → IN_CUSTODY transition', async () => {
      const adoptedPet = { ...mockPet, status: 'ADOPTED' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(adoptedPet);

      await expect(
        service.updatePetStatus(
          mockPet.id,
          'IN_CUSTODY' as PetStatus,
          adminId,
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block IN_CUSTODY → ADOPTED transition', async () => {
      const custodyPet = { ...mockPet, status: 'IN_CUSTODY' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(custodyPet);

      await expect(
        service.updatePetStatus(
          mockPet.id,
          'ADOPTED' as PetStatus,
          adminId,
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block IN_CUSTODY → PENDING transition', async () => {
      const custodyPet = { ...mockPet, status: 'IN_CUSTODY' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(custodyPet);

      await expect(
        service.updatePetStatus(
          mockPet.id,
          'PENDING' as PetStatus,
          adminId,
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block same status update (no-op)', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(mockPet);

      await expect(
        service.updatePetStatus(
          mockPet.id,
          'AVAILABLE' as PetStatus,
          adminId,
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return correct transitions for AVAILABLE status', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(mockPet);

      const result = await service.getAllowedTransitions(
        mockPet.id,
        UserRole.ADMIN,
      );

      expect(result).toContain('PENDING' as PetStatus);
      expect(result).toContain('IN_CUSTODY' as PetStatus);
      expect(result).not.toContain('ADOPTED' as PetStatus);
    });

    it('should return correct transitions for PENDING status', async () => {
      const pendingPet = { ...mockPet, status: 'PENDING' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(pendingPet);

      const result = await service.getAllowedTransitions(mockPet.id);

      expect(result).toContain('ADOPTED' as PetStatus);
      expect(result).toContain('AVAILABLE' as PetStatus);
    });

    it('should return correct transitions for IN_CUSTODY status', async () => {
      const custodyPet = { ...mockPet, status: 'IN_CUSTODY' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(custodyPet);

      const result = await service.getAllowedTransitions(mockPet.id);

      expect(result).toEqual(['AVAILABLE' as PetStatus]);
    });

    it('should include admin-only transitions for ADMIN users', async () => {
      const adoptedPet = { ...mockPet, status: 'ADOPTED' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(adoptedPet);

      const result = await service.getAllowedTransitions(
        mockPet.id,
        UserRole.ADMIN,
      );

      expect(result).toContain('AVAILABLE' as PetStatus);
    });

    it('should NOT include admin-only transitions for non-ADMIN users', async () => {
      const adoptedPet = { ...mockPet, status: 'ADOPTED' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(adoptedPet);

      const result = await service.getAllowedTransitions(
        mockPet.id,
        UserRole.USER,
      );

      expect(result).not.toContain('AVAILABLE' as PetStatus);
    });
  });

  describe('getTransitionInfo', () => {
    it('should return transition info for a pet', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(mockPet);

      const result = await service.getTransitionInfo(mockPet.id);

      expect(result).toHaveProperty('currentStatus', 'AVAILABLE' as PetStatus);
      expect(result).toHaveProperty('allowedTransitions');
      expect(result).toHaveProperty('description');
    });
  });

  describe('changeStatusInternal', () => {
    it('should change status for internal system calls', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(mockPet);
      mockPrisma.pet.update.mockResolvedValue({
        ...mockPet,
        status: 'PENDING' as PetStatus,
      });

      const result = await service.changeStatusInternal(
        mockPet.id,
        'PENDING' as PetStatus,
        'Adoption request received',
      );

      expect(result.status).toBe('PENDING' as PetStatus);
      expect(mockPrisma.pet.update).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle pet not found during update', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePetStatus(
          'nonexistent-id',
          'PENDING' as PetStatus,
          adminId,
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include descriptive error message for invalid transitions', async () => {
      const adoptedPet = { ...mockPet, status: 'ADOPTED' as PetStatus };
      mockPrisma.pet.findUnique.mockResolvedValue(adoptedPet);

      try {
        await service.updatePetStatus(
          mockPet.id,
          'PENDING' as PetStatus,
          adminId,
          UserRole.ADMIN,
        );
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('ADOPTED');
          expect(error.message).toContain('PENDING');
        } else {
          throw error;
        }
      }
    });
  });
});

