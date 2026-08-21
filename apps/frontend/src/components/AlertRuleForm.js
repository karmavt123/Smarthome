import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const OPERATORS = [
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' },
];

function AlertRuleForm({ sensorOptions, onSubmit, onCancel, isSubmitting, error }) {
  const [name, setName] = useState('');
  const [sensorId, setSensorId] = useState(sensorOptions[0]?.sensorId ?? '');
  const [conditionOperator, setConditionOperator] = useState('gt');
  const [thresholdValue, setThresholdValue] = useState('');
  const [severity, setSeverity] = useState('warning');

  if (sensorOptions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-md text-outline">Nhà này chưa có cảm biến nào để đặt ngưỡng cảnh báo.</p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-outline-variant/40 text-on-surface-variant font-medium py-3 text-body-md hover:bg-surface-container-high transition-colors"
        >
          Đóng
        </button>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || thresholdValue === '') return;
    onSubmit({
      name: name.trim(),
      sensorId: Number(sensorId),
      conditionOperator,
      thresholdValue: Number(thresholdValue),
      severity,
    });
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Nhiệt độ Phòng khách quá cao"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="ruleSensor" className="text-label-md text-on-surface-variant">
          Cảm biến
        </label>
        <select
          id="ruleSensor"
          value={sensorId}
          onChange={(e) => setSensorId(e.target.value)}
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        >
          {sensorOptions.map((option) => (
            <option key={option.sensorId} value={option.sensorId}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="ruleOperator" className="text-label-md text-on-surface-variant">
            Toán tử
          </label>
          <select
            id="ruleOperator"
            value={conditionOperator}
            onChange={(e) => setConditionOperator(e.target.value)}
            className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
          >
            {OPERATORS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
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
            value={thresholdValue}
            onChange={(e) => setThresholdValue(e.target.value)}
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
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
        >
          <option value="info">Thông tin</option>
          <option value="warning">Cảnh báo</option>
          <option value="critical">Nghiêm trọng</option>
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
          disabled={isSubmitting || !name.trim() || thresholdValue === ''}
          className="flex-1 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />}
          Tạo ngưỡng
        </button>
      </div>
    </form>
  );
}

export default AlertRuleForm;
