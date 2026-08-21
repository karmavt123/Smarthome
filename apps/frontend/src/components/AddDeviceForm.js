import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const DEVICE_TYPE_OPTIONS = [
  { value: 'light', label: 'Đèn' },
  { value: 'fan', label: 'Quạt' },
  { value: 'door', label: 'Cửa' },
  { value: 'sensor', label: 'Cảm biến' },
];

function AddDeviceForm({ rooms, onSubmit, onCancel, isSubmitting, error }) {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [deviceType, setDeviceType] = useState('light');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), roomId: roomId ? Number(roomId) : undefined, deviceType });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="deviceName" className="text-label-md text-on-surface-variant">
          Tên thiết bị
        </label>
        <input
          id="deviceName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Đèn Bàn Làm Việc"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="deviceRoom" className="text-label-md text-on-surface-variant">
          Phòng
        </label>
        <select
          id="deviceRoom"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="deviceType" className="text-label-md text-on-surface-variant">
          Loại thiết bị
        </label>
        <select
          id="deviceType"
          value={deviceType}
          onChange={(e) => setDeviceType(e.target.value)}
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        >
          {DEVICE_TYPE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-body-md text-error">{error}</p>}

      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-outline-variant/40 text-on-surface-variant font-medium py-3 text-body-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="flex-1 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />}
          Thêm thiết bị
        </button>
      </div>
    </form>
  );
}

export default AddDeviceForm;
