import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const PIN_PATTERN = /^\d{4,8}$/;

function ChangePasscodeForm({ onSubmit, onCancel, isSubmitting, error }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [validationError, setValidationError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!PIN_PATTERN.test(pin)) {
      setValidationError('Mã PIN phải là 4-8 chữ số.');
      return;
    }
    if (pin !== confirmPin) {
      setValidationError('Xác nhận mã PIN không khớp.');
      return;
    }
    setValidationError(null);
    onSubmit(pin);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="newPasscode" className="text-label-md text-on-surface-variant">
          Mã PIN mới (4-8 số)
        </label>
        <input
          id="newPasscode"
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••••"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary tracking-[0.3em]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPasscode" className="text-label-md text-on-surface-variant">
          Xác nhận mã PIN
        </label>
        <input
          id="confirmPasscode"
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••••"
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/40 px-4 py-3 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary tracking-[0.3em]"
        />
      </div>

      {(validationError || error) && <p className="text-body-md text-error">{validationError || error}</p>}

      <div className="flex gap-3 mt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-outline-variant/40 text-on-surface-variant font-medium py-3 text-body-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />}
          Lưu mã PIN
        </button>
      </div>
    </form>
  );
}

export default ChangePasscodeForm;
