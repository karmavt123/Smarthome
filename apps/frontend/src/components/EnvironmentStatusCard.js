import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLeaf, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

const STATUS_CONFIG = {
  safe: {
    title: 'An Toàn',
    icon: faLeaf,
    border: 'border-tertiary/40',
    shadow: 'shadow-[0_0_16px_rgba(78,222,163,0.12)]',
    iconBg: 'bg-tertiary/15',
    text: 'text-tertiary',
  },
  warning: {
    title: 'Cảnh Báo',
    icon: faTriangleExclamation,
    border: 'border-secondary/40',
    shadow: 'shadow-[0_0_16px_rgba(123,208,255,0.12)]',
    iconBg: 'bg-secondary/15',
    text: 'text-secondary',
  },
  critical: {
    title: 'Nguy Hiểm',
    icon: faTriangleExclamation,
    border: 'border-error/40',
    shadow: 'shadow-[0_0_16px_rgba(255,99,99,0.12)]',
    iconBg: 'bg-error/15',
    text: 'text-error',
  },
};

function EnvironmentStatusCard({ status, description }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.safe;

  return (
    <div className={`bg-surface-container rounded-xl border ${config.border} ${config.shadow} p-4`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-full ${config.iconBg} flex items-center justify-center ${config.text} shrink-0`}>
          <FontAwesomeIcon icon={config.icon} className="w-4 h-4" />
        </div>
        <p className={`text-body-lg font-semibold ${config.text}`}>{config.title}</p>
      </div>
      <p className="text-body-md text-on-surface-variant">{description}</p>
    </div>
  );
}

export default EnvironmentStatusCard;
