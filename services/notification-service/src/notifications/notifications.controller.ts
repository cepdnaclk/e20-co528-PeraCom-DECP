import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // 1. Fetch the paginated inbox
  @Get()
  async getInbox(
    @Req() req: any,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    // Hard cap the limit to prevent malicious massive queries
    const safeLimit = Math.min(limit, 50);
    return this.notificationsService.getUserNotifications(
      req.user.sub,
      page,
      safeLimit,
    );
  }

  // 2. Fetch the little red badge count
  @Get("unread-count")
  async getUnreadCount(@Req() req: any) {
    return this.notificationsService.getUnreadCount(req.user.sub);
  }

  // 3. Mark everything as read (e.g., user clicks "Mark all as read" button)
  @Patch("read-all")
  async markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }

  // 4. Mark a specific one as read (e.g., user clicks a single notification)
  @Patch(":id/read")
  async markAsRead(@Param("id") notificationId: string, @Req() req: any) {
    return this.notificationsService.markAsRead(req.user.sub, notificationId);
  }
}
