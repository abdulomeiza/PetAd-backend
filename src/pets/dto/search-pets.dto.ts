import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PetSpecies, PetGender, PetSize } from '../../common/enums';
import { ComputedPetStatus } from '../pet-availability.service';

export class SearchPetsDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: PetSpecies })
  @IsOptional()
  @IsEnum(PetSpecies)
  species?: PetSpecies;

  @ApiPropertyOptional({ enum: PetGender })
  @IsOptional()
  @IsEnum(PetGender)
  gender?: PetGender;

  @ApiPropertyOptional({ enum: PetSize })
  @IsOptional()
  @IsEnum(PetSize)
  size?: PetSize;

  @ApiPropertyOptional({
    enum: ComputedPetStatus,
    description: 'Filter by status (defaults to AVAILABLE for public)',
    example: ComputedPetStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(ComputedPetStatus, { message: 'Invalid status value' })
  status?: ComputedPetStatus;

  @ApiPropertyOptional({
    description: 'Filter by breed (case-insensitive, partial match)',
    example: 'Golden Retriever',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  breed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minAge?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxAge?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}
