import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

export class CreatePostDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  content?: string;
}

export class UpdatePostDto {
  @IsNotEmpty()
  @IsMongoId()
  postId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsUrl({}, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsUrl()
  videoUrl?: string;
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
