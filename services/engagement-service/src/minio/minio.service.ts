import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Client } from "minio";
import { env } from "../config/validateEnv.config.js";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Injectable()
export class MinioService implements OnModuleInit {
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

  // This runs automatically when the module starts
  async onModuleInit() {
    await this.setupPublicBucket(env.MINIO_BUCKET_NAME);
  }

  private async setupPublicBucket(bucketName: string) {
    try {
      // 1. Create bucket if it doesn't exist
      const exists = await this.minioClient.bucketExists(bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(bucketName);
        this.logger.info({ bucketName }, "Created missing Minio bucket");
      }

      // 2. Define the Read-Only policy for public access
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      };

      // 3. Apply the policy
      await this.minioClient.setBucketPolicy(
        bucketName,
        JSON.stringify(policy),
      );
      this.logger.info({ bucketName }, "Applied public read policy to bucket");
    } catch (error) {
      this.logger.error({ error }, "Failed to automate Minio bucket setup");
    }
  }

  async uploadFile(objectName: string, buffer: Buffer, mimeType: string) {
    await this.minioClient.putObject(
      env.MINIO_BUCKET_NAME,
      objectName,
      buffer,
      buffer.length,
      { "Content-Type": mimeType },
    );

    return `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET_NAME}/${objectName}`;
  }

  async deleteFile(bucketName: string, objectName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(bucketName, objectName);
    } catch (error) {
      this.logger.error(
        { error, objectName },
        "Failed to delete object from Minio",
      );
      throw error;
    }
  }
}
