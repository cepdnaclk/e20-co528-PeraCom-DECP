import { SetMetadata } from "@nestjs/common";
import { MemberRole } from "../schemas/project-member.schema.js";

export const PROJECT_ROLES_KEY = "project_roles";

// Accepts a spread of allowed roles (e.g., @ProjectRoles(MemberRole.OWNER, MemberRole.EDITOR))
export const ProjectRoles = (...roles: MemberRole[]) =>
  SetMetadata(PROJECT_ROLES_KEY, roles);
