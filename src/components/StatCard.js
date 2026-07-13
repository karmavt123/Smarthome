import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Sparkline from '~/components/Sparkline';

function StatCard({ icon, label, value, unit, trend, trendClassName, chartData, chartColor }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
          <FontAwesomeIcon icon={icon} className="w-4 h-4" />
        </div>
        <span className={`text-label-sm font-medium ${trendClassName}`}>{trend}</span>
      </div>

      <p className="text-body-md text-outline mt-4">{label}</p>
      <p className="text-headline-md font-bold text-on-surface mt-1">
        {value}
        <span className="text-body-md font-normal text-outline">{unit}</span>
      </p>

      <div className="mt-2 -mx-1">
        <Sparkline data={chartData} color={chartColor} />
      </div>
    </div>
  );
}

export default StatCard;
