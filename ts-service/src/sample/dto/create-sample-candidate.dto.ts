import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSampleCandidateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;
}
