import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleUser, faPlus, faChevronRight } from '@fortawesome/free-solid-svg-icons';

function FaceProfilesCard({ profiles, onAdd }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body-lg font-semibold text-on-surface">Nhận diện khuôn mặt</h3>
        <Link to="/an-ninh" className="flex items-center gap-1 text-label-md text-secondary hover:underline">
          Quản lý
          <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {profiles.map(({ id, name, role }) => (
          <div key={id} className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
              <FontAwesomeIcon icon={faCircleUser} className="w-7 h-7" />
            </div>
            <p className="text-label-md text-on-surface mt-2 truncate w-full">{name}</p>
            <p className="text-label-sm text-tertiary">{role === 'owner' ? 'Chủ nhà' : 'Đang hoạt động'}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant/40 text-on-surface-variant text-body-md py-2.5 hover:bg-surface-container-high transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
        Thêm hồ sơ
      </button>
    </div>
  );
}

export default FaceProfilesCard;
