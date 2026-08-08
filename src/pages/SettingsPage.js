import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import useAuth from '~/hooks/useAuth';
import useHome from '~/hooks/useHome';
import useEnvironment from '~/hooks/useEnvironment';
import alertService from '~/services/alertService';
import environmentService from '~/services/environmentService';
import Modal from '~/components/Modal';
import AccountInfoCard from '~/components/AccountInfoCard';
import AlertRulesCard from '~/components/AlertRulesCard';
import AlertRuleForm from '~/components/AlertRuleForm';
import NotificationChannelsCard from '~/components/NotificationChannelsCard';

const SENSOR_TYPE_LABEL = { temperature: 'Nhiệt độ', humidity: 'Độ ẩm', light: 'Ánh sáng' };

function SettingsPage() {
  const { user } = useAuth();
  const { currentHomeId } = useHome();
  const { setEnvironment } = useEnvironment();

  const [rules, setRules] = useState([]);
  const [sensorOptions, setSensorOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);
  const [ruleError, setRuleError] = useState(null);

  const [enabledChannels, setEnabledChannels] = useState(['in_app', 'push']);

  const fetchData = useCallback(async () => {
    try {
      const [rulesList, environmentData] = await Promise.all([
        alertService.listRules({ home_id: currentHomeId }),
        environmentService.get(currentHomeId),
      ]);

      setEnvironment(environmentData);
      const options = Object.entries(environmentData)
        .filter(([, sensor]) => sensor?.sensorId)
        .map(([sensorType, sensor]) => ({
          sensorType,
          sensorId: sensor.sensorId,
          unit: sensor.unit,
          label: `${SENSOR_TYPE_LABEL[sensorType] || sensorType} (${sensor.unit})`,
        }));

      setSensorOptions(options);
      setRules(rulesList);
      setLoadError(null);
    } catch (err) {
      setLoadError(err?.message || 'Không thể tải dữ liệu, thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }, [currentHomeId, setEnvironment]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleRule = async (id, isActive) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, isActive } : rule)));
    try {
      await alertService.updateRule(id, { isActive });
    } catch {
      fetchData();
    }
  };

  const handleAddRule = async (data) => {
    setIsSubmittingRule(true);
    setRuleError(null);
    try {
      await alertService.createRule({ ...data, homeId: currentHomeId });
      await fetchData();
      setRuleModalOpen(false);
    } catch (err) {
      setRuleError(err?.message || 'Không thể tạo ngưỡng cảnh báo.');
    } finally {
      setIsSubmittingRule(false);
    }
  };

  const handleDeleteRule = async (id) => {
    const prevRules = rules;
    setRules((prev) => prev.filter((rule) => rule.id !== id));
    try {
      await alertService.deleteRule(id);
    } catch {
      setRules(prevRules);
    }
  };

  const toggleChannel = (id) => {
    setEnabledChannels((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-secondary animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-body-md text-error">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-headline-md font-semibold text-on-surface mb-6">Cài đặt</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <AlertRulesCard
            rules={rules}
            onToggle={handleToggleRule}
            onDelete={handleDeleteRule}
            onAdd={() => setRuleModalOpen(true)}
          />
          <NotificationChannelsCard enabledChannels={enabledChannels} onToggle={toggleChannel} />
        </div>

        <AccountInfoCard user={user} />
      </div>

      <Modal open={ruleModalOpen} onClose={() => setRuleModalOpen(false)} title="Thêm ngưỡng cảnh báo">
        <AlertRuleForm
          sensorOptions={sensorOptions}
          onSubmit={handleAddRule}
          onCancel={() => setRuleModalOpen(false)}
          isSubmitting={isSubmittingRule}
          error={ruleError}
        />
      </Modal>
    </div>
  );
}

export default SettingsPage;
