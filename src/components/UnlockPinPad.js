import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLock,
  faXmark,
  faDeleteLeft,
  faCircleCheck,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';

const PIN_LENGTH = 6;
const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function UnlockPinPad({ onConfirm, onCancel }) {
  const [pin, setPin] = useState('');

  const pressDigit = (digit) => {
    if (pin.length < PIN_LENGTH) setPin(pin + digit);
  };

  const backspace = () => setPin(pin.slice(0, -1));
  const clear = () => setPin('');

  const handleConfirm = () => {
    if (pin.length === PIN_LENGTH) onConfirm();
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-full bg-secondary/15 flex items-center justify-center text-secondary">
        <FontAwesomeIcon icon={faLock} className="w-5 h-5" />
      </div>

      <h2 className="text-body-lg font-semibold text-on-surface mt-1">Nhập mã PIN để mở khóa</h2>

      <div className="flex items-center gap-3 mt-5">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full border-2 ${
              i < pin.length ? 'bg-secondary border-secondary' : 'border-outline-variant/50'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6 w-full max-w-[16rem]">
        {KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => pressDigit(digit)}
            className="aspect-square rounded-xl bg-surface-container-low border border-outline-variant/30 text-headline-md font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          onClick={clear}
          aria-label="Xóa hết"
          className="aspect-square rounded-xl flex items-center justify-center text-error hover:bg-surface-container-high transition-colors"
        >
          <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => pressDigit(0)}
          className="aspect-square rounded-xl bg-surface-container-low border border-outline-variant/30 text-headline-md font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          aria-label="Xóa một số"
          className="aspect-square rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <FontAwesomeIcon icon={faDeleteLeft} className="w-5 h-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={pin.length !== PIN_LENGTH}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md mt-6 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:hover:opacity-40"
      >
        Xác nhận
        <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="text-body-md text-on-surface-variant underline mt-3"
      >
        Hủy
      </button>

      <p className="flex items-center gap-1.5 text-label-sm text-outline bg-surface-container-low rounded-full px-3 py-1.5 mt-4">
        <FontAwesomeIcon icon={faCircleInfo} className="w-3 h-3" />
        Vui lòng không chia sẻ mã PIN với người lạ
      </p>
    </div>
  );
}

export default UnlockPinPad;
