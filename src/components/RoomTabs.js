function RoomTabs({ rooms, activeId, onSelect }) {
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
    </div>
  );
}

export default RoomTabs;
