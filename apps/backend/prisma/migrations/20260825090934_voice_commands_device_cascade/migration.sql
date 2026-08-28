-- DropForeignKey
ALTER TABLE `voice_commands` DROP FOREIGN KEY `fk_voice_commands_device`;

-- AddForeignKey
ALTER TABLE `voice_commands` ADD CONSTRAINT `fk_voice_commands_device` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
