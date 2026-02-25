import { Test, TestingModule } from '@nestjs/testing';
import { PetsService } from './pets.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

// Mock PrismaService
const mockPrisma = {
  pet: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
    mockPrisma.pet.findMany.mockResolvedValue([
      { name: 'Buddy', status: 'AVAILABLE' },
    ]);
    const result = await service.findAll();
    expect(result[0].status).toBe('AVAILABLE');
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
