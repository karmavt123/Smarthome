import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen } from '@fortawesome/free-solid-svg-icons';
import Switch from '~/components/Switch';

function QuickControlCard({
  icon,
  label,
  status,
  checked,
  onToggle,
  onEdit,
  disabled,
  error,
  hideToggle,
}) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
          <FontAwesomeIcon icon={icon} className="w-4 h-4" />
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Sửa ${label}`}
            className="w-8 h-8 -mt-1 -mr-1 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <FontAwesomeIcon icon={faPen} className="w-3 h-3" />
          </button>
        )}
      </div>

      <div>
        <p className="text-body-md font-medium text-on-surface leading-snug">{label}</p>
        <p className="text-label-sm text-outline mt-0.5">{status}</p>
        {error && <p className="text-label-sm text-error mt-0.5">{error}</p>}
      </div>

      {!hideToggle && <Switch checked={checked} onChange={onToggle} disabled={disabled} />}
    </div>
  );
}

export default QuickControlCard;
