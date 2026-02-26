import { Test, TestingModule } from '@nestjs/testing';
import { AdoptionController } from './adoption.controller';
import { EventsService } from '../events/events.service';
import { EventEntityType, EventType } from '@prisma/client';
import { Request } from 'express';

describe('AdoptionController', () => {
  let controller: AdoptionController;

  const mockEventsService = {
    logEvent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdoptionController],
      providers: [
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    controller = module.get<AdoptionController>(AdoptionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should log an ADOPTION_APPROVED event when approving an adoption', async () => {
    const req = { user: { userId: 'admin-123' } } as unknown as Request;
    mockEventsService.logEvent.mockResolvedValue({});

    const result = await controller.approveAdoption('adoption-1', req);

    expect(result).toEqual({ message: 'Adoption adoption-1 approved' });
    expect(mockEventsService.logEvent).toHaveBeenCalledWith({
      entityType: EventEntityType.ADOPTION,
      entityId: 'adoption-1',
      eventType: EventType.ADOPTION_APPROVED,
      actorId: 'admin-123',
      payload: expect.objectContaining({
        adoptionId: 'adoption-1',
        status: 'APPROVED',
        source: 'AdoptionController',
      }),
    });
  });

  it('should throw a descriptive error when event logging fails', async () => {
    const req = { user: { userId: 'admin-123' } } as unknown as Request;
    mockEventsService.logEvent.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(
      controller.approveAdoption('adoption-2', req),
    ).rejects.toThrow('Failed to record adoption approval event');
  });
});

