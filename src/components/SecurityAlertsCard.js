import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

const TONE_CLASSNAMES = {
  error: 'bg-error/15 text-error',
  secondary: 'bg-secondary/15 text-secondary',
  tertiary: 'bg-tertiary/15 text-tertiary',
};

function SecurityAlertsCard({ alerts, page = 1, totalPages = 1, onPrevPage, onNextPage }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body-lg font-semibold text-on-surface">Cảnh báo An ninh</h3>
        <Link to="/an-ninh" className="text-label-md text-secondary hover:underline">
          Tất cả
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {alerts.length === 0 && <p className="text-body-md text-outline">Không có cảnh báo nào.</p>}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/30">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={page <= 1}
            className="w-7 h-7 rounded-full flex items-center justify-center text-outline hover:text-on-surface disabled:opacity-30 disabled:hover:text-outline"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
          </button>
          <span className="text-label-sm text-outline">
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={page >= totalPages}
            className="w-7 h-7 rounded-full flex items-center justify-center text-outline hover:text-on-surface disabled:opacity-30 disabled:hover:text-outline"
          >
            <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default SecurityAlertsCard;
