import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faPen } from '@fortawesome/free-solid-svg-icons';

function PasscodeCard({ active, onEdit }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
          <FontAwesomeIcon icon={faKey} className="w-4 h-4" />
        </div>
        <div>
          <p className="text-body-md font-medium text-on-surface">Mật khẩu số</p>
          <p className="text-label-sm text-outline mt-0.5">
            Mã PIN 6 số {active ? 'đang hoạt động' : 'đã tắt'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Đổi mã PIN"
        className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface shrink-0"
      >
        <FontAwesomeIcon icon={faPen} className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default PasscodeCard;
