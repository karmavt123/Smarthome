import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

function AddHomeCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-full min-h-[19rem] bg-surface-container-low rounded-xl border border-outline-variant/30 flex flex-col items-center justify-center gap-3 p-6 text-center hover:bg-surface-container-high transition-colors"
    >
      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
        <FontAwesomeIcon icon={faPlus} className="w-5 h-5" />
      </div>
      <div>
        <p className="text-body-lg font-semibold text-on-surface">Thêm ngôi nhà mới</p>
        <p className="text-body-md text-outline mt-1">Kết nối bất động sản mới vào hệ sinh thái Lumina</p>
      </div>
    </button>
  );
}

export default AddHomeCard;
