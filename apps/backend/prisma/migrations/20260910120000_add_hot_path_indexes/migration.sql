-- Hai chi muc cho hai truy van nong nhat, ca hai truoc day deu phai filesort.

-- 1) Moi cho doc sensor_readings deu sap xep/loc theo captured_at (dashboard,
--    environment, lich su, ham gop theo ngay, va truy van "gia tri gan nhat" cua
--    simulator chay moi tick). Chi muc cu bat dau bang created_at nen MySQL chi dung
--    duoc tien to sensor_id roi filesort phan con lai — voi 1 ban ghi/5 giay thi la
--    ~17.000 dong/ngay/cam bien va cang chay lau cang cham.
CREATE INDEX `idx_sensor_readings_sensor_captured`
    ON `sensor_readings` (`sensor_id`, `captured_at`);

-- 2) accessLockStatus chay 2 truy van dung hinh dang nay moi lan thu PIN/khuon mat,
--    va tu khi pin-status bao them trang thai khoa thi no chay theo nhip poll 5 giay
--    cua trang An ninh. Khong chi muc cu nao phu duoc access_method.
CREATE INDEX `idx_door_access_logs_lockout`
    ON `door_access_logs` (`door_device_id`, `access_method`, `result`, `id`);
