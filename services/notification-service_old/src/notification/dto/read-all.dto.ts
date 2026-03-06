import { IsNotEmpty, IsString } from "class-validator";

export class ReadAllDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;
}
