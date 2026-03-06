import { IsNotEmpty, IsEnum, IsEmail, IsMongoId } from "class-validator";
import { MemberRole } from "../../members/schemas/project-member.schema.js";

export class CreateInvitationDto {
  @IsNotEmpty()
  @IsMongoId()
  inviteeId!: string;

  @IsEmail()
  @IsNotEmpty()
  inviteeEmail!: string;

  @IsEnum(MemberRole)
  role!: MemberRole;
}

export class RespondInvitationDto {
  @IsNotEmpty()
  @IsMongoId()
  invitationId!: string;

  @IsNotEmpty()
  @IsEnum(["ACCEPTED", "DECLINED"])
  action!: "ACCEPTED" | "DECLINED";
}
