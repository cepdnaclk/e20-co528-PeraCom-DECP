import { IsString, IsNotEmpty, IsEnum, MaxLength } from "class-validator";
import { ProjectVisibility } from "../schemas/project.schema.js";

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsEnum(ProjectVisibility)
  @IsNotEmpty()
  visibility!: ProjectVisibility;
}
