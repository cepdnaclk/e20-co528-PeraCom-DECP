import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Max,
  IsMimeType,
  IsMongoId,
} from "class-validator";
import { env } from "../../config/validateEnv.config.js";

export class RequestUploadUrlDto {
  @IsNotEmpty()
  @IsMongoId()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @IsMimeType()
  mimeType!: string; // So we can restrict executables early

  @IsNumber()
  @Max(env.MAX_FILE_SIZE_MB * 1024 * 1024) // Hard limit: MAX_FILE_SIZE_MB max per file
  sizeBytes!: number;
}

export class ConfirmUploadDto {
  @IsNotEmpty()
  @IsMongoId()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  fileKey!: string; // The key we gave them in step 1

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @IsMimeType()
  mimeType!: string;

  @IsNumber()
  sizeBytes!: number;
}

export class GetDownloadUrlDto {
  @IsNotEmpty()
  @IsMongoId()
  projectId!: string;

  @IsNotEmpty()
  @IsMongoId()
  documentId!: string;
}

export class DeleteDocumentDto {
  @IsNotEmpty()
  @IsMongoId()
  projectId!: string;

  @IsNotEmpty()
  @IsMongoId()
  documentId!: string;
}
