import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faLock, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faApple } from '@fortawesome/free-brands-svg-icons';

function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <>
      <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="fullName" className="flex items-center gap-2 text-label-md text-on-surface-variant">
              <FontAwesomeIcon icon={faUser} className="w-4 h-4" />
              Họ và tên
            </label>
            <input
              id="fullName"
              type="text"
              placeholder="Nguyễn Văn A"
              className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
            />
          </div>

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

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="flex items-center gap-2 text-label-md text-on-surface-variant">
              <FontAwesomeIcon icon={faLock} className="w-4 h-4" />
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 pr-11 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant"
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="flex items-center gap-2 text-label-md text-on-surface-variant">
              <FontAwesomeIcon icon={faLock} className="w-4 h-4" />
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 pr-11 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant"
              >
                <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} className="w-4 h-4" />
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 text-body-md text-on-surface-variant cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded accent-secondary"
            />
            <span>
              Tôi đồng ý với{' '}
              <Link to="/dieu-khoan" className="text-secondary hover:underline">
                Điều khoản
              </Link>{' '}
              và{' '}
              <Link to="/bao-mat" className="text-secondary hover:underline">
                Chính sách bảo mật
              </Link>
            </span>
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity"
          >
            Tạo tài khoản
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-outline-variant/30" />
          <span className="text-label-sm text-outline tracking-wide">HOẶC ĐĂNG KÝ VỚI</span>
          <div className="flex-1 h-px bg-outline-variant/30" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <FontAwesomeIcon icon={faGoogle} className="w-4 h-4" style={{ color: '#4285F4' }} />
            Google
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <FontAwesomeIcon icon={faApple} className="w-4 h-4" />
            Apple
          </button>
        </div>
      </div>

      <p className="text-center text-body-md text-outline mt-6">
        Đã có tài khoản?{' '}
        <Link to="/dang-nhap" className="text-secondary hover:underline">
          Đăng nhập ngay
        </Link>
      </p>

      <div className="flex items-center justify-center gap-4 mt-4 text-label-md text-outline">
        <Link to="/bao-mat" className="hover:text-on-surface-variant">Bảo mật</Link>
        <Link to="/dieu-khoan" className="hover:text-on-surface-variant">Điều khoản</Link>
        <Link to="/ho-tro" className="hover:text-on-surface-variant">Hỗ trợ</Link>
      </div>
    </>
  );
}

export default RegisterPage;
