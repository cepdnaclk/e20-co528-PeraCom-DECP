import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  ProjectMember,
  MemberRole,
  type ProjectMemberDocument,
} from "../schemas/project-member.schema.js";
import { PROJECT_ROLES_KEY } from "../decorators/project-roles.decorator.js";

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(ProjectMember.name)
    private memberModel: Model<ProjectMemberDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Get the required roles for this specific route
    const requiredRoles = this.reflector.getAllAndOverride<MemberRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no specific roles are required, we bypass the guard (though usually you'd require at least VIEWER)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 2. Extract Request Context
    const request = context.switchToHttp().getRequest();
    const actorId = request.user?.sub; // Populated by your global JWT Auth Guard

    // We standardize that collaboration routes use ':projectId' in the URL
    // e.g., POST /projects/:projectId/documents
    const projectId = request.params.projectId;

    if (!actorId) {
      throw new ForbiddenException("Authentication required");
    }

    if (!projectId || !Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException(
        "Valid Project ID is required in the URL parameters",
      );
    }

    // 3. 🛡️ Fetch the Membership Record
    const membership = await this.memberModel
      .findOne({
        projectId: new Types.ObjectId(projectId),
        userId: actorId,
      })
      .lean()
      .exec();

    // 4. Zero-Trust Verification
    if (!membership) {
      // If they aren't a member at all, we deny access.
      // Note: For public projects, you might handle reads differently,
      // but for any write/admin action, non-members are strictly forbidden.
      throw new ForbiddenException("You are not a member of this project.");
    }

    // 5. Role Verification
    if (!requiredRoles.includes(membership.role as MemberRole)) {
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(", ")}`,
      );
    }

    // 6. ✨ THE ENTERPRISE WIN: Inject the membership into the request!
    // Now your controllers and services have instant access to the user's role
    // without ever having to query MongoDB again for this request cycle.
    request.projectMembership = membership;

    return true;
  }
}
