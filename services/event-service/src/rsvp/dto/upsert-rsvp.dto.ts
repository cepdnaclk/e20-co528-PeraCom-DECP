import { IsEnum, IsMongoId, IsNotEmpty } from "class-validator";
import { RsvpStatus } from "../schemas/rsvp.schema.js";

export class UpsertRsvpDto {
  @IsNotEmpty()
  @IsMongoId({ message: "Invalid event ID format" })
  eventId!: string;

  @IsNotEmpty()
  @IsEnum(RsvpStatus, {
    message: `Status must be one of: ${Object.values(RsvpStatus).join(", ")}`,
  })
  newStatus!: RsvpStatus;
}
