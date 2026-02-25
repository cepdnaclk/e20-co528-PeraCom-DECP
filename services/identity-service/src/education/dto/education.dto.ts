import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsDate,
  IsUUID,
} from "class-validator";

export class NewEducationDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  institution!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  degree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  field_of_study?: string;

  @IsOptional()
  @IsDate()
  start_date?: Date;

  @IsOptional()
  @IsDate()
  end_date?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  grade?: string;
}

export class UpdateEducationDto {
  @IsNotEmpty()
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  institution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  degree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  field_of_study?: string;

  @IsOptional()
  @IsDate()
  start_date?: Date;

  @IsOptional()
  @IsDate()
  end_date?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  grade?: string;
}
