import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse, faLocationDot } from '@fortawesome/free-solid-svg-icons';

function AddHomeForm({ onCancel }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="homeName" className="flex items-center gap-2 text-label-md text-on-surface-variant">
          <FontAwesomeIcon icon={faHouse} className="w-4 h-4" />
          Tên ngôi nhà
        </label>
        <input
          id="homeName"
          type="text"
          placeholder="VD: Nhà riêng - Hà Nội"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="homeAddress" className="flex items-center gap-2 text-label-md text-on-surface-variant">
          <FontAwesomeIcon icon={faLocationDot} className="w-4 h-4" />
          Địa chỉ
        </label>
        <input
          id="homeAddress"
          type="text"
          placeholder="VD: Tây Hồ, Hà Nội"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
        />
      </div>

      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-outline-variant/40 text-on-surface-variant font-medium py-3 text-body-md hover:bg-surface-container-high transition-colors"
        >
          Hủy
        </button>
        <button
          type="submit"
          className="flex-1 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity"
        >
          Tạo ngôi nhà
        </button>
      </div>
    </form>
  );
}

export default AddHomeForm;
