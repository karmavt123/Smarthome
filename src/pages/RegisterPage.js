import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faLock, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import useAuth from '~/hooks/useAuth';

function RegisterPage() {
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await signUp({ fullName, email, password });
    } catch (err) {
      setError(err?.message || 'Tạo tài khoản thất bại, vui lòng thử lại.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <p className="text-body-md text-error bg-error/10 border border-error/30 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="fullName"
              className="flex items-center gap-2 text-label-md text-on-surface-variant"
            >
              <FontAwesomeIcon icon={faUser} className="w-4 h-4" />
              Họ và tên
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
              className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="flex items-center gap-2 text-label-md text-on-surface-variant"
            >
              <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4" />
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="flex items-center gap-2 text-label-md text-on-surface-variant"
            >
              <FontAwesomeIcon icon={faLock} className="w-4 h-4" />
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
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
            <label
              htmlFor="confirmPassword"
              className="flex items-center gap-2 text-label-md text-on-surface-variant"
            >
              <FontAwesomeIcon icon={faLock} className="w-4 h-4" />
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 pr-11 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant"
              >
                <FontAwesomeIcon
                  icon={showConfirmPassword ? faEyeSlash : faEye}
                  className="w-4 h-4"
                />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
          </button>
        </form>
      </div>

      <p className="text-center text-body-md text-outline mt-6">
        Đã có tài khoản?{' '}
        <Link to="/dang-nhap" className="text-secondary hover:underline">
          Đăng nhập ngay
        </Link>
      </p>
    </>
  );
}

export default RegisterPage;
