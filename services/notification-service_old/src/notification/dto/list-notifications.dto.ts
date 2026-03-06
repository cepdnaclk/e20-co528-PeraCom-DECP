import { IsOptional, IsBooleanString, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class ListNotificationsDto {
  @IsOptional()
  @IsBooleanString()
  read?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
