import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faApple } from '@fortawesome/free-brands-svg-icons';

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <>
      <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-6">
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="flex items-center gap-2 text-label-md text-on-surface-variant">
                <FontAwesomeIcon icon={faLock} className="w-4 h-4" />
                Mật khẩu
              </label>
              <Link to="/quen-mat-khau" className="text-label-md text-secondary hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
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

          <label className="flex items-center gap-2 text-body-md text-on-surface-variant cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded accent-secondary"
            />
            Ghi nhớ đăng nhập
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity"
          >
            Đăng nhập
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-outline-variant/30" />
          <span className="text-label-sm text-outline tracking-wide">HOẶC TIẾP TỤC VỚI</span>
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
        Bạn mới sử dụng Lumina?{' '}
        <Link to="/dang-ky" className="text-secondary hover:underline">
          Tạo tài khoản ngay
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

export default LoginPage;
