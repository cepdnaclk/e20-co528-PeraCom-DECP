import { UserRole } from '@prisma/client';

export class RegisterDto {
  reg_number: string;
  email: string;
  google_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  residence?: string;
  role: UserRole;
  profile_pic?: string;
  header_img?: string;
  headline?: string;
  bio?: string;
}
