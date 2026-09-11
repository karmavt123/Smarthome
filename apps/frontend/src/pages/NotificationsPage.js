import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckDouble, faSpinner } from '@fortawesome/free-solid-svg-icons';
import NotificationsList from '~/components/NotificationsList';
import useHome from '~/hooks/useHome';
import alertService from '~/services/alertService';

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
];

const PAGE_SIZE = 50;

function formatTime(createdAt) {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function NotificationsPage() {
  const { currentHomeId } = useHome();
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!currentHomeId) return;
    setIsLoading(true);
    try {
      const res = await alertService.getAll(currentHomeId, { limit: PAGE_SIZE });
      setNotifications(
        res.data.map((alert) => ({
          id: alert.id,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          status: alert.status,
          time: formatTime(alert.createdAt),
        }))
      );
      setLoadError(null);
    } catch (err) {
      setLoadError(err?.message || 'Không thể tải thông báo.');
    } finally {
      setIsLoading(false);
    }
  }, [currentHomeId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;
  const visibleNotifications =
    activeTab === 'unread' ? notifications.filter((n) => n.status === 'unread') : notifications;

  const markAsRead = async (id) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.status !== 'unread') return;

    // Optimistic, then reconciled: a failed PATCH rolls the row back so the badge never
    // claims something was read when the server still has it unread.
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)));
    try {
      await alertService.updateAlert(id, { status: 'read' });
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: target.status } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => n.status === 'unread');
    if (unread.length === 0) return;

    setNotifications((prev) =>
      prev.map((n) => (n.status === 'unread' ? { ...n, status: 'read' } : n))
    );
    // The backend has no bulk endpoint, so this is one PATCH per alert. allSettled keeps
    // one failure from hiding the rest; the refetch afterwards is what makes the list
    // match the server either way.
    await Promise.allSettled(unread.map((n) => alertService.updateAlert(n.id, { status: 'read' })));
    fetchNotifications();
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
          disabled={unreadCount === 0}
          className="flex items-center gap-2 text-secondary text-body-md hover:underline disabled:opacity-50 disabled:hover:no-underline"
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

      {loadError && <p className="text-body-md text-error mb-4">{loadError}</p>}

      <div className="bg-surface-container rounded-xl border border-outline-variant/30 px-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-secondary animate-spin" />
          </div>
        ) : (
          <NotificationsList notifications={visibleNotifications} onItemClick={markAsRead} />
        )}
      </div>
    </div>
  );
}

export default NotificationsPage;
