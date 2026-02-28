import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePostDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(1500)
  postId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  content?: string;
}
