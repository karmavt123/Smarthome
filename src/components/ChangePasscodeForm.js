function ChangePasscodeForm({ onCancel }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="newPasscode" className="text-label-md text-on-surface-variant">
          Mã PIN mới (6 số)
        </label>
        <input
          id="newPasscode"
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••••"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary tracking-[0.3em]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPasscode" className="text-label-md text-on-surface-variant">
          Xác nhận mã PIN
        </label>
        <input
          id="confirmPasscode"
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••••"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary tracking-[0.3em]"
        />
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
          Lưu mã PIN
        </button>
      </div>
    </form>
  );
}

export default ChangePasscodeForm;
