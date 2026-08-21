-- CreateTable
CREATE TABLE `alert_rules` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `home_id` INTEGER UNSIGNED NOT NULL,
    `sensor_id` INTEGER UNSIGNED NULL,
    `name` VARCHAR(100) NOT NULL,
    `condition_operator` ENUM('>', '<', '>=', '<=', '=') NOT NULL,
    `threshold_value` DECIMAL(10, 2) NOT NULL,
    `severity` ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'warning',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_alert_rules_sensor`(`sensor_id`),
    INDEX `idx_alert_rules_home_active`(`home_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alerts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `home_id` INTEGER UNSIGNED NOT NULL,
    `alert_rule_id` INTEGER UNSIGNED NULL,
    `alert_type` ENUM('environment', 'unauthorized_access', 'device_offline') NOT NULL,
    `severity` ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'warning',
    `title` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('unread', 'read', 'resolved') NOT NULL DEFAULT 'unread',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL,

    INDEX `fk_alerts_rule`(`alert_rule_id`),
    INDEX `idx_alerts_home_status`(`home_id`, `status`),
    INDEX `idx_alerts_type_time`(`alert_type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_actions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `device_id` INTEGER UNSIGNED NOT NULL,
    `user_id` INTEGER UNSIGNED NULL,
    `action` ENUM('turn_on', 'turn_off', 'open', 'close') NOT NULL,
    `control_method` ENUM('app', 'voice', 'password', 'face', 'automatic', 'manual') NOT NULL,
    `execution_status` ENUM('success', 'failed') NOT NULL,
    `failure_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_device_actions_device_time`(`device_id`, `created_at`),
    INDEX `idx_device_actions_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `home_id` INTEGER UNSIGNED NOT NULL,
    `room_id` INTEGER UNSIGNED NULL,
    `name` VARCHAR(100) NOT NULL,
    `device_code` VARCHAR(100) NOT NULL,
    `device_type` ENUM('light', 'fan', 'door', 'sensor') NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'off',
    `connection_status` ENUM('online', 'offline') NOT NULL DEFAULT 'offline',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `device_code`(`device_code`),
    INDEX `idx_devices_connection_status`(`connection_status`),
    INDEX `idx_devices_home`(`home_id`),
    INDEX `idx_devices_room`(`room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `door_access_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `door_device_id` INTEGER UNSIGNED NOT NULL,
    `user_id` INTEGER UNSIGNED NULL,
    `face_profile_id` INTEGER UNSIGNED NULL,
    `access_method` ENUM('password', 'face', 'app', 'voice', 'manual') NOT NULL,
    `result` ENUM('success', 'failed') NOT NULL,
    `confidence_score` DECIMAL(5, 4) NULL,
    `snapshot_url` TEXT NULL,
    `failure_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_door_access_logs_face_profile`(`face_profile_id`),
    INDEX `fk_door_access_logs_user`(`user_id`),
    INDEX `idx_door_access_logs_device_time`(`door_device_id`, `created_at`),
    INDEX `idx_door_access_logs_result_time`(`result`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `door_passwords` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `door_device_id` INTEGER UNSIGNED NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `updated_by` INTEGER UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_door_passwords_user`(`updated_by`),
    INDEX `idx_door_passwords_device_active`(`door_device_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `face_profiles` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `home_id` INTEGER UNSIGNED NOT NULL,
    `user_id` INTEGER UNSIGNED NULL,
    `name` VARCHAR(100) NOT NULL,
    `image_url` TEXT NULL,
    `face_embedding` LONGTEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_face_profiles_user`(`user_id`),
    INDEX `idx_face_profiles_home_active`(`home_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `home_members` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `home_id` INTEGER UNSIGNED NOT NULL,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `member_role` ENUM('owner', 'member') NOT NULL DEFAULT 'member',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_home_members_user`(`user_id`),
    UNIQUE INDEX `uq_home_members`(`home_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `homes` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `address` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `alert_id` BIGINT UNSIGNED NULL,
    `title` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `channel` ENUM('in_app', 'email', 'telegram', 'push') NOT NULL DEFAULT 'in_app',
    `status` ENUM('pending', 'sent', 'failed', 'read') NOT NULL DEFAULT 'pending',
    `updated_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_notifications_alert`(`alert_id`),
    INDEX `idx_notifications_created_at`(`created_at`),
    INDEX `idx_notifications_user_status`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `home_id` INTEGER UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_rooms_home_name`(`home_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sensor_readings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sensor_id` INTEGER UNSIGNED NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_sensor_readings_sensor_time`(`sensor_id`, `created_at`),
    INDEX `idx_sensor_readings_time`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sensors` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `device_id` INTEGER UNSIGNED NOT NULL,
    `sensor_type` ENUM('temperature', 'humidity', 'light') NOT NULL,
    `unit` VARCHAR(20) NOT NULL,
    `min_value` DECIMAL(10, 2) NULL,
    `max_value` DECIMAL(10, 2) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_sensors_device_type`(`device_id`, `sensor_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `avatar_url` TEXT NULL,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voice_commands` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NULL,
    `device_id` INTEGER UNSIGNED NULL,
    `recognized_text` TEXT NOT NULL,
    `intent` VARCHAR(100) NULL,
    `confidence_score` DECIMAL(5, 4) NULL,
    `execution_status` ENUM('success', 'failed', 'unknown_command') NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_voice_commands_device`(`device_id`),
    INDEX `idx_voice_commands_status`(`execution_status`),
    INDEX `idx_voice_commands_user_time`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `alert_rules` ADD CONSTRAINT `fk_alert_rules_home` FOREIGN KEY (`home_id`) REFERENCES `homes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_rules` ADD CONSTRAINT `fk_alert_rules_sensor` FOREIGN KEY (`sensor_id`) REFERENCES `sensors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `fk_alerts_home` FOREIGN KEY (`home_id`) REFERENCES `homes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `fk_alerts_rule` FOREIGN KEY (`alert_rule_id`) REFERENCES `alert_rules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_actions` ADD CONSTRAINT `fk_device_actions_device` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_actions` ADD CONSTRAINT `fk_device_actions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `fk_devices_home` FOREIGN KEY (`home_id`) REFERENCES `homes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `fk_devices_room` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `door_access_logs` ADD CONSTRAINT `fk_door_access_logs_device` FOREIGN KEY (`door_device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `door_access_logs` ADD CONSTRAINT `fk_door_access_logs_face_profile` FOREIGN KEY (`face_profile_id`) REFERENCES `face_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `door_access_logs` ADD CONSTRAINT `fk_door_access_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `door_passwords` ADD CONSTRAINT `fk_door_passwords_device` FOREIGN KEY (`door_device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `door_passwords` ADD CONSTRAINT `fk_door_passwords_user` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_profiles` ADD CONSTRAINT `fk_face_profiles_home` FOREIGN KEY (`home_id`) REFERENCES `homes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_profiles` ADD CONSTRAINT `fk_face_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `home_members` ADD CONSTRAINT `fk_home_members_home` FOREIGN KEY (`home_id`) REFERENCES `homes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `home_members` ADD CONSTRAINT `fk_home_members_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_alert` FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rooms` ADD CONSTRAINT `fk_rooms_home` FOREIGN KEY (`home_id`) REFERENCES `homes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sensor_readings` ADD CONSTRAINT `fk_sensor_readings_sensor` FOREIGN KEY (`sensor_id`) REFERENCES `sensors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sensors` ADD CONSTRAINT `fk_sensors_device` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_commands` ADD CONSTRAINT `fk_voice_commands_device` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_commands` ADD CONSTRAINT `fk_voice_commands_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
