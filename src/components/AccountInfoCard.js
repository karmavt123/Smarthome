import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleUser } from '@fortawesome/free-solid-svg-icons';

const ROLE_LABEL = { admin: 'Quản trị viên', user: 'Người dùng' };

function AccountInfoCard({ user }) {
  const [name, setName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <h3 className="text-body-lg font-semibold text-on-surface mb-4">Thông tin tài khoản</h3>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
          <FontAwesomeIcon icon={faCircleUser} className="w-7 h-7" />
        </div>
        <div>
          <p className="text-body-md font-medium text-on-surface">{name}</p>
          <p className="text-label-sm text-tertiary mt-0.5">{ROLE_LABEL[user.role] || user.role}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="accountName" className="text-label-md text-on-surface-variant">
            Họ và tên
          </label>
          <input
            id="accountName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="accountEmail" className="text-label-md text-on-surface-variant">
            Email
          </label>
          <input
            id="accountEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-secondary"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="accountPhone" className="text-label-md text-on-surface-variant">
            Số điện thoại
          </label>
          <input
            id="accountPhone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Chưa cập nhật"
            className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
          />
        </div>

        <button
          type="submit"
          disabled
          title="Backend chưa có endpoint cập nhật hồ sơ"
          className="self-start rounded-lg bg-secondary text-on-secondary font-medium px-5 py-2.5 text-body-md opacity-50 cursor-not-allowed"
        >
          Lưu thay đổi
        </button>
      </form>
    </div>
  );
}

export default AccountInfoCard;
