import { IsEnum, IsMongoId, IsNotEmpty } from "class-validator";
import { ReactionType } from "../../posts/schemas/post.schema.js";

export class CreateReactionDto {
  @IsNotEmpty()
  @IsMongoId()
  postId!: string;

  @IsNotEmpty()
  @IsEnum(ReactionType)
  reactionType!: ReactionType;
}
