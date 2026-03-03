import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  IsUrl,
  IsNotEmpty,
  ValidateIf,
} from "class-validator";
import { EventType } from "../schemas/event.schema.js";

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(EventType)
  eventType!: EventType;

  // Enforce URL if ONLINE or HYBRID
  @ValidateIf(
    (o) => o.eventType === EventType.ONLINE || o.eventType === EventType.HYBRID,
  )
  @IsUrl(
    {},
    { message: "A valid meeting link is required for online/hybrid events" },
  )
  @IsNotEmpty()
  meetingLink?: string;

  // Enforce Address if PHYSICAL or HYBRID
  @ValidateIf(
    (o) =>
      o.eventType === EventType.PHYSICAL || o.eventType === EventType.HYBRID,
  )
  @IsString()
  @IsNotEmpty({
    message: "A physical address is required for physical/hybrid events",
  })
  address?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  timezone!: string; // E.g., 'UTC', 'Asia/Colombo'

  @IsInt()
  @Min(1)
  capacity!: number;
}
