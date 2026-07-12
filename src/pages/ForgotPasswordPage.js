import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

function ForgotPasswordPage() {
  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <>
      <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-6">
        <p className="text-body-md text-on-surface-variant mb-5">
          Nhập email của bạn, chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="flex items-center gap-2 text-label-md text-on-surface-variant">
              <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4" />
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity"
          >
            Gửi liên kết đặt lại
          </button>
        </form>

        <Link
          to="/dang-nhap"
          className="flex items-center justify-center gap-2 text-body-md text-secondary hover:underline mt-6"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
          Quay lại đăng nhập
        </Link>
      </div>

      <div className="flex items-center justify-center gap-4 mt-6 text-label-md text-outline">
        <Link to="/bao-mat" className="hover:text-on-surface-variant">Bảo mật</Link>
        <Link to="/dieu-khoan" className="hover:text-on-surface-variant">Điều khoản</Link>
        <Link to="/ho-tro" className="hover:text-on-surface-variant">Hỗ trợ</Link>
      </div>
    </>
  );
}

export default ForgotPasswordPage;
