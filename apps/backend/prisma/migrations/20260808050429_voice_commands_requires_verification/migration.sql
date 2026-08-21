-- AlterTable
ALTER TABLE `voice_commands` MODIFY `execution_status` ENUM('success', 'failed', 'unknown_command', 'requires_verification') NOT NULL;
