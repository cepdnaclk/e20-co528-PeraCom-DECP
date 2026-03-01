import { Transform } from "class-transformer";
import { IsMongoId, IsNotEmpty, IsString, Length } from "class-validator";

export class CreateCommentDto {
  @IsNotEmpty()
  @IsMongoId()
  postId!: string;

  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Length(1, 2000, {
    message: "Comment must be between 1 and 2000 characters",
  })
  content!: string;
}

export class UpdateCommentDto {
  @IsNotEmpty()
  @IsMongoId()
  commentId!: string;

  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Length(1, 2000, {
    message: "Comment must be between 1 and 2000 characters",
  })
  content!: string;
}
