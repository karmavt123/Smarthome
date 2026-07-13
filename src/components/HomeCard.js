import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse, faLocationDot } from '@fortawesome/free-solid-svg-icons';

const STATUS_LABEL = {
  safe: 'An toàn',
  locked: 'Đang khóa',
};

function HomeCard({ name, location, deviceCount, status, tags, gradient, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-surface-container rounded-xl border border-outline-variant/30 overflow-hidden cursor-pointer hover:border-secondary/50 transition-colors"
    >
      <div className={`relative h-44 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        <FontAwesomeIcon icon={faHouse} className="w-16 h-16 text-white/10" />
        <span
          className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-medium bg-black/40 backdrop-blur-sm ${
            status === 'safe' ? 'text-tertiary' : 'text-secondary'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-body-lg font-semibold text-on-surface">{name}</h3>
          <div className="text-right shrink-0">
            <p className="text-body-lg font-semibold text-on-surface leading-tight">{deviceCount}</p>
            <p className="text-label-sm text-outline tracking-wide">THIẾT BỊ</p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-body-md text-outline mt-1">
          <FontAwesomeIcon icon={faLocationDot} className="w-3.5 h-3.5" />
          {location}
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-md bg-surface-container-high text-label-sm text-on-surface-variant"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HomeCard;
