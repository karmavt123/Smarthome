import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFaceSmile, faUser, faCircleCheck } from '@fortawesome/free-solid-svg-icons';

function UnlockFaceId({ onConfirm, onCancel }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary">
        <FontAwesomeIcon icon={faFaceSmile} className="w-5 h-5" />
      </div>

      <h2 className="text-body-lg font-semibold text-on-surface mt-1">Quét khuôn mặt để mở khóa</h2>

      <div className="relative w-40 h-40 mt-6">
        <div className="absolute inset-0 rounded-full border-4 border-tertiary/20" />
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            animationDuration: '2s',
            background: 'conic-gradient(from 0deg, transparent 0%, transparent 75%, #4edea3 100%)',
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
          }}
        />
        <div className="absolute inset-[6px] rounded-full bg-tertiary/10 flex items-center justify-center">
          <FontAwesomeIcon icon={faUser} className="w-16 h-16 text-tertiary" />
        </div>
      </div>

      <p className="text-label-md text-tertiary font-medium mt-3">Đang tìm khuôn mặt...</p>

      <button
        type="button"
        onClick={onConfirm}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md mt-6 hover:opacity-90 transition-opacity"
      >
        Xác nhận khuôn mặt
        <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="text-body-md text-on-surface-variant underline mt-3"
      >
        Hủy
      </button>
    </div>
  );
}

export default UnlockFaceId;
