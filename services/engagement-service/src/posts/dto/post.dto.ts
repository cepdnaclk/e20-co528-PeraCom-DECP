import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export class UpdatePostDto {
  @IsNotEmpty()
  @IsMongoId()
  postId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;
}

export class RepostDto {
  @IsNotEmpty()
  @IsMongoId()
  originalPostId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;
}
