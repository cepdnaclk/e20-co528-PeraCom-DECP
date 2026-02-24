import { Type } from "class-transformer";
import {
  IsOptional,
  IsString,
  IsEmail,
  IsNotEmpty,
  IsUUID,
  Matches,
  IsEnum,
  IsArray,
  ValidateNested,
} from "class-validator";

export enum UserRole {
  ADMIN = "ADMIN",
  STUDENT = "STUDENT",
  ALUMNI = "ALUMNI",
}

class RoleChangeItem {
  @IsNotEmpty()
  @IsUUID()
  id!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateRolesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleChangeItem)
  users!: RoleChangeItem[];
}

export class UpdateUserAdminDto {
  @IsNotEmpty()
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsEmail()
  @Matches(/^[^\s@]+@eng\.pdn\.ac\.lk$/, {
    message: "Use the university email address",
  })
  email?: string;
}
