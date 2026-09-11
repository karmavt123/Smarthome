import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';

function EditRoomForm({ room, deviceCount, onSubmit, onDelete, onCancel, isSubmitting, error }) {
  const [name, setName] = useState(room.name ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="editRoomName" className="text-label-md text-on-surface-variant">
          Tên phòng
        </label>
        <input
          id="editRoomName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
        />
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
              Xoá phòng <span className="font-medium text-on-surface">{room.name}</span>?
              {deviceCount > 0 && (
                <>
                  {' '}
                  {deviceCount} thiết bị trong phòng sẽ bị xoá theo — kiểm tra lại trước khi tiếp
                  tục.
                </>
              )}
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
                Xoá phòng
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
            Xoá phòng
          </button>
        )}
      </div>
    </form>
  );
}

export default EditRoomForm;
