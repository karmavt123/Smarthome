ALTER TABLE `devices`
    ADD COLUMN `api_key_hash` CHAR(64) NULL,
    ADD COLUMN `firmware_version` VARCHAR(50) NULL,
    ADD COLUMN `last_seen_at` DATETIME(0) NULL;

ALTER TABLE `device_actions`
    MODIFY COLUMN `action` ENUM(
        'turn_on',
        'turn_off',
        'open',
        'close',
        'set_speed',
        'set_color'
    ) NOT NULL;

CREATE TABLE `device_commands` (
    `id` CHAR(36) NOT NULL,
    `device_id` INTEGER UNSIGNED NOT NULL,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `action` ENUM(
        'turn_on',
        'turn_off',
        'open',
        'close',
        'set_speed',
        'set_color'
    ) NOT NULL,
    `value` JSON NULL,
    `control_method` ENUM(
        'app',
        'voice',
        'password',
        'face',
        'automatic',
        'manual'
    ) NOT NULL DEFAULT 'app',
    `status` ENUM(
        'pending',
        'delivered',
        'executed',
        'failed',
        'expired'
    ) NOT NULL DEFAULT 'pending',
    `delivery_attempts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `failure_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `delivered_at` DATETIME(0) NULL,
    `acknowledged_at` DATETIME(0) NULL,
    `expires_at` DATETIME(0) NOT NULL,

    INDEX `idx_device_commands_poll`(
        `device_id`,
        `status`,
        `created_at`
    ),
    INDEX `idx_device_commands_user_time`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `telemetry_messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `device_id` INTEGER UNSIGNED NOT NULL,
    `message_id` VARCHAR(100) NOT NULL,
    `captured_at` DATETIME(0) NOT NULL,
    `received_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_telemetry_device_message`(
        `device_id`,
        `message_id`
    ),
    INDEX `idx_telemetry_device_time`(`device_id`, `captured_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sensor_readings`
    ADD COLUMN `telemetry_message_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `captured_at` DATETIME(0) NULL;

INSERT INTO `telemetry_messages` (
    `device_id`,
    `message_id`,
    `captured_at`,
    `received_at`
)
SELECT
    `sensors`.`device_id`,
    CONCAT('legacy-', `sensor_readings`.`id`),
    `sensor_readings`.`created_at`,
    `sensor_readings`.`created_at`
FROM `sensor_readings`
INNER JOIN `sensors`
    ON `sensors`.`id` = `sensor_readings`.`sensor_id`;

UPDATE `sensor_readings`
INNER JOIN `sensors`
    ON `sensors`.`id` = `sensor_readings`.`sensor_id`
INNER JOIN `telemetry_messages`
    ON `telemetry_messages`.`device_id` = `sensors`.`device_id`
    AND `telemetry_messages`.`message_id` = CONCAT(
        'legacy-',
        `sensor_readings`.`id`
    )
SET
    `sensor_readings`.`captured_at` = `sensor_readings`.`created_at`,
    `sensor_readings`.`telemetry_message_id` = `telemetry_messages`.`id`;

ALTER TABLE `sensor_readings`
    MODIFY COLUMN `telemetry_message_id` BIGINT UNSIGNED NOT NULL,
    MODIFY COLUMN `captured_at` DATETIME(0) NOT NULL,
    ADD INDEX `idx_sensor_readings_message`(`telemetry_message_id`);

ALTER TABLE `device_commands`
    ADD CONSTRAINT `fk_device_commands_device`
        FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `fk_device_commands_user`
        FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `telemetry_messages`
    ADD CONSTRAINT `fk_telemetry_messages_device`
        FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sensor_readings`
    ADD CONSTRAINT `fk_sensor_readings_message`
        FOREIGN KEY (`telemetry_message_id`) REFERENCES `telemetry_messages`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;
