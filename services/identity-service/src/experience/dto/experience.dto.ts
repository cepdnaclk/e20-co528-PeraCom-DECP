import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsDate,
  IsUUID,
  IsEnum,
} from "class-validator";

export enum EmploymentType {
  Full_time = "Full_time",
  Part_time = "Part_time",
  Internship = "Internship",
  Freelance = "Freelance",
  Contract = "Contract",
  Other = "Other",
}

export class NewExperienceDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsNotEmpty()
  @IsEnum(EmploymentType)
  emp_type!: EmploymentType;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  company!: string;

  @IsNotEmpty()
  @IsDate()
  start_date!: Date;

  @IsOptional()
  @IsDate()
  end_date?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateExperienceDto {
  @IsNotEmpty()
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  emp_type?: EmploymentType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @IsOptional()
  @IsDate()
  start_date?: Date;

  @IsOptional()
  @IsDate()
  end_date?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
