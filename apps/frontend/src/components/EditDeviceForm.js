import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';

const INPUT_CLASS =
  'w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary';

function EditDeviceForm({ device, rooms, onSubmit, onDelete, onCancel, isSubmitting, error }) {
  const [name, setName] = useState(device.name ?? '');
  const [roomId, setRoomId] = useState(device.rooms?.id ?? '');
  // Two-step delete instead of window.confirm: a native dialog blocks the whole page
  // and, in this app, would sit on top of a modal that already traps focus.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), roomId: roomId ? Number(roomId) : null });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="editDeviceName" className="text-label-md text-on-surface-variant">
          Tên thiết bị
        </label>
        <input
          id="editDeviceName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="editDeviceRoom" className="text-label-md text-on-surface-variant">
          Phòng
        </label>
        <select
          id="editDeviceRoom"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Chưa gán phòng</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-label-md text-on-surface-variant">Mã thiết bị</p>
        {/* device_code is the device's identity on MQTT. Changing it would silently
            orphan every reading and command already tied to it, so it is read-only. */}
        <code className="text-body-md text-outline break-all">{device.deviceCode}</code>
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
          Lưu thay đổi
        </button>
      </div>

      <div className="border-t border-outline-variant/30 pt-4">
        {confirmingDelete ? (
          <div className="flex flex-col gap-3">
            <p className="text-body-md text-on-surface-variant">
              Xoá <span className="font-medium text-on-surface">{device.name}</span> khỏi hệ thống?
              Lịch sử đo và lệnh điều khiển của thiết bị sẽ không còn truy cập được.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={isSubmitting}
                className="flex-1 rounded-lg border border-outline-variant/40 text-on-surface-variant font-medium py-2.5 text-body-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
              >
                Giữ lại
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-error text-on-error font-medium py-2.5 text-body-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Xoá thiết bị
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={isSubmitting}
            className="flex items-center gap-2 text-error text-body-md hover:underline disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
            Xoá thiết bị
          </button>
        )}
      </div>
    </form>
  );
}

export default EditDeviceForm;
