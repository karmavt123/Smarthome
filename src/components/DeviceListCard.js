import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function DeviceListCard({ devices }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <h3 className="text-body-lg font-semibold text-on-surface mb-3">Thiết bị</h3>

      <div className="flex flex-col divide-y divide-outline-variant/20">
        {devices.map(({ id, icon, name, room, statusLabel, online }) => (
          <div key={id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
              <FontAwesomeIcon icon={icon} className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body-md text-on-surface truncate">{name}</p>
              <p className="text-label-sm text-outline mt-0.5 truncate">{room}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-tertiary' : 'bg-outline'}`} />
              <span className="text-label-sm text-outline">{statusLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeviceListCard;
