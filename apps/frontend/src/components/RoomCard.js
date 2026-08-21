import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function RoomCard({ icon, name, deviceCount, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-surface-container rounded-xl border border-outline-variant/30 p-4 flex items-center gap-3 text-left hover:border-secondary/50 transition-colors"
    >
      <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
        <FontAwesomeIcon icon={icon} className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-body-md font-medium text-on-surface leading-snug">{name}</p>
        <p className="text-label-sm text-outline mt-0.5">{deviceCount} thiết bị</p>
      </div>
    </button>
  );
}

export default RoomCard;
