import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet, faSun } from '@fortawesome/free-solid-svg-icons';

function climateLabel(temperature) {
  if (typeof temperature !== 'number') return 'Chưa có dữ liệu';
  if (temperature >= 20 && temperature <= 26) return 'Ổn định';
  if (temperature < 20) return 'Hơi lạnh';
  return 'Hơi nóng';
}

function RoomClimateCard({ roomName, temperature, humidity, light, sensorsOnline }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const humidityRatio = typeof humidity === 'number' ? humidity / 100 : 0;
  const offset = circumference * (1 - humidityRatio);

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4 flex flex-col items-center text-center h-full">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#1c2b3c" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#7bd0ff"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-headline-md font-bold text-on-surface">
            {typeof temperature === 'number' ? `${temperature}°` : '--'}
          </p>
        </div>
      </div>

      <p
        className={`text-label-md font-medium mt-2 ${
          typeof temperature === 'number' ? 'text-tertiary' : 'text-outline'
        }`}
      >
        {climateLabel(temperature)}
      </p>
      <p className="text-body-md font-semibold text-on-surface mt-3">{roomName}</p>
      <p className="text-label-sm text-outline mt-0.5">Cảm biến online: {sensorsOnline}</p>

      <div className="grid grid-cols-2 gap-3 w-full mt-4 pt-4 border-t border-outline-variant/20">
        <div className="text-left">
          <p className="flex items-center gap-1.5 text-label-sm text-outline">
            <FontAwesomeIcon icon={faDroplet} className="w-3 h-3" />
            ĐỘ ẨM
          </p>
          <p className="text-body-lg font-semibold text-on-surface mt-1">
            {typeof humidity === 'number' ? `${humidity}%` : '--'}
          </p>
        </div>
        <div className="text-left">
          <p className="flex items-center gap-1.5 text-label-sm text-outline">
            <FontAwesomeIcon icon={faSun} className="w-3 h-3" />
            ÁNH SÁNG
          </p>
          <p className="text-body-lg font-semibold text-on-surface mt-1">
            {typeof light === 'number' ? `${light} lux` : '--'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default RoomClimateCard;
