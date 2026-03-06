import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  BadRequestException,
} from "@nestjs/common";
import { NotificationService } from "./notification.service.js";
import { ListNotificationsDto } from "./dto/list-notifications.dto.js";
import { ReadAllDto } from "./dto/read-all.dto.js";

@Controller("notifications")
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  async list(
    @Query("userId") userId: string,
    @Query() query: ListNotificationsDto,
  ) {
    if (!userId) {
      return { items: [], total: 0 };
    }

    const options: {
      userId: string;
      read?: boolean;
      limit?: number;
      offset?: number;
    } = { userId };
    if (query.read !== undefined) {
      options.read = query.read === "true";
    }
    if (query.limit !== undefined) options.limit = query.limit;
    if (query.offset !== undefined) options.offset = query.offset;

    return this.notificationService.list(options);
  }

  @Patch(":id/read")
  async markAsRead(
    @Param("id") id: string,
    @Query("userId") userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException("userId query param is required");
    }
    return this.notificationService.markAsRead(id, userId);
  }

  @Patch("read-all")
  async markAllAsRead(@Body() body: ReadAllDto) {
    return this.notificationService.markAllAsRead(body.userId);
  }
}
