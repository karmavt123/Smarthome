import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

function AddDeviceTile({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-surface-container-low rounded-xl border border-dashed border-outline-variant/40 flex flex-col items-center justify-center gap-2 p-4 min-h-[9.5rem] text-center hover:bg-surface-container-high transition-colors"
    >
      <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
        <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
      </div>
      <p className="text-body-md text-on-surface-variant">Thêm thiết bị</p>
    </button>
  );
}

export default AddDeviceTile;
