import { Test, TestingModule } from '@nestjs/testing';
import { PetsService } from './pets.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { PetSpecies, PetStatus } from '../common/enums';

// Mock PrismaService
const mockPrisma = {
  pet: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

describe('PetsService', () => {
  let service: PetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<PetsService>(PetsService);
    jest.clearAllMocks();
  });

  it('should create a pet', async () => {
    const dto: CreatePetDto = { name: 'Buddy', species: 'DOG' } as CreatePetDto;
    const ownerId = 'owner-1';
    mockPrisma.pet.create.mockResolvedValue({
      ...dto,
      currentOwnerId: ownerId,
    });
    const result = await service.create(dto, ownerId);
    expect(result).toMatchObject({
      name: 'Buddy',
      species: 'DOG',
      currentOwnerId: ownerId,
    });
  });

  it('should find all available pets', async () => {
    const mockPets = [
      { name: 'Buddy', status: 'AVAILABLE' },
      { name: 'Max', status: 'AVAILABLE' },
    ];
    mockPrisma.pet.findMany.mockResolvedValue(mockPets);
    mockPrisma.pet.count.mockResolvedValue(2);

    const result = await service.findAll({});

    expect(result.data).toHaveLength(2);
    expect(result.data[0].status).toBe('AVAILABLE');
    expect(result.meta.total).toBe(2);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(20);
  });

  describe('findAll - Pagination', () => {
    it('should return paginated results with default values', async () => {
      const mockPets = Array.from({ length: 20 }, (_, i) => ({
        id: `pet-${i}`,
        name: `Pet ${i}`,
        status: 'AVAILABLE',
      }));
      mockPrisma.pet.findMany.mockResolvedValue(mockPets);
      mockPrisma.pet.count.mockResolvedValue(45);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(20);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.total).toBe(45);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(false);
    });

    it('should calculate skip correctly for page 2', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(50);

      await service.findAll({ page: 2, limit: 10 });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should handle last page correctly', async () => {
      const mockPets = Array.from({ length: 5 }, (_, i) => ({
        id: `pet-${i}`,
        name: `Pet ${i}`,
      }));
      mockPrisma.pet.findMany.mockResolvedValue(mockPets);
      mockPrisma.pet.count.mockResolvedValue(45);

      const result = await service.findAll({ page: 5, limit: 10 });

      expect(result.data).toHaveLength(5);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it('should filter by species', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(10);

      await service.findAll({ species: PetSpecies.DOG });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ species: PetSpecies.DOG }),
        }),
      );
    });

    it('should handle search query', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(5);

      await service.findAll({ search: 'Buddy' });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'Buddy', mode: 'insensitive' } },
              { breed: { contains: 'Buddy', mode: 'insensitive' } },
              { description: { contains: 'Buddy', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should return empty array for page beyond total', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(10);

      const result = await service.findAll({ page: 999, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should handle empty results with zero total', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(0);

      const result = await service.findAll({ species: PetSpecies.DOG });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
      expect(result.meta.hasNextPage).toBe(false);
    });

    it('should filter by status', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(5);

      await service.findAll({ status: PetStatus.ADOPTED });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: PetStatus.ADOPTED }),
        }),
      );
    });

    it('should combine multiple filters', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(3);

      await service.findAll({
        species: PetSpecies.DOG,
        status: PetStatus.AVAILABLE,
        search: 'Golden',
      });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            species: PetSpecies.DOG,
            status: PetStatus.AVAILABLE,
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('should filter by breed (case-insensitive)', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(5);

      await service.findAll({ breed: 'Golden Retriever' });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            breed: { contains: 'Golden Retriever', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by location (searches description)', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(3);

      await service.findAll({ location: 'Lagos' });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            description: { contains: 'Lagos', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by age range (minAge only)', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(10);

      await service.findAll({ minAge: 2 });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            age: { gte: 2 },
          }),
        }),
      );
    });

    it('should filter by age range (maxAge only)', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(8);

      await service.findAll({ maxAge: 5 });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            age: { lte: 5 },
          }),
        }),
      );
    });

    it('should filter by age range (both minAge and maxAge)', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(15);

      await service.findAll({ minAge: 2, maxAge: 5 });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            age: { gte: 2, lte: 5 },
          }),
        }),
      );
    });

    it('should search in name, breed, and description', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(7);

      await service.findAll({ search: 'friendly golden' });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'friendly golden', mode: 'insensitive' } },
              { breed: { contains: 'friendly golden', mode: 'insensitive' } },
              {
                description: {
                  contains: 'friendly golden',
                  mode: 'insensitive',
                },
              },
            ],
          }),
        }),
      );
    });

    it('should combine all filters together', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(2);

      await service.findAll({
        species: PetSpecies.DOG,
        breed: 'Retriever',
        location: 'Lagos',
        minAge: 2,
        maxAge: 5,
        status: PetStatus.AVAILABLE,
        page: 2,
        limit: 10,
      });

      expect(mockPrisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            species: PetSpecies.DOG,
            breed: { contains: 'Retriever', mode: 'insensitive' },
            description: { contains: 'Lagos', mode: 'insensitive' },
            age: { gte: 2, lte: 5 },
            status: PetStatus.AVAILABLE,
          }),
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  describe('Ownership Validation', () => {
    it('should allow owner to update their pet', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue({
        id: 'pet-1',
        currentOwnerId: 'owner-1',
      });
      mockPrisma.pet.update.mockResolvedValue({
        id: 'pet-1',
        name: 'Updated Buddy',
      });

      const result = await service.update(
        'pet-1',
        { name: 'Updated Buddy' },
        'owner-1',
        'SHELTER',
      );

      expect(result.name).toBe('Updated Buddy');
      expect(mockPrisma.pet.update).toHaveBeenCalledWith({
        where: { id: 'pet-1' },
        data: { name: 'Updated Buddy' },
        include: { currentOwner: true },
      });
    });

    it('should throw ForbiddenException when non-owner tries to update', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue({
        id: 'pet-1',
        currentOwnerId: 'owner-1',
      });

      await expect(
        service.update('pet-1', { name: 'Hacked' }, 'owner-2', 'SHELTER'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.update('pet-1', { name: 'Hacked' }, 'owner-2', 'SHELTER'),
      ).rejects.toThrow('You can only update your own pets');
    });

    it('should allow ADMIN to update any pet', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue({
        id: 'pet-1',
        currentOwnerId: 'owner-1',
      });
      mockPrisma.pet.update.mockResolvedValue({
        id: 'pet-1',
        name: 'Admin Updated',
      });

      const result = await service.update(
        'pet-1',
        { name: 'Admin Updated' },
        'admin-1',
        'ADMIN',
      );

      expect(result.name).toBe('Admin Updated');
    });

    it('should throw NotFoundException before checking ownership', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', {}, 'owner-1', 'SHELTER'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.update('non-existent', {}, 'owner-1', 'SHELTER'),
      ).rejects.toThrow('Pet not found');
    });

    it('should log unauthorized update attempts', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockPrisma.pet.findUnique.mockResolvedValue({
        id: 'pet-1',
        currentOwnerId: 'owner-1',
      });

      await expect(
        service.update('pet-1', {}, 'owner-2', 'SHELTER'),
      ).rejects.toThrow(ForbiddenException);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OWNERSHIP VALIDATION FAILED]'),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Delete Operations', () => {
    it('should allow ADMIN to delete pet', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue({ id: 'pet-1' });
      mockPrisma.pet.delete.mockResolvedValue({});

      const result = await service.remove('pet-1', 'ADMIN');

      expect(result.message).toBe('Pet deleted successfully');
      expect(mockPrisma.pet.delete).toHaveBeenCalledWith({
        where: { id: 'pet-1' },
      });
    });

    it('should throw ForbiddenException when non-admin tries to delete', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue({ id: 'pet-1' });

      await expect(service.remove('pet-1', 'SHELTER')).rejects.toThrow(
        ForbiddenException,
      );

      await expect(service.remove('pet-1', 'SHELTER')).rejects.toThrow(
        'Only administrators can delete pets',
      );
    });

    it('should throw NotFoundException when deleting non-existent pet', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent', 'ADMIN')).rejects.toThrow(
        NotFoundException,
      );

      await expect(service.remove('non-existent', 'ADMIN')).rejects.toThrow(
        'Pet not found',
      );
    });

    it('should check pet existence before checking admin role', async () => {
      mockPrisma.pet.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent', 'SHELTER')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.pet.delete).not.toHaveBeenCalled();
    });
  });

  it('should throw NotFoundException if pet not found', async () => {
    mockPrisma.pet.findUnique.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });
});
