import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

function ConnectDeviceCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[16rem] bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant/50 flex flex-col items-center justify-center gap-3 p-6 text-center hover:bg-surface-container-high transition-colors"
    >
      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
        <FontAwesomeIcon icon={faPlus} className="w-5 h-5" />
      </div>
      <p className="text-body-lg font-semibold text-on-surface">Kết nối thiết bị</p>
    </button>
  );
}

export default ConnectDeviceCard;
