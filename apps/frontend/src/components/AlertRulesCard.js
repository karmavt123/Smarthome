import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTemperatureHalf, faDroplet, faSun, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import Switch from '~/components/Switch';

const SENSOR_ICON = {
  temperature: faTemperatureHalf,
  humidity: faDroplet,
  light: faSun,
};

// Backend stores the operator as a word code (confirmed via live API), not the
// symbol DATABASE.md describes — display the symbol, send the code.
const OPERATOR_LABEL = { gt: '>', lt: '<', gte: '>=', lte: '<=', eq: '=' };

const SEVERITY_META = {
  info: { label: 'Thông tin', className: 'bg-outline-variant/20 text-outline' },
  warning: { label: 'Cảnh báo', className: 'bg-secondary/15 text-secondary' },
  critical: { label: 'Nghiêm trọng', className: 'bg-error/15 text-error' },
};

function AlertRulesCard({ rules, onToggle, onDelete, onAdd }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-body-lg font-semibold text-on-surface">Ngưỡng cảnh báo</h3>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 text-secondary text-body-md hover:underline"
        >
          <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
          Thêm ngưỡng
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="text-body-md text-outline py-3">Chưa có ngưỡng cảnh báo nào.</p>
      ) : (
        <div className="flex flex-col divide-y divide-outline-variant/20">
          {rules.map(({ id, name, conditionOperator, thresholdValue, severity, isActive, sensors }) => (
            <div key={id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
                <FontAwesomeIcon icon={SENSOR_ICON[sensors?.sensorType] || faTemperatureHalf} className="w-4 h-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-body-md text-on-surface truncate">{name}</p>
                <p className="text-label-sm text-outline mt-0.5">
                  {OPERATOR_LABEL[conditionOperator] || conditionOperator} {thresholdValue}
                  {sensors?.unit}
                </p>
              </div>

              <span
                className={`shrink-0 px-2.5 py-1 rounded-full text-label-sm font-medium ${SEVERITY_META[severity].className}`}
              >
                {SEVERITY_META[severity].label}
              </span>

              <Switch checked={isActive} onChange={(checked) => onToggle(id, checked)} />

              <button
                type="button"
                onClick={() => onDelete(id)}
                aria-label="Xóa ngưỡng"
                className="text-outline hover:text-error shrink-0"
              >
                <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AlertRulesCard;
