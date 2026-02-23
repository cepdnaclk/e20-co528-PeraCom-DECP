/*
  Warnings:

  - You are about to drop the column `google_id` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "users_google_id_idx";

-- DropIndex
DROP INDEX "users_google_id_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "google_id";
