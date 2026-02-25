import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { UpdatePetStatusDto } from './dto/update-pet-status.dto';
import { UserRole } from '../common/enums';

/**
 * Pets Controller
 * Handles all pet-related HTTP requests including status lifecycle
 */
@ApiTags('Pets')
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  /**
   * Create new pet listing
   * Requires JWT authentication
   * Shelter or Admin role required
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHELTER', 'ADMIN')
  @ApiOperation({ summary: 'Create new pet listing' })
  @ApiBody({ type: CreatePetDto })
  @ApiResponse({ status: 201, description: 'Pet created' })
  @ApiBearerAuth('JWT-auth')
  async create(
    @Body() createPetDto: CreatePetDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.petsService.create(createPetDto, req.user.sub);
  }

  /**
   * List all available pets
   * Public endpoint - no authentication required
   */
  @Get()
  @ApiOperation({ summary: 'List all available pets' })
  @ApiResponse({ status: 200, description: 'Array of available pets' })
  async findAll() {
    return this.petsService.findAll();
  }

  /**
   * Get pet details by ID
   * Public endpoint - no authentication required
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get pet details',
    description: 'Retrieve detailed information about a specific pet',
  })
  @ApiParam({
    name: 'id',
    description: 'Pet ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Pet found',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Buddy',
        species: 'DOG',
        breed: 'Golden Retriever',
        age: 3,
        description: 'Friendly and energetic dog',
        imageUrl: 'https://example.com/buddy.jpg',
        status: 'AVAILABLE',
        currentOwnerId: '550e8400-e29b-41d4-a716-446655440001',
        createdAt: '2026-02-25T10:00:00Z',
        updatedAt: '2026-02-25T10:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  async getPet(@Param('id') petId: string) {
    return this.petsService.getPetById(petId);
  }

  /**
   * Update pet information
   * Requires JWT authentication
   * Shelter or Admin role required
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHELTER', 'ADMIN')
  @ApiOperation({ summary: 'Update pet information' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiBody({ type: UpdatePetDto })
  @ApiResponse({ status: 200, description: 'Pet updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  @ApiBearerAuth('JWT-auth')
  async update(
    @Param('id') id: string,
    @Body() updatePetDto: UpdatePetDto,
    @Request() req: { user: { sub: string; role: string } },
  ) {
    return this.petsService.update(
      id,
      updatePetDto,
      req.user.sub,
      req.user.role,
    );
  }

  /**
   * Update pet status with state machine validation
   * Requires JWT authentication
   * Admin role required for some transitions
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update pet status',
    description:
      'Change pet status with automatic validation of valid state transitions',
  })
  @ApiParam({
    name: 'id',
    description: 'Pet ID',
  })
  @ApiBody({
    type: UpdatePetStatusDto,
    examples: {
      approve_adoption: {
        summary: 'Approve adoption request',
        value: {
          newStatus: 'ADOPTED',
          reason: 'Adoption approved by admin',
        },
      },
      reject_adoption: {
        summary: 'Reject adoption request',
        value: {
          newStatus: 'AVAILABLE',
          reason: 'Adoption request rejected',
        },
      },
      return_adopted_pet: {
        summary: 'Return an adopted pet (admin only)',
        value: {
          newStatus: 'AVAILABLE',
          reason: 'Pet returned by adopter - refund processed',
        },
      },
      complete_custody: {
        summary: 'Complete temporary custody',
        value: {
          newStatus: 'AVAILABLE',
          reason: 'Custody period completed',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Status updated successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Buddy',
        status: 'ADOPTED',
        updatedAt: '2026-02-25T11:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
    schema: {
      example: {
        message:
          'Cannot change status from ADOPTED to PENDING. This transition is not allowed.',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (admin required)',
    schema: {
      example: {
        message: 'Only administrators can change pet status to ADOPTED',
        error: 'Forbidden',
        statusCode: 403,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async updatePetStatus(
    @Param('id') petId: string,
    @Body() updatePetStatusDto: UpdatePetStatusDto,
    @Request()
    req: { user: { sub: string; role: UserRole } },
  ) {
    return this.petsService.updatePetStatus(
      petId,
      updatePetStatusDto.newStatus as any,
      req.user.sub, // User ID from JWT
      req.user.role, // User role from JWT
      updatePetStatusDto.reason,
    );
  }

  /**
   * Remove pet listing
   * Requires JWT authentication
   * Admin role required
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove pet listing' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiResponse({ status: 200, description: 'Pet deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  @ApiBearerAuth('JWT-auth')
  async remove(
    @Param('id') id: string,
    @Request() req: { user: { role: UserRole } },
  ) {
    return this.petsService.remove(id, req.user.role);
  }

  /**
   * Get allowed status transitions for a pet
   * Useful for UI to display available actions
   */
  @Get(':id/transitions')
  @ApiOperation({
    summary: 'Get allowed status transitions',
    description: 'Retrieve list of valid status transitions for a pet',
  })
  @ApiParam({
    name: 'id',
    description: 'Pet ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Allowed transitions retrieved',
    schema: {
      example: {
        currentStatus: 'AVAILABLE',
        allowedTransitions: ['PENDING', 'IN_CUSTODY'],
        description: 'Pet is available for adoption',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  async getTransitions(@Param('id') petId: string) {
    return this.petsService.getTransitionInfo(petId);
  }

  /**
   * Get allowed transitions for a specific user role
   * Requires JWT authentication
   */
  @Get(':id/transitions/allowed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get allowed transitions for current user',
    description:
      'Get status transitions available for the authenticated user based on their role',
  })
  @ApiResponse({
    status: 200,
    description: 'Allowed transitions for user role',
    schema: {
      example: ['PENDING', 'IN_CUSTODY'],
    },
  })
  async getAllowedTransitionsForUser(
    @Param('id') petId: string,
    @Request() req: { user: { role: UserRole } },
  ) {
    return this.petsService.getAllowedTransitions(petId, req.user.role);
  }
}
