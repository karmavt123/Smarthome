import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faLockOpen, faKeyboard, faFaceSmile } from '@fortawesome/free-solid-svg-icons';

function DoorLockCard({ name, locked, onUnlockPin, onUnlockFace, onLock }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-6 flex flex-col items-center text-center h-full">
      <div className="relative w-36 h-36">
        <div
          className={`absolute inset-0 rounded-full border-4 ${
            locked ? 'border-secondary/20' : 'border-tertiary/20'
          }`}
        />
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            animationDuration: '3s',
            background: `conic-gradient(from 0deg, transparent 0%, transparent 75%, ${
              locked ? '#7bd0ff' : '#4edea3'
            } 100%)`,
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
          }}
        />
        <div
          className={`absolute inset-[6px] rounded-full flex items-center justify-center ${
            locked ? 'bg-secondary/10' : 'bg-tertiary/10'
          }`}
        >
          <FontAwesomeIcon
            icon={locked ? faLock : faLockOpen}
            className={`w-14 h-14 ${locked ? 'text-secondary' : 'text-tertiary'}`}
          />
        </div>
      </div>

      <p className="text-body-lg font-semibold text-on-surface mt-4">{name}</p>
      <p
        className={`text-label-md font-medium tracking-wide mt-1 ${locked ? 'text-secondary' : 'text-tertiary'}`}
      >
        {locked ? 'ĐANG KHÓA' : 'ĐANG MỞ'}
      </p>

      {locked ? (
        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={onUnlockPin}
            className="flex items-center gap-2 rounded-lg bg-secondary text-on-secondary font-medium px-4 py-2.5 text-body-md hover:opacity-90 transition-opacity"
          >
            <FontAwesomeIcon icon={faKeyboard} className="w-4 h-4" />
            Mở bằng PIN
          </button>
          <button
            type="button"
            onClick={onUnlockFace}
            className="flex items-center gap-2 rounded-lg border border-secondary/50 text-secondary font-medium px-4 py-2.5 text-body-md hover:bg-secondary/10 transition-colors"
          >
            <FontAwesomeIcon icon={faFaceSmile} className="w-4 h-4" />
            Mở bằng Face ID
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onLock}
          className="mt-4 rounded-lg bg-secondary text-on-secondary font-medium px-5 py-2.5 text-body-md hover:opacity-90 transition-opacity"
        >
          Khóa lại
        </button>
      )}
    </div>
  );
}

export default DoorLockCard;
