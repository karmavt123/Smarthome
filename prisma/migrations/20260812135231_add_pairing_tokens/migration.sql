-- CreateTable
CREATE TABLE `pairing_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `home_id` INTEGER UNSIGNED NOT NULL,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `used_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `pairing_token_hash`(`token_hash`),
    INDEX `idx_pairing_tokens_home`(`home_id`),
    INDEX `idx_pairing_tokens_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pairing_tokens` ADD CONSTRAINT `fk_pairing_tokens_home` FOREIGN KEY (`home_id`) REFERENCES `homes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pairing_tokens` ADD CONSTRAINT `fk_pairing_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
