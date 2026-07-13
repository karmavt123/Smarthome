const OPERATORS = ['>', '<', '>=', '<=', '='];

function AlertRuleForm({ onCancel }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="ruleName" className="text-label-md text-on-surface-variant">
          Tên ngưỡng cảnh báo
        </label>
        <input
          id="ruleName"
          type="text"
          placeholder="VD: Nhiệt độ Phòng khách quá cao"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="ruleSensor" className="text-label-md text-on-surface-variant">
          Loại cảm biến
        </label>
        <select
          id="ruleSensor"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        >
          <option value="temperature">Nhiệt độ</option>
          <option value="humidity">Độ ẩm</option>
          <option value="light">Ánh sáng</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="ruleOperator" className="text-label-md text-on-surface-variant">
            Toán tử
          </label>
          <select
            id="ruleOperator"
            className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="ruleThreshold" className="text-label-md text-on-surface-variant">
            Ngưỡng
          </label>
          <input
            id="ruleThreshold"
            type="number"
            step="0.1"
            placeholder="VD: 35"
            className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="ruleSeverity" className="text-label-md text-on-surface-variant">
          Mức độ nghiêm trọng
        </label>
        <select
          id="ruleSeverity"
          defaultValue="warning"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        >
          <option value="info">Thông tin</option>
          <option value="warning">Cảnh báo</option>
          <option value="critical">Nghiêm trọng</option>
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
          Tạo ngưỡng
        </button>
      </div>
    </form>
  );
}

export default AlertRuleForm;
