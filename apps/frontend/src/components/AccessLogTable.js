import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';

const RESULT_CLASSNAMES = {
  success: 'bg-tertiary/15 text-tertiary',
  failed: 'bg-error/15 text-error',
};

const RESULT_LABEL = {
  success: 'Thành công',
  failed: 'Thất bại',
};

function AccessLogTable({ logs }) {
  const [range, setRange] = useState('today');

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-body-lg font-semibold text-secondary">Lịch sử truy cập</h3>
        <div className="flex items-center gap-2">
          {[
            { id: 'today', label: 'Hôm nay' },
            { id: 'week', label: 'Tuần này' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setRange(id)}
              className={`px-3 py-1.5 rounded-lg text-label-md transition-colors ${
                range === id
                  ? 'bg-surface-container-high text-on-surface'
                  : 'text-outline hover:text-on-surface-variant'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead>
            <tr className="text-label-sm text-outline tracking-wide">
              <th className="font-medium pb-3 pr-4">THỜI GIAN</th>
              <th className="font-medium pb-3 pr-4">NGƯỜI DÙNG / PHƯƠNG THỨC</th>
              <th className="font-medium pb-3 pr-4">KẾT QUẢ</th>
              <th className="font-medium pb-3 pr-4">ẢNH CHỤP</th>
              <th className="font-medium pb-3">HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {logs.map(({ id, time, date, icon, userLabel, subLabel, result, hasSnapshot }) => (
              <tr key={id}>
                <td className="py-3 pr-4 align-top">
                  <p className="text-body-md text-on-surface">{time}</p>
                  <p className="text-label-sm text-outline mt-0.5">{date}</p>
                </td>
                <td className="py-3 pr-4 align-top">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={icon} className="w-3.5 h-3.5 text-secondary shrink-0" />
                    <div>
                      <p className="text-body-md text-on-surface">{userLabel}</p>
                      <p className="text-label-sm text-outline mt-0.5">{subLabel}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 align-top">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium ${RESULT_CLASSNAMES[result]}`}
                  >
                    {RESULT_LABEL[result]}
                  </span>
                </td>
                <td className="py-3 pr-4 align-top">
                  {hasSnapshot ? (
                    <div className="w-10 h-10 rounded-md bg-surface-container-high flex items-center justify-center text-outline">
                      <FontAwesomeIcon icon={faCamera} className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <span className="text-outline">—</span>
                  )}
                </td>
                <td className="py-3 align-top">
                  <button
                    type="button"
                    aria-label="Hành động khác"
                    className="text-outline hover:text-on-surface-variant"
                  >
                    <FontAwesomeIcon icon={faEllipsisVertical} className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="w-full mt-4 text-center text-body-md text-secondary hover:underline"
      >
        Xem tất cả lịch sử
      </button>
    </div>
  );
}

export default AccessLogTable;
