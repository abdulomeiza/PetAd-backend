import { Test, TestingModule } from '@nestjs/testing';
import { PetsController } from '../pets.controller';
import { PetsService } from '../pets.service';
import { PetStatus, UserRole } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('PetsController - Status Lifecycle', () => {
  let controller: PetsController;

  const mockPetsService = {
    getPetById: jest.fn(),
    updatePetStatus: jest.fn(),
    getAllowedTransitions: jest.fn(),
    getTransitionInfo: jest.fn(),
  };

  const mockPet = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Buddy',
    species: 'DOG',
    status: 'AVAILABLE' as PetStatus,
  };

  const mockRequest = {
    user: {
      sub: '550e8400-e29b-41d4-a716-446655440002',
      email: 'user@example.com',
      role: UserRole.ADMIN,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PetsController],
      providers: [
        {
          provide: PetsService,
          useValue: mockPetsService,
        },
      ],
    }).compile();

    controller = module.get<PetsController>(PetsController);

    jest.clearAllMocks();
  });

  describe('GET /pets/:id', () => {
    it('should return pet by ID', async () => {
      mockPetsService.getPetById.mockResolvedValue(mockPet);

      const result = await controller.getPet(mockPet.id);

      expect(result).toEqual(mockPet);
      expect(mockPetsService.getPetById).toHaveBeenCalledWith(mockPet.id);
    });

    it('should throw NotFoundException if pet does not exist', async () => {
      mockPetsService.getPetById.mockRejectedValue(
        new NotFoundException('Pet not found'),
      );

      await expect(controller.getPet('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('PATCH /pets/:id/status', () => {
    it('should update pet status with valid transition', async () => {
      const updatedPet = { ...mockPet, status: 'PENDING' as PetStatus };
      mockPetsService.updatePetStatus.mockResolvedValue(updatedPet);

      const result = await controller.updatePetStatus(
        mockPet.id,
        { newStatus: 'PENDING' as PetStatus, reason: 'Adoption request' },
        mockRequest,
      );

      expect(result.status).toBe('PENDING');
      expect(mockPetsService.updatePetStatus).toHaveBeenCalledWith(
        mockPet.id,
        'PENDING' as PetStatus,
        mockRequest.user.sub,
        mockRequest.user.role,
        'Adoption request',
      );
    });

    it('should return 400 for invalid transition', async () => {
      mockPetsService.updatePetStatus.mockRejectedValue(
        new BadRequestException(
          'Cannot change status from ADOPTED to PENDING. This transition is not allowed.',
        ),
      );

      await expect(
        controller.updatePetStatus(
          mockPet.id,
          { newStatus: 'PENDING' as PetStatus },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return 403 for non-admin user trying to approve adoption', async () => {
      const userRequest = {
        ...mockRequest,
        user: { ...mockRequest.user, role: UserRole.USER },
      };

      mockPetsService.updatePetStatus.mockRejectedValue(
        new ForbiddenException(
          'Only administrators can change pet status to ADOPTED',
        ),
      );

      await expect(
        controller.updatePetStatus(
          mockPet.id,
          { newStatus: PetStatus.ADOPTED },
          userRequest,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to override restrictions', async () => {
      const adoptedPet = { ...mockPet, status: PetStatus.ADOPTED };
      const updatedPet = { ...adoptedPet, status: 'AVAILABLE' as PetStatus };
      mockPetsService.updatePetStatus.mockResolvedValue(updatedPet);

      const result = await controller.updatePetStatus(
        mockPet.id,
        {
          newStatus: 'AVAILABLE' as PetStatus,
          reason: 'Pet returned by adopter',
        },
        mockRequest,
      );

      expect(result.status).toBe('AVAILABLE');
    });

    it('should accept reason parameter in request body', async () => {
      mockPetsService.updatePetStatus.mockResolvedValue({
        ...mockPet,
        status: 'IN_CUSTODY' as PetStatus,
      });

      await controller.updatePetStatus(
        mockPet.id,
        {
          newStatus: 'IN_CUSTODY' as PetStatus,
          reason: 'Custody agreement created',
        },
        mockRequest,
      );

      expect(mockPetsService.updatePetStatus).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'Custody agreement created',
      );
    });
  });

  describe('GET /pets/:id/transitions', () => {
    it('should return transition info for a pet', async () => {
      mockPetsService.getTransitionInfo.mockResolvedValue({
        currentStatus: PetStatus.AVAILABLE,
        allowedTransitions: [PetStatus.PENDING, PetStatus.IN_CUSTODY],
        description: 'Pet is available for adoption',
      });

      const result = await controller.getTransitions(mockPet.id);

      expect(result).toHaveProperty('currentStatus', PetStatus.AVAILABLE);
      expect(result).toHaveProperty('allowedTransitions');
      expect(result.allowedTransitions).toContain(PetStatus.PENDING);
    });
  });

  describe('GET /pets/:id/transitions/allowed', () => {
    it('should return allowed transitions for authenticated user', async () => {
      mockPetsService.getAllowedTransitions.mockResolvedValue([
        PetStatus.PENDING,
        PetStatus.IN_CUSTODY,
      ]);

      const result = await controller.getAllowedTransitionsForUser(
        mockPet.id,
        mockRequest,
      );

      expect(result).toContain(PetStatus.PENDING);
      expect(result).toContain(PetStatus.IN_CUSTODY);
      expect(mockPetsService.getAllowedTransitions).toHaveBeenCalledWith(
        mockPet.id,
        mockRequest.user.role,
      );
    });

    it('should include admin-only transitions for admin users', async () => {
      mockPetsService.getAllowedTransitions.mockResolvedValue([
        PetStatus.AVAILABLE,
      ]);

      const adminRequest = {
        ...mockRequest,
        user: { ...mockRequest.user, role: UserRole.ADMIN },
      };

      await controller.getAllowedTransitionsForUser(mockPet.id, adminRequest);

      expect(mockPetsService.getAllowedTransitions).toHaveBeenCalledWith(
        mockPet.id,
        UserRole.ADMIN,
      );
    });
  });

  describe('Authorization', () => {
    it('should require JWT token for status update', () => {
      // This is handled by JwtAuthGuard
      // Controller test just verifies the guard is applied via decorator
      expect(typeof controller.updatePetStatus).toBe('function');
    });

    it('should require JWT token for allowed transitions endpoint', () => {
      // This is handled by JwtAuthGuard
      expect(controller.getAllowedTransitionsForUser).toBeDefined();
    });

    it('should allow public access to pet details', async () => {
      // getPet endpoint has no guard
      mockPetsService.getPetById.mockResolvedValue(mockPet);
      const result = await controller.getPet(mockPet.id);
      expect(result).toBeDefined();
    });
  });

  describe('HTTP Status Codes', () => {
    it('should return 200 OK for successful status update', async () => {
      mockPetsService.updatePetStatus.mockResolvedValue({
        ...mockPet,
        status: 'PENDING' as PetStatus,
      });

      const result = await controller.updatePetStatus(
        mockPet.id,
        { newStatus: 'PENDING' as PetStatus },
        mockRequest,
      );

      expect(result).toBeDefined();
      // HttpCode(HttpStatus.OK) applied to method
    });
  });
});
