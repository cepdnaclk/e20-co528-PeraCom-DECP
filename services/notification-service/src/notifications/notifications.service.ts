import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Notification,
  type NotificationDocument,
} from "./schemas/notification.schema.js";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  // ========================================================================
  // GET USER INBOX (Paginated)
  // ========================================================================
  async getUserNotifications(
    actorId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    // Use the compound index { recipientId: 1, isRead: 1, createdAt: -1 } we built earlier
    const notifications = await this.notificationModel
      .find({ recipientId: actorId })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    // Get total count for frontend pagination metadata
    const total = await this.notificationModel.countDocuments({
      recipientId: actorId,
    });

    return {
      data: notifications,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  // ========================================================================
  // GET UNREAD BADGE COUNT (Ultra-fast UI update)
  // ========================================================================
  async getUnreadCount(actorId: string) {
    const count = await this.notificationModel
      .countDocuments({
        recipientId: actorId,
        isRead: false,
      })
      .exec();

    return { unreadCount: count };
  }

  // ========================================================================
  // MARK SINGLE NOTIFICATION AS READ
  // ========================================================================
  async markAsRead(actorId: string, notificationId: string) {
    if (!Types.ObjectId.isValid(notificationId))
      throw new BadRequestException("Invalid ID");

    const result = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          recipientId: actorId, // 🛡️ Security: Ensure they own this notification
        },
        { $set: { isRead: true } },
        { new: true },
      )
      .exec();

    if (!result) throw new NotFoundException("Notification not found");

    return { success: true, isRead: result.isRead };
  }

  // ========================================================================
  // MARK ALL AS READ (Common UX requirement)
  // ========================================================================
  async markAllAsRead(actorId: string) {
    await this.notificationModel
      .updateMany(
        {
          recipientId: actorId,
          isRead: false,
        },
        { $set: { isRead: true } },
      )
      .exec();

    return { success: true, message: "All notifications marked as read." };
  }
}
