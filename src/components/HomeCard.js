import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse, faLocationDot } from '@fortawesome/free-solid-svg-icons';

function HomeCard({ name, address, gradient, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-surface-container rounded-xl border border-outline-variant/30 overflow-hidden cursor-pointer hover:border-secondary/50 transition-colors"
    >
      <div className={`relative h-44 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        <FontAwesomeIcon icon={faHouse} className="w-16 h-16 text-white/10" />
      </div>

      <div className="p-4">
        <h3 className="text-body-lg font-semibold text-on-surface">{name}</h3>
        {address && (
          <p className="flex items-center gap-1.5 text-body-md text-outline mt-1">
            <FontAwesomeIcon icon={faLocationDot} className="w-3.5 h-3.5" />
            {address}
          </p>
        )}
      </div>
    </div>
  );
}

export default HomeCard;
