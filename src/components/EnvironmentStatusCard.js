import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLeaf } from '@fortawesome/free-solid-svg-icons';

function EnvironmentStatusCard({ title, description }) {
  return (
    <div className="bg-surface-container rounded-xl border border-tertiary/40 shadow-[0_0_16px_rgba(78,222,163,0.12)] p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary shrink-0">
          <FontAwesomeIcon icon={faLeaf} className="w-4 h-4" />
        </div>
        <p className="text-body-lg font-semibold text-tertiary">{title}</p>
      </div>
      <p className="text-body-md text-on-surface-variant">{description}</p>
    </div>
  );
}

export default EnvironmentStatusCard;
