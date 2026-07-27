import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import useHome from '~/hooks/useHome';
import useDeviceCommand from '~/hooks/useDeviceCommand';
import dashboardService from '~/services/dashboardService';
import faceProfileService from '~/services/faceProfileService';
import doorAccessService from '~/services/doorAccessService';
import alertService from '~/services/alertService';
import { isDeviceOn } from '~/utils/deviceStatus';
import Modal from '~/components/Modal';
import SecurityAlertBanner from '~/components/SecurityAlertBanner';
import DoorLockCard from '~/components/DoorLockCard';
import FaceProfilesCard from '~/components/FaceProfilesCard';
import AddFaceProfileForm from '~/components/AddFaceProfileForm';
import PasscodeCard from '~/components/PasscodeCard';
import ChangePasscodeForm from '~/components/ChangePasscodeForm';
import UnlockPinPad from '~/components/UnlockPinPad';
import UnlockFaceId from '~/components/UnlockFaceId';

const REFRESH_INTERVAL_MS = 5000;

function SecurityPage() {
  const { currentHomeId } = useHome();
  const { toggle, getOptimisticAction } = useDeviceCommand();

  const [dashboard, setDashboard] = useState(null);
  const [faceProfiles, setFaceProfiles] = useState([]);
  const [hasPin, setHasPin] = useState(null); // null = not checked yet
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false);
  const [isSubmittingPasscode, setIsSubmittingPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState(null);

  const [pinPadOpen, setPinPadOpen] = useState(false);
  const [faceIdOpen, setFaceIdOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [dashboardData, profiles] = await Promise.all([
        dashboardService.get(currentHomeId),
        faceProfileService.getAll(currentHomeId),
      ]);
      setDashboard(dashboardData);
      setFaceProfiles(profiles);

      const door = dashboardData.devices.find((d) => d.deviceType === 'door');
      if (door) {
        const pinStatus = await doorAccessService.getPinStatus(door.id);
        setHasPin(pinStatus.hasPin);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err?.message || 'Không thể tải dữ liệu, thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }, [currentHomeId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Door unlock (PIN or Face ID) always needs a PIN fallback available — Face ID
  // locks itself out for 5 minutes after 3 failed attempts, so without a PIN
  // already set the user could lock themselves out of the door entirely.
  useEffect(() => {
    if (hasPin === false) setPasscodeModalOpen(true);
  }, [hasPin]);

  const handleAddFaceProfile = async ({ name, imageBlob }) => {
    setIsSubmittingProfile(true);
    setProfileError(null);
    try {
      const formData = new FormData();
      formData.append('homeId', currentHomeId);
      formData.append('name', name);
      formData.append('image', imageBlob, 'face.jpg');
      await faceProfileService.create(formData);
      await fetchData();
      setProfileModalOpen(false);
    } catch (err) {
      setProfileError(err?.message || 'Không thể tạo hồ sơ.');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handleDeleteFaceProfile = async (id) => {
    const prevProfiles = faceProfiles;
    setFaceProfiles((prev) => prev.filter((profile) => profile.id !== id));
    try {
      await faceProfileService.delete(id);
    } catch {
      setFaceProfiles(prevProfiles);
    }
  };

  const handleSetPasscode = async (pin, doorDeviceId) => {
    setIsSubmittingPasscode(true);
    setPasscodeError(null);
    try {
      await doorAccessService.setPin(doorDeviceId, pin);
      setHasPin(true);
      setPasscodeModalOpen(false);
    } catch (err) {
      setPasscodeError(err?.message || 'Không thể lưu mã PIN.');
    } finally {
      setIsSubmittingPasscode(false);
    }
  };

  const handleUnlockSuccess = () => {
    setPinPadOpen(false);
    setFaceIdOpen(false);
    fetchData();
    setTimeout(fetchData, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-secondary animate-spin" />
      </div>
    );
  }

  if (loadError && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-body-md text-error">{loadError}</p>
      </div>
    );
  }

  const doorDevice = dashboard.devices.find((d) => d.deviceType === 'door');
  const optimisticAction = doorDevice ? getOptimisticAction(doorDevice.id) : undefined;
  const isLocked = doorDevice ? !isDeviceOn(doorDevice, optimisticAction) : true;

  const activeIncident = dashboard.alerts.find(
    (alert) => alert.alertType === 'unauthorized_access' && alert.status !== 'resolved'
  );

  const handleResolveIncident = async () => {
    try {
      await alertService.updateAlert(activeIncident.id, { status: 'resolved' });
      fetchData();
    } catch {
      // banner just stays until the next refresh confirms either way
    }
  };

  const handleLockAgain = () => {
    if (!doorDevice) return;
    toggle(doorDevice.id, 'close', { onSettled: fetchData });
  };

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6">
      {activeIncident && (
        <SecurityAlertBanner
          title={activeIncident.title}
          message={activeIncident.message}
          onCheck={handleResolveIncident}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {doorDevice ? (
            <DoorLockCard
              name={doorDevice.name}
              locked={isLocked}
              online={doorDevice.connectionStatus === 'online'}
              onUnlockPin={() => hasPin && setPinPadOpen(true)}
              onUnlockFace={() => hasPin && setFaceIdOpen(true)}
              onLock={handleLockAgain}
            />
          ) : (
            <p className="text-body-md text-outline">Nhà này chưa có thiết bị cửa nào.</p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <FaceProfilesCard
            profiles={faceProfiles}
            onAdd={() => setProfileModalOpen(true)}
            onDelete={handleDeleteFaceProfile}
          />
          <PasscodeCard onEdit={() => setPasscodeModalOpen(true)} />
        </div>
      </div>

      <Modal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title="Thêm hồ sơ khuôn mặt"
      >
        <AddFaceProfileForm
          onSubmit={handleAddFaceProfile}
          onCancel={() => setProfileModalOpen(false)}
          isSubmitting={isSubmittingProfile}
          error={profileError}
        />
      </Modal>

      <Modal
        open={passcodeModalOpen}
        onClose={() => setPasscodeModalOpen(false)}
        title={hasPin === false ? 'Cần đặt mã PIN trước khi dùng cửa' : 'Đổi mã PIN'}
        dismissable={hasPin !== false}
      >
        {hasPin === false && (
          <p className="text-body-md text-outline-variant mb-4">
            Cửa cần có mã PIN dự phòng trước khi dùng được Face ID/PIN mở khóa — tránh trường hợp Face ID bị
            khóa 5 phút do sai nhiều lần mà không còn cách nào mở cửa.
          </p>
        )}
        <ChangePasscodeForm
          onSubmit={(pin) => handleSetPasscode(pin, doorDevice?.id)}
          onCancel={hasPin === false ? undefined : () => setPasscodeModalOpen(false)}
          isSubmitting={isSubmittingPasscode}
          error={passcodeError}
        />
      </Modal>

      {doorDevice && (
        <>
          <Modal open={pinPadOpen} onClose={() => setPinPadOpen(false)}>
            <UnlockPinPad
              doorDeviceId={doorDevice.id}
              onSuccess={handleUnlockSuccess}
              onCancel={() => setPinPadOpen(false)}
            />
          </Modal>

          <Modal open={faceIdOpen} onClose={() => setFaceIdOpen(false)}>
            <UnlockFaceId
              doorDeviceId={doorDevice.id}
              onSuccess={handleUnlockSuccess}
              onCancel={() => setFaceIdOpen(false)}
              onSwitchToPin={() => {
                setFaceIdOpen(false);
                setPinPadOpen(true);
              }}
            />
          </Modal>
        </>
      )}
    </div>
  );
}

export default SecurityPage;
