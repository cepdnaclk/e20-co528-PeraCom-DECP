import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { NotificationDocument } from "./notification.schema.js";

export interface CreateNotificationDto {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  eventId: string;
  eventType: string;
}

export interface ListNotificationsOptions {
  userId: string;
  read?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel("Notification")
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<NotificationDocument> {
    const existing = await this.notificationModel
      .findOne({ eventId: dto.eventId })
      .exec();
    if (existing) {
      return existing;
    }

    const doc = new this.notificationModel({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      body: dto.body ?? "",
      data: dto.data ?? {},
      read: false,
      eventId: dto.eventId,
      eventType: dto.eventType,
    });
    return doc.save();
  }

  async list(options: ListNotificationsOptions) {
    const filter: { userId: string; read?: boolean } = {
      userId: options.userId,
    };
    if (options.read !== undefined) {
      filter.read = options.read;
    }

    const limit = Math.min(options.limit ?? 50, 100);
    const offset = options.offset ?? 0;

    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  async markAsRead(id: string, userId: string): Promise<NotificationDocument> {
    const doc = await this.notificationModel
      .findOneAndUpdate(
        { _id: id, userId },
        { $set: { read: true } },
        { new: true },
      )
      .exec();
    if (!doc) {
      throw new NotFoundException("Notification not found");
    }
    return doc;
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.notificationModel
      .updateMany({ userId, read: false }, { $set: { read: true } })
      .exec();
    return { count: result.modifiedCount };
  }
}
