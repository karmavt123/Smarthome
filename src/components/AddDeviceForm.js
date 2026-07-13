function AddDeviceForm({ rooms, onCancel }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onCancel();
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
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        >
          <option value="light">Đèn</option>
          <option value="fan">Quạt</option>
          <option value="door">Cửa</option>
          <option value="sensor">Cảm biến</option>
        </select>
      </div>

      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-outline-variant/40 text-on-surface-variant font-medium py-3 text-body-md hover:bg-surface-container-high transition-colors"
        >
          Hủy
        </button>
        <button
          type="submit"
          className="flex-1 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity"
        >
          Thêm thiết bị
        </button>
      </div>
    </form>
  );
}

export default AddDeviceForm;
