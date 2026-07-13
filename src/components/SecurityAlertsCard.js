import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const TONE_CLASSNAMES = {
  error: 'bg-error/15 text-error',
  secondary: 'bg-secondary/15 text-secondary',
  tertiary: 'bg-tertiary/15 text-tertiary',
};

function SecurityAlertsCard({ alerts }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body-lg font-semibold text-on-surface">Cảnh báo An ninh</h3>
        <Link to="/an-ninh" className="text-label-md text-secondary hover:underline">
          Tất cả
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {alerts.map(({ id, icon, tone, title, meta }) => (
          <div key={id} className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${TONE_CLASSNAMES[tone]}`}
            >
              <FontAwesomeIcon icon={icon} className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-body-md text-on-surface leading-snug">{title}</p>
              <p className="text-label-sm text-outline mt-1">{meta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SecurityAlertsCard;
