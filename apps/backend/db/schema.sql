CREATE DATABASE IF NOT EXISTS smart_home
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE smart_home;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS voice_commands;
DROP TABLE IF EXISTS door_access_logs;
DROP TABLE IF EXISTS door_passwords;
DROP TABLE IF EXISTS face_profiles;
DROP TABLE IF EXISTS pairing_tokens;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS device_commands;
DROP TABLE IF EXISTS device_actions;
DROP TABLE IF EXISTS sensor_readings;
DROP TABLE IF EXISTS telemetry_messages;
DROP TABLE IF EXISTS sensors;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS homes;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE homes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_homes_user (user_id),
    CONSTRAINT fk_homes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE rooms (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    home_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rooms_home_name (home_id, name),
    CONSTRAINT fk_rooms_home
        FOREIGN KEY (home_id) REFERENCES homes(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE devices (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    home_id INT UNSIGNED NOT NULL,
    room_id INT UNSIGNED,
    name VARCHAR(100) NOT NULL,
    device_code VARCHAR(100) NOT NULL,
    device_type ENUM('light', 'fan', 'door', 'sensor') NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'off',
    value VARCHAR(30),
    connection_status ENUM('online', 'offline') NOT NULL DEFAULT 'offline',
    api_key_hash CHAR(64),
    firmware_version VARCHAR(50),
    last_seen_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_devices_home (home_id),
    INDEX idx_devices_room (room_id),
    INDEX idx_devices_connection_status (connection_status),
    INDEX idx_devices_device_code (device_code),
    CONSTRAINT fk_devices_home
        FOREIGN KEY (home_id) REFERENCES homes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_devices_room
        FOREIGN KEY (room_id) REFERENCES rooms(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sensors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id INT UNSIGNED NOT NULL,
    sensor_type ENUM('temperature', 'humidity', 'light') NOT NULL,
    unit VARCHAR(20) NOT NULL,
    min_value DECIMAL(10,2),
    max_value DECIMAL(10,2),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sensors_device_type (device_id, sensor_type),
    CONSTRAINT fk_sensors_device
        FOREIGN KEY (device_id) REFERENCES devices(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE telemetry_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id INT UNSIGNED NOT NULL,
    message_id VARCHAR(100) NOT NULL,
    captured_at DATETIME NOT NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_telemetry_device_message (device_id, message_id),
    INDEX idx_telemetry_device_time (device_id, captured_at),
    CONSTRAINT fk_telemetry_messages_device
        FOREIGN KEY (device_id) REFERENCES devices(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sensor_readings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sensor_id INT UNSIGNED NOT NULL,
    telemetry_message_id BIGINT UNSIGNED NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    captured_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sensor_readings_sensor_time (sensor_id, created_at),
    INDEX idx_sensor_readings_time (created_at),
    INDEX idx_sensor_readings_message (telemetry_message_id),
    CONSTRAINT fk_sensor_readings_sensor
        FOREIGN KEY (sensor_id) REFERENCES sensors(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sensor_readings_message
        FOREIGN KEY (telemetry_message_id) REFERENCES telemetry_messages(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE device_actions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED,
    action ENUM('turn_on', 'turn_off', 'open', 'close', 'set_speed', 'set_color') NOT NULL,
    control_method ENUM('app', 'voice', 'password', 'face', 'automatic', 'manual') NOT NULL,
    execution_status ENUM('success', 'failed') NOT NULL,
    failure_reason VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_actions_device_time (device_id, created_at),
    INDEX idx_device_actions_user (user_id),
    CONSTRAINT fk_device_actions_device
        FOREIGN KEY (device_id) REFERENCES devices(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_device_actions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE device_commands (
    id CHAR(36) PRIMARY KEY,
    device_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    action ENUM('turn_on', 'turn_off', 'open', 'close', 'set_speed', 'set_color') NOT NULL,
    value JSON,
    control_method ENUM('app', 'voice', 'password', 'face', 'automatic', 'manual') NOT NULL DEFAULT 'app',
    status ENUM('pending', 'delivered', 'executed', 'failed', 'expired') NOT NULL DEFAULT 'pending',
    delivery_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    failure_reason VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME,
    acknowledged_at DATETIME,
    expires_at DATETIME NOT NULL,
    INDEX idx_device_commands_poll (device_id, status, created_at),
    INDEX idx_device_commands_user_time (user_id, created_at),
    CONSTRAINT fk_device_commands_device
        FOREIGN KEY (device_id) REFERENCES devices(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_device_commands_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_refresh_tokens_user (user_id),
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE pairing_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    home_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pairing_tokens_home (home_id),
    INDEX idx_pairing_tokens_user (user_id),
    CONSTRAINT fk_pairing_tokens_home
        FOREIGN KEY (home_id) REFERENCES homes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pairing_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE face_profiles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    home_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED,
    name VARCHAR(100) NOT NULL,
    image_url TEXT,
    face_embedding LONGTEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_face_profiles_home_active (home_id, is_active),
    CONSTRAINT fk_face_profiles_home
        FOREIGN KEY (home_id) REFERENCES homes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_face_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE door_passwords (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    door_device_id INT UNSIGNED NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by INT UNSIGNED,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_door_passwords_device_active (door_device_id, is_active),
    CONSTRAINT fk_door_passwords_device
        FOREIGN KEY (door_device_id) REFERENCES devices(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_door_passwords_user
        FOREIGN KEY (updated_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE door_access_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    door_device_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED,
    face_profile_id INT UNSIGNED,
    access_method ENUM('password', 'face', 'app', 'voice', 'manual') NOT NULL,
    result ENUM('success', 'failed') NOT NULL,
    confidence_score DECIMAL(5,4),
    snapshot_url TEXT,
    failure_reason VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_door_access_logs_device_time (door_device_id, created_at),
    INDEX idx_door_access_logs_result_time (result, created_at),
    CONSTRAINT fk_door_access_logs_device
        FOREIGN KEY (door_device_id) REFERENCES devices(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_door_access_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_door_access_logs_face_profile
        FOREIGN KEY (face_profile_id) REFERENCES face_profiles(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE voice_commands (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED,
    device_id INT UNSIGNED,
    recognized_text TEXT NOT NULL,
    intent VARCHAR(100),
    confidence_score DECIMAL(5,4),
    execution_status ENUM('success', 'failed', 'unknown_command', 'requires_verification') NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_voice_commands_user_time (user_id, created_at),
    INDEX idx_voice_commands_status (execution_status),
    CONSTRAINT fk_voice_commands_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_voice_commands_device
        FOREIGN KEY (device_id) REFERENCES devices(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE alert_rules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    home_id INT UNSIGNED NOT NULL,
    sensor_id INT UNSIGNED,
    name VARCHAR(100) NOT NULL,
    condition_operator ENUM('>', '<', '>=', '<=', '=') NOT NULL,
    threshold_value DECIMAL(10,2) NOT NULL,
    severity ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'warning',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_alert_rules_home_active (home_id, is_active),
    CONSTRAINT fk_alert_rules_home
        FOREIGN KEY (home_id) REFERENCES homes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alert_rules_sensor
        FOREIGN KEY (sensor_id) REFERENCES sensors(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE alerts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    home_id INT UNSIGNED NOT NULL,
    alert_rule_id INT UNSIGNED,
    alert_type ENUM('environment', 'unauthorized_access', 'device_offline') NOT NULL,
    severity ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'warning',
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('unread', 'read', 'resolved') NOT NULL DEFAULT 'unread',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    INDEX idx_alerts_home_status (home_id, status),
    INDEX idx_alerts_type_time (alert_type, created_at),
    CONSTRAINT fk_alerts_home
        FOREIGN KEY (home_id) REFERENCES homes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alerts_rule
        FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    alert_id BIGINT UNSIGNED,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    channel ENUM('in_app', 'email', 'telegram', 'push') NOT NULL DEFAULT 'in_app',
    status ENUM('pending', 'sent', 'failed', 'read') NOT NULL DEFAULT 'pending',
    updated_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user_status (user_id, status),
    INDEX idx_notifications_created_at (created_at),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_notifications_alert
        FOREIGN KEY (alert_id) REFERENCES alerts(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
