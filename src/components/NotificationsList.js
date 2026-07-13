import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faEnvelope, faMobileScreenButton } from '@fortawesome/free-solid-svg-icons';
import { faTelegram } from '@fortawesome/free-brands-svg-icons';

const CHANNEL_META = {
  in_app: { icon: faBell, label: 'Trong ứng dụng' },
  email: { icon: faEnvelope, label: 'Email' },
  telegram: { icon: faTelegram, label: 'Telegram' },
  push: { icon: faMobileScreenButton, label: 'Push' },
};

const STATUS_META = {
  pending: { label: 'Chờ gửi', className: 'bg-outline-variant/20 text-outline' },
  sent: { label: 'Đã gửi', className: 'bg-secondary/15 text-secondary' },
  failed: { label: 'Gửi thất bại', className: 'bg-error/15 text-error' },
  read: { label: 'Đã đọc', className: 'bg-tertiary/15 text-tertiary' },
};

function NotificationsList({ notifications, onItemClick }) {
  if (notifications.length === 0) {
    return <p className="text-body-md text-outline text-center py-10">Không có thông báo nào.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-outline-variant/20">
      {notifications.map(({ id, title, message, channel, status, time }) => {
        const channelMeta = CHANNEL_META[channel];
        const statusMeta = STATUS_META[status];
        const unread = status !== 'read';

        return (
          <button
            key={id}
            type="button"
            onClick={() => onItemClick(id)}
            className={`flex items-start gap-3 py-4 text-left transition-colors hover:bg-surface-container-high ${
              unread ? 'bg-secondary/5' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
              <FontAwesomeIcon icon={channelMeta.icon} className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {unread && <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />}
                <p className="text-body-md text-on-surface truncate">{title}</p>
              </div>
              <p className="text-label-sm text-outline mt-1">{message}</p>
              <p className="text-label-sm text-outline mt-1">
                {channelMeta.label} • {time}
              </p>
            </div>

            <span className={`shrink-0 px-2.5 py-1 rounded-full text-label-sm font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default NotificationsList;
