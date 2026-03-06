import {
  IsString,
  IsEnum,
  IsArray,
  ArrayMinSize,
  IsOptional,
  MaxLength,
} from "class-validator";
import { ConversationType } from "../schemas/conversation.schema.js";

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type!: ConversationType;

  // The other users to include in the chat (does not need to include the creator's ID)
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  participantIds!: string[];

  // Only required for GROUP chats
  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;
}
