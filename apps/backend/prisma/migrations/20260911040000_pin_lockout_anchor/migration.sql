-- Lockout khong con neo theo thoi gian.
--
-- `accessLockStatus` dem so lan sai KE TU khi doi ma PIN. Truoc day moc neo la
-- `door_passwords.created_at`, so sanh voi `door_access_logs.created_at` — ca hai deu la
-- DATETIME(0). MySQL LAM TRON khi luu DATETIME(0), nen mot lan nhap sai luc 10:00:00.600
-- duoc luu thanh 10:00:01, con lan doi PIN luc 10:00:01.400 cung luu thanh 10:00:01:
-- lan sai XAY RA TRUOC khi doi PIN van bi tinh vao han muc cua ma PIN MOI. Nguoi dung bi
-- khoa sau 2 lan doan thay vi 3.
--
-- `anchor_log_id` ghi lai id log lon nhat tai thoi diem doi PIN, va viec dem chuyen sang
-- `id > anchor_log_id`. id la don dieu tuyet doi nen khong con phu thuoc vao dong ho —
-- cung dung ly do ma doan code cu da chon so sanh `id` thay vi `created_at` cho moc
-- "lan thanh cong gan nhat".
ALTER TABLE `door_passwords`
  ADD COLUMN `anchor_log_id` BIGINT UNSIGNED NULL AFTER `is_active`;

-- Index cu (door_device_id, access_method, result, id) khong chua `created_at`, nen khi
-- them dieu kien loc theo thoi gian moi dong ung vien phai tra ve PRIMARY de doc them —
-- do do khoang gap doi tren trang security (poll 5 giay). Them created_at de index phu
-- lai toan bo truy van.
DROP INDEX `idx_door_access_logs_lockout` ON `door_access_logs`;
CREATE INDEX `idx_door_access_logs_lockout`
  ON `door_access_logs` (`door_device_id`, `access_method`, `result`, `id`, `created_at`);
