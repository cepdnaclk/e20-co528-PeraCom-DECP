import { IsArray, ArrayNotEmpty, IsUUID } from "class-validator";

export class BulkSuspendDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("all", { each: true })
  userIds!: string[];
}
