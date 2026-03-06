import {
  IsString,
  IsNotEmpty,
  IsEnum,
  MaxLength,
  IsMongoId,
} from "class-validator";
import { MemberRole } from "../schemas/project-member.schema.js";

export class UpdateMemberDto {
  @IsNotEmpty()
  @IsMongoId()
  targetUserId!: string;

  @IsNotEmpty()
  @IsEnum(MemberRole)
  newRole!: MemberRole;
}
