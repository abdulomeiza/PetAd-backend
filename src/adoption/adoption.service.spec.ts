import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { AdoptionService } from './adoption.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { PetAvailabilityService } from '../pets/pet-availability.service';
import { AdoptionStateMachine } from './adoption-state-machine.service';
import { EventType, EventEntityType, AdoptionStatus } from '@prisma/client';

const ADOPTER_ID = 'adopter-uuid';
const PET_ID = 'pet-uuid';
const OWNER_ID = 'owner-uuid';
const ADOPTION_ID = 'adoption-uuid';
const ACTOR_ID = 'admin-uuid';

const mockAdoption = {
  id: ADOPTION_ID,
  petId: PET_ID,
  ownerId: OWNER_ID,
  adopterId: ADOPTER_ID,
  status: AdoptionStatus.REQUESTED,
  notes: null,
  escrowId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AdoptionService', () => {
  let service: AdoptionService;

  const mockPrisma = {
    pet: { 
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { 
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    adoption: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
  };

  const mockEvents = {
    logEvent: jest.fn(),
  };

  const mockPetAvailability = {
    logAvailabilityChange: jest.fn(),
  };

  const mockStateMachine = {
    canTransition: jest.fn(),
    transition: jest.fn(),
    canAdminOverride: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdoptionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsService, useValue: mockEvents },
        { provide: PetAvailabilityService, useValue: mockPetAvailability },
        { provide: AdoptionStateMachine, useValue: mockStateMachine },
      ],
    }).compile();

    service = module.get<AdoptionService>(AdoptionService);
  });

  describe('requestAdoption', () => {
    const dto = { petId: PET_ID, adopterId: ADOPTER_ID, ownerId: OWNER_ID };

    it('creates the adoption record and fires ADOPTION_REQUESTED', async () => {
      mockPrisma.adoption.create.mockResolvedValue(mockAdoption);
      mockEvents.logEvent.mockResolvedValue({});

      const result = await service.requestAdoption(dto);

      expect(mockPrisma.adoption.create).toHaveBeenCalledWith({
        data: {
          petId: PET_ID,
          adopterId: ADOPTER_ID,
          ownerId: OWNER_ID,
          status: 'REQUESTED',
          notes: undefined,
        },
        include: {
          pet: true,
          adopter: true,
          owner: true,
        },
      });

      expect(result).toEqual(mockAdoption);
    });

    it('propagates logEvent errors (no silent failure)', async () => {
      mockPrisma.adoption.create.mockResolvedValue(mockAdoption);
      mockEvents.logEvent.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.requestAdoption(dto)).rejects.toThrow(
        'DB connection lost',
      );
    });
  });

  describe('updateAdoptionStatus', () => {
    it('updates status to APPROVED and fires ADOPTION_APPROVED', async () => {
      const updated = { ...mockAdoption, status: AdoptionStatus.APPROVED };
      mockPrisma.adoption.findUnique.mockResolvedValue(mockAdoption);
      mockPrisma.adoption.update.mockResolvedValue(updated);
      mockEvents.logEvent.mockResolvedValue({});

      const result = await service.updateAdoptionStatus(ADOPTION_ID, AdoptionStatus.APPROVED, ACTOR_ID, 'ADMIN');

      expect(mockPrisma.adoption.update).toHaveBeenCalledWith({
        where: { id: ADOPTION_ID },
        data: { status: 'APPROVED', notes: null },
        include: {
          adopter: true,
          owner: true,
          pet: true,
        },
      });

      expect(result.status).toBe(AdoptionStatus.APPROVED);
    });

    it('updates status to COMPLETED and fires ADOPTION_COMPLETED', async () => {
      const updated = { ...mockAdoption, status: AdoptionStatus.COMPLETED };
      mockPrisma.adoption.findUnique.mockResolvedValue(mockAdoption);
      mockPrisma.adoption.update.mockResolvedValue(updated);
      mockPrisma.pet.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockEvents.logEvent.mockResolvedValue({});

      await service.updateAdoptionStatus(ADOPTION_ID, AdoptionStatus.COMPLETED, ACTOR_ID, 'ADMIN');

      expect(mockPrisma.pet.update).toHaveBeenCalledWith({
        where: { id: PET_ID },
        data: { currentOwnerId: ADOPTER_ID },
      });
    });

    it('updates status to REJECTED and fires event', async () => {
      const updated = { ...mockAdoption, status: AdoptionStatus.REJECTED };
      mockPrisma.adoption.findUnique.mockResolvedValue(mockAdoption);
      mockPrisma.adoption.update.mockResolvedValue(updated);
      mockEvents.logEvent.mockResolvedValue({});

      await service.updateAdoptionStatus(ADOPTION_ID, AdoptionStatus.REJECTED, ACTOR_ID, 'ADMIN');

      expect(mockEvents.logEvent).toHaveBeenCalled();
    });

    it('throws NotFoundException when adoption does not exist', async () => {
      mockPrisma.adoption.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAdoptionStatus(ADOPTION_ID, AdoptionStatus.APPROVED, ACTOR_ID, 'ADMIN'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.adoption.update).not.toHaveBeenCalled();
      expect(mockEvents.logEvent).not.toHaveBeenCalled();
    });

    it('propagates logEvent errors (no silent failure)', async () => {
      const updated = { ...mockAdoption, status: AdoptionStatus.APPROVED };
      mockPrisma.adoption.findUnique.mockResolvedValue(mockAdoption);
      mockPrisma.adoption.update.mockResolvedValue(updated);
      mockEvents.logEvent.mockRejectedValue(
        new Error('Event store unavailable'),
      );

      await expect(
        service.updateAdoptionStatus(ADOPTION_ID, AdoptionStatus.APPROVED, ACTOR_ID, 'ADMIN'),
      ).rejects.toThrow('Event store unavailable');
    });
  });
});
