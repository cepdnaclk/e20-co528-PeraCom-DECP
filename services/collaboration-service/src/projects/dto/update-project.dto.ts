import {
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
} from "class-validator";
import { ProjectVisibility } from "../schemas/project.schema.js";

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsEnum(ProjectVisibility)
  @IsOptional()
  visibility?: ProjectVisibility;

  // ✨ The Concurrency Lock
  // The frontend passes the __v they currently see on their screen
  @IsInt()
  @Min(0)
  @IsOptional()
  expectedVersion?: number;
}
