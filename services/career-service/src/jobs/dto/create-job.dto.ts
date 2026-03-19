import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  ArrayMaxSize,
  MaxLength,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationArguments,
  Validate,
} from "class-validator";
import { EmploymentType, WorkMode } from "../schemas/job.schema.js";

@ValidatorConstraint({ name: "isFutureDate", async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(dateString: string, args: ValidationArguments) {
    return new Date(dateString) > new Date();
  }
  defaultMessage(args: ValidationArguments) {
    return "Deadline must be in the future";
  }
}

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  location!: string;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsEnum(WorkMode)
  workMode!: WorkMode;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  department!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10) // Prevent abusive payloads
  @IsNotEmpty()
  tags!: string[];

  @IsString()
  @IsOptional()
  salaryRange?: string;

  @IsDateString()
  @IsNotEmpty()
  @Validate(IsFutureDateConstraint)
  deadline!: string; // ISO 8601 format
}
