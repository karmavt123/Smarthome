import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDoorClosed, faClock, faUser } from '@fortawesome/free-solid-svg-icons';

const RESULT_CLASSNAMES = {
  success: 'bg-tertiary/15 text-tertiary',
  failed: 'bg-error/15 text-error',
};

const RESULT_LABEL = {
  success: 'Thành công',
  failed: 'Thất bại',
};

function IncidentDetail({ device, timeRange, failedCount, attempts, onResolve }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container-low rounded-lg p-3">
          <p className="flex items-center gap-1.5 text-label-sm text-outline">
            <FontAwesomeIcon icon={faDoorClosed} className="w-3 h-3" />
            THIẾT BỊ
          </p>
          <p className="text-body-md font-semibold text-on-surface mt-1">{device}</p>
        </div>
        <div className="bg-surface-container-low rounded-lg p-3">
          <p className="flex items-center gap-1.5 text-label-sm text-outline">
            <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
            THỜI GIAN
          </p>
          <p className="text-body-md font-semibold text-on-surface mt-1">{timeRange}</p>
        </div>
      </div>

      <p className="text-body-md text-on-surface-variant">
        Phát hiện <span className="text-error font-semibold">{failedCount} lần nhập sai mật khẩu</span> liên tiếp,
        sau đó cửa được mở thành công bằng Face ID.
      </p>

      <div className="flex flex-col gap-3">
        {attempts.map(({ id, time, icon, result, detail, snapshot }) => (
          <div key={id} className="flex items-start gap-3 border-b border-outline-variant/20 pb-3 last:border-0 last:pb-0">
            {snapshot ? (
              <div className="w-14 h-14 rounded-lg bg-surface-container-high flex flex-col items-center justify-center text-outline shrink-0 overflow-hidden">
                <FontAwesomeIcon icon={faUser} className="w-6 h-6 text-outline-variant" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg bg-surface-container-high flex items-center justify-center text-outline shrink-0">
                <FontAwesomeIcon icon={icon} className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-body-md text-on-surface">{time}</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-label-sm font-medium shrink-0 ${RESULT_CLASSNAMES[result]}`}>
                  {RESULT_LABEL[result]}
                </span>
              </div>
              <p className="text-label-sm text-outline mt-1">{detail}</p>
              {snapshot && <p className="text-label-sm text-outline mt-0.5 italic">Ảnh minh họa (mock)</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-1">
        <button
          type="button"
          onClick={onResolve}
          className="flex-1 rounded-lg bg-secondary text-on-secondary font-medium py-3 text-body-md hover:opacity-90 transition-opacity"
        >
          Đánh dấu đã xử lý
        </button>
      </div>
    </div>
  );
}

export default IncidentDetail;
