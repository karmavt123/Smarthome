const UNITS = [
  { limit: 60, divisor: 1, label: 'giây trước' },
  { limit: 3600, divisor: 60, label: 'phút trước' },
  { limit: 86400, divisor: 3600, label: 'giờ trước' },
  { limit: 2592000, divisor: 86400, label: 'ngày trước' },
];

function formatRelativeTime(isoDate) {
  const diffSeconds = Math.max(0, (Date.now() - new Date(isoDate).getTime()) / 1000);

  if (diffSeconds < 5) return 'Vừa xong';

  const unit = UNITS.find(({ limit }) => diffSeconds < limit);
  if (!unit) return new Date(isoDate).toLocaleDateString('vi-VN');

  return `${Math.floor(diffSeconds / unit.divisor)} ${unit.label}`;
}

export default formatRelativeTime;
