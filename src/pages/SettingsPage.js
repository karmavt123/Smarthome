import { useState } from 'react';
import Modal from '~/components/Modal';
import AccountInfoCard from '~/components/AccountInfoCard';
import AlertRulesCard from '~/components/AlertRulesCard';
import AlertRuleForm from '~/components/AlertRuleForm';
import NotificationChannelsCard from '~/components/NotificationChannelsCard';

const INITIAL_RULES = [
  {
    id: 1,
    name: 'Nhiệt độ Phòng khách quá cao',
    sensorType: 'temperature',
    operator: '>',
    threshold: 35,
    unit: '°C',
    severity: 'critical',
    isActive: true,
  },
  {
    id: 2,
    name: 'Độ ẩm Nhà bếp thấp',
    sensorType: 'humidity',
    operator: '<',
    threshold: 30,
    unit: '%',
    severity: 'warning',
    isActive: true,
  },
  {
    id: 3,
    name: 'Ánh sáng Sân vườn yếu ban ngày',
    sensorType: 'light',
    operator: '<',
    threshold: 100,
    unit: ' lux',
    severity: 'info',
    isActive: false,
  },
];

function SettingsPage() {
  const [rules, setRules] = useState(INITIAL_RULES);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [enabledChannels, setEnabledChannels] = useState(['in_app', 'push']);

  const toggleRule = (id) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, isActive: !rule.isActive } : rule)));
  };

  const deleteRule = (id) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const toggleChannel = (id) => {
    setEnabledChannels((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-headline-md font-semibold text-on-surface mb-6">Cài đặt</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <AlertRulesCard
            rules={rules}
            onToggle={toggleRule}
            onDelete={deleteRule}
            onAdd={() => setRuleModalOpen(true)}
          />
          <NotificationChannelsCard enabledChannels={enabledChannels} onToggle={toggleChannel} />
        </div>

        <AccountInfoCard
          initialName="Người Dùng Lumina"
          initialEmail="user@lumina.vn"
          initialPhone=""
          role="owner"
        />
      </div>

      <Modal open={ruleModalOpen} onClose={() => setRuleModalOpen(false)} title="Thêm ngưỡng cảnh báo">
        <AlertRuleForm onCancel={() => setRuleModalOpen(false)} />
      </Modal>
    </div>
  );
}

export default SettingsPage;
