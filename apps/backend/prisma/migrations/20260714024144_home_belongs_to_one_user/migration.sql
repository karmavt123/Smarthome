/*
  Warnings:

  - You are about to drop the `home_members` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `user_id` to the `homes` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `home_members` DROP FOREIGN KEY `fk_home_members_home`;

-- DropForeignKey
ALTER TABLE `home_members` DROP FOREIGN KEY `fk_home_members_user`;

-- AlterTable
ALTER TABLE `homes` ADD COLUMN `user_id` INTEGER UNSIGNED NOT NULL;

-- DropTable
DROP TABLE `home_members`;

-- CreateIndex
CREATE INDEX `idx_homes_user` ON `homes`(`user_id`);

-- AddForeignKey
ALTER TABLE `homes` ADD CONSTRAINT `fk_homes_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
