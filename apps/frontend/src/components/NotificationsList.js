import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell,
  faCircleInfo,
  faTriangleExclamation,
  faCircleExclamation,
} from '@fortawesome/free-solid-svg-icons';

// Alerts carry a severity, not a delivery channel: the backend raises them in-app and
// there is no email/telegram/push delivery implemented behind them. Showing severity is
// both true and more useful than a channel badge that never varied.
const SEVERITY_META = {
  info: { icon: faCircleInfo, label: 'Thông tin' },
  warning: { icon: faTriangleExclamation, label: 'Cảnh báo' },
  critical: { icon: faCircleExclamation, label: 'Nghiêm trọng' },
};

const DEFAULT_SEVERITY = { icon: faBell, label: 'Thông báo' };

const STATUS_META = {
  unread: { label: 'Chưa đọc', className: 'bg-secondary/15 text-secondary' },
  read: { label: 'Đã đọc', className: 'bg-tertiary/15 text-tertiary' },
  resolved: { label: 'Đã xử lý', className: 'bg-outline-variant/20 text-outline' },
};

const DEFAULT_STATUS = { label: 'Không rõ', className: 'bg-outline-variant/20 text-outline' };

function NotificationsList({ notifications, onItemClick }) {
  if (notifications.length === 0) {
    return <p className="text-body-md text-outline text-center py-10">Không có thông báo nào.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-outline-variant/20">
      {notifications.map(({ id, title, message, severity, status, time }) => {
        const severityMeta = SEVERITY_META[severity] || DEFAULT_SEVERITY;
        const statusMeta = STATUS_META[status] || DEFAULT_STATUS;
        const unread = status === 'unread';

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
              <FontAwesomeIcon icon={severityMeta.icon} className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {unread && <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />}
                <p className="text-body-md text-on-surface truncate">{title}</p>
              </div>
              <p className="text-label-sm text-outline mt-1">{message}</p>
              <p className="text-label-sm text-outline mt-1">
                {severityMeta.label} • {time}
              </p>
            </div>

            <span
              className={`shrink-0 px-2.5 py-1 rounded-full text-label-sm font-medium ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default NotificationsList;
