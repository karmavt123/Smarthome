import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

function SecurityAlertBanner({ title, message, onCheck }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-error/10 border border-error/30 rounded-xl px-5 py-4">
      <div className="flex items-start gap-3">
        <FontAwesomeIcon icon={faTriangleExclamation} className="w-4 h-4 text-error mt-1 shrink-0" />
        <div>
          <p className="text-body-md font-semibold text-error">{title}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCheck}
        className="shrink-0 rounded-lg bg-error/20 text-error font-medium px-4 py-2 text-body-md hover:bg-error/30 transition-colors"
      >
        Kiểm tra ngay
      </button>
    </div>
  );
}

export default SecurityAlertBanner;
