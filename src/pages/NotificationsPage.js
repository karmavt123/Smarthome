import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckDouble } from '@fortawesome/free-solid-svg-icons';
import NotificationsList from '~/components/NotificationsList';

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    title: 'Truy cập trái phép được phát hiện',
    message: 'Phát hiện nỗ lực nhập sai mật khẩu 3 lần tại Cửa chính.',
    channel: 'push',
    status: 'sent',
    time: '14:32, 02 Th10',
  },
  {
    id: 2,
    title: 'Khóa cửa trước đã mở bằng vân tay',
    message: 'Anh Quân đã mở cửa trước bằng vân tay.',
    channel: 'in_app',
    status: 'read',
    time: '14:55, 02 Th10',
  },
  {
    id: 3,
    title: 'Hệ thống báo động đã được kích hoạt',
    message: 'Chế độ báo động tự động bật lúc rời khỏi nhà.',
    channel: 'telegram',
    status: 'sent',
    time: '12:10, 02 Th10',
  },
  {
    id: 4,
    title: 'Nhiệt độ Phòng khách vượt ngưỡng',
    message: 'Nhiệt độ đo được 35.2°C, vượt ngưỡng cảnh báo 35°C.',
    channel: 'email',
    status: 'failed',
    time: '09:20, 02 Th10',
  },
  {
    id: 5,
    title: 'Thiết bị mất kết nối',
    message: 'Cảm biến nhiệt độ - Phòng khách đã mất kết nối.',
    channel: 'in_app',
    status: 'pending',
    time: '08:47, 02 Th10',
  },
  {
    id: 6,
    title: 'Chào mừng đến với Lumina Home Logic',
    message: 'Tài khoản của bạn đã sẵn sàng. Hãy khám phá các tính năng của hệ thống.',
    channel: 'email',
    status: 'read',
    time: '01 Th10',
  },
];

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
];

function NotificationsPage() {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState('all');

  const unreadCount = notifications.filter((n) => n.status !== 'read').length;
  const visibleNotifications =
    activeTab === 'unread' ? notifications.filter((n) => n.status !== 'read') : notifications;

  const markAsRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })));
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-headline-md font-semibold text-on-surface">Thông báo</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-secondary text-on-secondary text-label-sm font-semibold">
              {unreadCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={markAllAsRead}
          className="flex items-center gap-2 text-secondary text-body-md hover:underline"
        >
          <FontAwesomeIcon icon={faCheckDouble} className="w-3.5 h-3.5" />
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-full text-body-md border transition-colors ${
              activeTab === id
                ? 'bg-secondary/15 border-secondary text-secondary font-medium'
                : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-surface-container rounded-xl border border-outline-variant/30 px-5">
        <NotificationsList notifications={visibleNotifications} onItemClick={markAsRead} />
      </div>
    </div>
  );
}

export default NotificationsPage;
