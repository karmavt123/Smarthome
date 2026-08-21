-- DropIndex
DROP INDEX `device_code` ON `devices`;

-- CreateIndex
CREATE INDEX `idx_devices_device_code` ON `devices`(`device_code`);
