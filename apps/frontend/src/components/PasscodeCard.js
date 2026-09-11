import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faPen, faLock } from '@fortawesome/free-solid-svg-icons';

function formatUntil(lockedUntil) {
  if (!lockedUntil) return null;
  const date = new Date(lockedUntil);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// `hasPin`, `locked` and `lockedUntil` all come from GET /api/door-access/pin-status.
// (An older comment here claimed the backend had no status endpoint — it does, and the
// PIN lockout it now reports is the same 3-strikes rule Face ID uses.)
function PasscodeCard({ onEdit, hasPin, locked, lockedUntil, lockoutThreshold }) {
  const until = formatUntil(lockedUntil);

  let statusText = 'Mã PIN 4-8 số để mở cửa';
  if (hasPin === true) statusText = 'Đã đặt · dùng để mở cửa khi Face ID lỗi';
  if (hasPin === false) statusText = 'Chưa đặt · cần đặt trước khi dùng cửa';

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
          <FontAwesomeIcon icon={faKey} className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-body-md font-medium text-on-surface">Mật khẩu số</p>
            {hasPin === true && !locked && (
              <span className="px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary text-label-sm font-medium">
                Đã đặt
              </span>
            )}
            {hasPin === false && (
              <span className="px-2 py-0.5 rounded-full bg-error/15 text-error text-label-sm font-medium">
                Chưa đặt
              </span>
            )}
            {locked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error/15 text-error text-label-sm font-medium">
                <FontAwesomeIcon icon={faLock} className="w-3 h-3" />
                Đang khoá
              </span>
            )}
          </div>
          <p className="text-label-sm text-outline mt-0.5">
            {locked
              ? `Sai quá ${lockoutThreshold ?? 3} lần liên tiếp${until ? `, mở lại lúc ${until}` : ''}`
              : statusText}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={hasPin ? 'Đổi mã PIN' : 'Đặt mã PIN'}
        className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface shrink-0"
      >
        <FontAwesomeIcon icon={faPen} className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default PasscodeCard;
