import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Switch from '~/components/Switch';

function QuickControlCard({ icon, label, status, checked, onToggle, disabled, error }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4 flex flex-col gap-3">
      <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
        <FontAwesomeIcon icon={icon} className="w-4 h-4" />
      </div>

      <div>
        <p className="text-body-md font-medium text-on-surface leading-snug">{label}</p>
        <p className="text-label-sm text-outline mt-0.5">{status}</p>
        {error && <p className="text-label-sm text-error mt-0.5">{error}</p>}
      </div>

      <Switch checked={checked} onChange={onToggle} disabled={disabled} />
    </div>
  );
}

export default QuickControlCard;
