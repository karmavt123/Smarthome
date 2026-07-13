import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

function RoomTabs({ rooms, activeId, onSelect, onAdd }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {rooms.map((room) => (
        <button
          key={room.id}
          type="button"
          onClick={() => onSelect(room.id)}
          className={`shrink-0 px-4 py-2 rounded-full text-body-md border transition-colors ${
            activeId === room.id
              ? 'bg-secondary/15 border-secondary text-secondary font-medium'
              : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {room.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Thêm phòng"
        className="shrink-0 w-9 h-9 rounded-full border border-dashed border-outline-variant/40 text-outline flex items-center justify-center hover:bg-surface-container-high hover:text-on-surface-variant transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default RoomTabs;
