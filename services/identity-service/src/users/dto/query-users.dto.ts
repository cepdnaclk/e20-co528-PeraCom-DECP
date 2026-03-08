import { Type } from "class-transformer";
import { IsOptional, IsString, IsEnum, IsNumber } from "class-validator";

export enum UserRole {
  ADMIN = "ADMIN",
  STUDENT = "STUDENT",
  ALUMNI = "ALUMNI",
}

export class QueryUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
