import { Injectable } from "@nestjs/common";
import { Client } from "minio";
import { env } from "../config/validateEnv.config.js";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Injectable()
export class MinioService {
  private minioClient: Client;

  constructor(
    @InjectPinoLogger(MinioService.name)
    private readonly logger: PinoLogger,
  ) {
    this.logger.info("Initializing Minio client");
    this.minioClient = new Client({
      endPoint: env.MINIO_ENDPOINT!,
      port: Number(env.MINIO_PORT),
      useSSL: false,
      accessKey: env.MINIO_ACCESS_KEY!,
      secretKey: env.MINIO_SECRET_KEY!,
    });
  }

  async uploadFile(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    mimeType: string,
  ) {
    await this.minioClient.putObject(
      bucket,
      objectName,
      buffer,
      buffer.length,
      {
        "Content-Type": mimeType,
      },
    );

    return `${env.MINIO_PUBLIC_URL}/${bucket}/${objectName}`;
  }

  async deleteFile(bucketName: string, objectName: string): Promise<void> {
    try {
      // The official Minio SDK method for deleting files
      await this.minioClient.removeObject(bucketName, objectName);
    } catch (error) {
      // We log the error but don't crash the app,
      // as file deletion failures shouldn't stop the user experience.
      this.logger.error(
        { error, objectName },
        "Failed to delete object from Minio",
      );
      throw error;
    }
  }
}
