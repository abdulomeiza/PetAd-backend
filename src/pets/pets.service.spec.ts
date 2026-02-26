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
  });

  it('should throw NotFoundException if pet not found', async () => {
    mockPrisma.pet.findUnique.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('should update pet if owner or admin', async () => {
    mockPrisma.pet.findUnique.mockResolvedValue({
      id: 'pet-1',
      currentOwnerId: 'owner-1',
    });
    mockPrisma.pet.update.mockResolvedValue({ id: 'pet-1', name: 'Buddy' });
    const dto: UpdatePetDto = { name: 'Buddy' } as UpdatePetDto;
    const result = await service.update('pet-1', dto, 'owner-1', 'SHELTER');
    expect(result.name).toBe('Buddy');
  });

  it('should throw ForbiddenException if not owner or admin', async () => {
    mockPrisma.pet.findUnique.mockResolvedValue({
      id: 'pet-1',
      currentOwnerId: 'owner-1',
    });
    await expect(
      service.update('pet-1', {} as UpdatePetDto, 'other-user', 'USER'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should delete pet if admin', async () => {
    mockPrisma.pet.findUnique.mockResolvedValue({ id: 'pet-1' });
    mockPrisma.pet.delete.mockResolvedValue({});
    const result = await service.remove('pet-1', 'ADMIN');
    expect(result.message).toBe('Pet deleted successfully');
  });

  it('should throw ForbiddenException if not admin on delete', async () => {
    mockPrisma.pet.findUnique.mockResolvedValue({ id: 'pet-1' });
    await expect(service.remove('pet-1', 'SHELTER')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
