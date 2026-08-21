import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faEnvelope, faMobileScreenButton } from '@fortawesome/free-solid-svg-icons';
import { faTelegram } from '@fortawesome/free-brands-svg-icons';
import Switch from '~/components/Switch';

const CHANNELS = [
  { id: 'in_app', icon: faBell, label: 'Trong ứng dụng', description: 'Hiện trong mục Thông báo' },
  { id: 'email', icon: faEnvelope, label: 'Email', description: 'Gửi qua địa chỉ email đã đăng ký' },
  { id: 'telegram', icon: faTelegram, label: 'Telegram', description: 'Gửi qua bot Telegram đã liên kết' },
  { id: 'push', icon: faMobileScreenButton, label: 'Push', description: 'Thông báo đẩy trên điện thoại' },
];

function NotificationChannelsCard({ enabledChannels, onToggle }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4">
      <h3 className="text-body-lg font-semibold text-on-surface mb-1">Kênh nhận thông báo</h3>
      <p className="text-label-sm text-outline mb-4">Chọn cách hệ thống gửi cảnh báo đến bạn</p>

      <div className="flex flex-col divide-y divide-outline-variant/20">
        {CHANNELS.map(({ id, icon, label, description }) => (
          <div key={id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
              <FontAwesomeIcon icon={icon} className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body-md text-on-surface">{label}</p>
              <p className="text-label-sm text-outline mt-0.5">{description}</p>
            </div>
            <Switch checked={enabledChannels.includes(id)} onChange={() => onToggle(id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotificationChannelsCard;
