import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse, faLocationDot, faSpinner } from '@fortawesome/free-solid-svg-icons';

function AddHomeForm({ onSubmit, onCancel, isSubmitting, error }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), address: address.trim() || undefined });
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
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="VD: Tây Hồ, Hà Nội"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
        />
      </div>

      {error && <p className="text-body-md text-error">{error}</p>}

      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-outline-variant/40 text-on-surface-variant font-medium py-3 text-body-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="flex-1 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />}
          Tạo ngôi nhà
        </button>
      </div>
    </form>
  );
}

export default AddHomeForm;
