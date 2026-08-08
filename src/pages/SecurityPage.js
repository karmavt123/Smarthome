import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import useHome from '~/hooks/useHome';
import useDeviceCommand from '~/hooks/useDeviceCommand';
import useDevices from '~/hooks/useDevices';
import dashboardService from '~/services/dashboardService';
import deviceService from '~/services/deviceService';
import faceProfileService from '~/services/faceProfileService';
import doorAccessService from '~/services/doorAccessService';
import alertService from '~/services/alertService';
import { isDeviceOn } from '~/utils/deviceStatus';
import Modal from '~/components/Modal';
import SecurityAlertBanner from '~/components/SecurityAlertBanner';
import DoorAccessHistoryCard from '~/components/DoorAccessHistoryCard';
import DoorLockCard from '~/components/DoorLockCard';
import FaceProfilesCard from '~/components/FaceProfilesCard';
import AddFaceProfileForm from '~/components/AddFaceProfileForm';
import PasscodeCard from '~/components/PasscodeCard';
import ChangePasscodeForm from '~/components/ChangePasscodeForm';
import UnlockPinPad from '~/components/UnlockPinPad';
import UnlockFaceId from '~/components/UnlockFaceId';

const REFRESH_INTERVAL_MS = 5000;
const HISTORY_PAGE_SIZE = 10;

function SecurityPage() {
  const { currentHomeId } = useHome();
  const { toggle, getOptimisticAction } = useDeviceCommand();
  const { setDevices, upsertDevice, getDeviceById } = useDevices();

  const [dashboard, setDashboard] = useState(null);
  const [doorDeviceId, setDoorDeviceId] = useState(null);
  const [faceProfiles, setFaceProfiles] = useState([]);
  const [hasPin, setHasPin] = useState(null);
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

  const [activeHistoryTab, setActiveHistoryTab] = useState('face');
  const [faceHistory, setFaceHistory] = useState([]);
  const [facePage, setFacePage] = useState(1);
  const [faceTotalPages, setFaceTotalPages] = useState(1);
  const [pinHistory, setPinHistory] = useState([]);
  const [pinPage, setPinPage] = useState(1);
  const [pinTotalPages, setPinTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      const [dashboardData, profiles, doorsRes] = await Promise.all([
        dashboardService.get(currentHomeId),
        faceProfileService.getAll(currentHomeId),
        deviceService.getAll({ home_id: currentHomeId, deviceType: 'door' }),
      ]);
      setDashboard(dashboardData);
      setFaceProfiles(profiles);

      setDevices(dashboardData.devices);
      const doors = Array.isArray(doorsRes) ? doorsRes : doorsRes.data;
      const door = doors[0] || null;
      if (door) upsertDevice(door);
      setDoorDeviceId(door?.id ?? null);
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
  }, [currentHomeId, setDevices, upsertDevice]);

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

  const doorDevice = getDeviceById(doorDeviceId);

  const fetchHistory = useCallback(
    async (method) => {
      if (!doorDeviceId) return;
      const isFace = method === 'face';
      const getHistory = isFace ? doorAccessService.getFaceHistory : doorAccessService.getPinHistory;
      const page = isFace ? facePage : pinPage;
      try {
        const res = await getHistory({ doorDeviceId, page, limit: HISTORY_PAGE_SIZE });
        const totalPages = res.meta.totalPages ?? res.meta.total_pages;
        if (isFace) {
          setFaceHistory(res.data);
          setFaceTotalPages(totalPages);
        } else {
          setPinHistory(res.data);
          setPinTotalPages(totalPages);
        }
      } catch {
        // history is supplementary — leave the previously loaded page on screen
      }
    },
    [doorDeviceId, facePage, pinPage]
  );

  useEffect(() => {
    fetchHistory(activeHistoryTab);
  }, [activeHistoryTab, fetchHistory]);

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
    fetchHistory('face');
    fetchHistory('pin');
    setTimeout(() => {
      fetchData();
      fetchHistory('face');
      fetchHistory('pin');
    }, 1500);
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

      <DoorAccessHistoryCard
        activeTab={activeHistoryTab}
        onTabChange={setActiveHistoryTab}
        history={activeHistoryTab === 'face' ? faceHistory : pinHistory}
        page={activeHistoryTab === 'face' ? facePage : pinPage}
        totalPages={activeHistoryTab === 'face' ? faceTotalPages : pinTotalPages}
        onPrevPage={() =>
          activeHistoryTab === 'face'
            ? setFacePage((p) => Math.max(1, p - 1))
            : setPinPage((p) => Math.max(1, p - 1))
        }
        onNextPage={() =>
          activeHistoryTab === 'face'
            ? setFacePage((p) => Math.min(faceTotalPages, p + 1))
            : setPinPage((p) => Math.min(pinTotalPages, p + 1))
        }
      />

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
            Cửa cần có mã PIN dự phòng trước khi dùng được Face ID/PIN mở khóa.
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
