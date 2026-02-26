import {
  Controller,
  Patch,
  Param,
  UseGuards,
  Req,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { EventsService } from '../events/events.service';
import { EventEntityType, EventType } from '@prisma/client';
import { Request } from 'express';

@Controller('adoption')
export class AdoptionController {
  constructor(private readonly eventsService: EventsService) {}

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async approveAdoption(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const actorId =
      (req as Request & { user?: { userId?: string } }).user?.userId;

    try {
      await this.eventsService.logEvent({
        entityType: EventEntityType.ADOPTION,
        entityId: id,
        eventType: EventType.ADOPTION_APPROVED,
        actorId,
        payload: {
          adoptionId: id,
          status: 'APPROVED',
          source: 'AdoptionController',
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to record adoption approval event',
      );
    }

    return { message: `Adoption ${id} approved` };
  }
}
