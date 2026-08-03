import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import formatRelativeTime from '~/utils/formatRelativeTime';
import Modal from '~/components/Modal';

const TABS = [
  { id: 'face', label: 'Face ID' },
  { id: 'pin', label: 'PIN' },
];

function DoorAccessHistoryCard({ activeTab, onTabChange, history, page = 1, totalPages = 1, onPrevPage, onNextPage }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body-lg font-semibold text-on-surface">Lịch sử mở cửa</h3>
        <div className="flex items-center gap-1 bg-surface-container-high rounded-lg p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1 rounded-md text-label-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-secondary/20 text-secondary'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col divide-y divide-outline-variant/20">
        {history.length === 0 && <p className="text-body-md text-outline py-2">Chưa có lượt mở cửa nào.</p>}
        {history.map((entry) => {
          const isSuccess = entry.result === 'success';
          const isFace = entry.accessMethod === 'face';
          const successLabel = isFace ? entry.faceProfiles?.name || 'Không xác định' : 'Mở bằng mã PIN';
          return (
            <div key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isSuccess ? 'bg-tertiary/15 text-tertiary' : 'bg-error/15 text-error'
                }`}
              >
                <FontAwesomeIcon icon={isSuccess ? faCheck : faXmark} className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body-md text-on-surface leading-snug">
                  {isSuccess ? successLabel : 'Xác thực thất bại'}
                </p>
                <p className="text-label-sm text-outline mt-1">
                  {formatRelativeTime(entry.createdAt)}
                  {entry.devices?.name ? ` • ${entry.devices.name}` : ''}
                  {isSuccess && isFace && entry.confidenceScore != null
                    ? ` • ${Math.round(entry.confidenceScore * 100)}%`
                    : ''}
                  {!isSuccess && entry.failureReason ? ` • ${entry.failureReason}` : ''}
                </p>
              </div>
              {entry.snapshotUrl && (
                <button type="button" onClick={() => setPreviewUrl(entry.snapshotUrl)} className="shrink-0">
                  <img
                    src={entry.snapshotUrl}
                    alt="Ảnh chụp lúc quét"
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/30">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={page <= 1}
            className="w-7 h-7 rounded-full flex items-center justify-center text-outline hover:text-on-surface disabled:opacity-30 disabled:hover:text-outline"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
          </button>
          <span className="text-label-sm text-outline">
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={page >= totalPages}
            className="w-7 h-7 rounded-full flex items-center justify-center text-outline hover:text-on-surface disabled:opacity-30 disabled:hover:text-outline"
          >
            <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
          </button>
        </div>
      )}

      <Modal open={!!previewUrl} onClose={() => setPreviewUrl(null)}>
        <img src={previewUrl} alt="Ảnh chụp lúc quét" className="w-full rounded-lg" />
      </Modal>
    </div>
  );
}

export default DoorAccessHistoryCard;
