function AddFaceProfileForm({ onCancel }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="profileName" className="text-label-md text-on-surface-variant">
          Tên hồ sơ
        </label>
        <input
          id="profileName"
          type="text"
          placeholder="VD: Member C"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
        />
      </div>

      <p className="text-label-sm text-outline">
        Sau khi tạo hồ sơ, hãy dùng camera cửa để quét khuôn mặt và hoàn tất đăng ký.
      </p>

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
          Tạo hồ sơ
        </button>
      </div>
    </form>
  );
}

export default AddFaceProfileForm;
