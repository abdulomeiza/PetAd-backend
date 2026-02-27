import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  BadRequestException,
  UploadedFiles,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { AdoptionService } from './adoption.service';
import { CreateAdoptionDto } from './dto/create-adoption.dto';
import { DocumentsService } from '../documents/documents.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { EventsService } from '../events/events.service';
import { EventEntityType, EventType } from '@prisma/client';
import { AdoptionStatus } from './adoption-state-machine.service';

interface AuthRequest extends Request {
  user: { userId: string; email: string; role: string; sub?: string };
}

@Controller('adoption')
@UseGuards(JwtAuthGuard)
export class AdoptionController {
  constructor(
    private readonly adoptionService: AdoptionService,
    private readonly documentsService: DocumentsService,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * POST /adoption/requests
   * Any authenticated user can request to adopt a pet.
   * Fires ADOPTION_REQUESTED event on success.
   */
  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
async requestAdoption(
    @Req() req: AuthRequest,
    @Body() dto: CreateAdoptionDto,
  ) {
    // Create adoption data with current user as adopterId
    const adoptionData = {
      petId: dto.petId,
      adopterId: req.user.userId, // Current user is the adopter
      ownerId: req.user.userId, // For now, assume current user is also owner (this should be validated)
      notes: dto.notes,
    };
    return this.adoptionService.requestAdoption(adoptionData);
  }

  /**
   * PATCH /adoption/:id/approve
   * Admin-only. Approves a pending adoption request.
   * Fires ADOPTION_APPROVED event on success.
   */
  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  approveAdoption(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.adoptionService.updateAdoptionStatus(
      id,
      AdoptionStatus.APPROVED,
      req.user.userId,
      req.user.role as 'USER' | 'ADMIN' | 'SHELTER',
      'Adoption approved by admin'
    );
  }

  /**
   * PATCH /adoption/:id/complete
   * Admin-only. Marks an adoption as completed.
   * Fires ADOPTION_COMPLETED event on success.
   */
  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  completeAdoption(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.adoptionService.updateAdoptionStatus(
      id,
      AdoptionStatus.COMPLETED,
      req.user.userId,
      req.user.role as 'USER' | 'ADMIN' | 'SHELTER',
      'Adoption completed by admin'
    );
  }

  @Post(':id/documents')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE ?? '10485760'),
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          cb(
            new BadRequestException('Only PDF and DOCX files are allowed'),
            false,
          );
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async uploadDocuments(
    @Param('id') adoptionId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthRequest,
  ) {
    return this.documentsService.uploadDocuments(
      adoptionId,
      (req.user.userId || req.user.sub) as string,
      req.user.role as Role,
      files,
    );
  }
}
