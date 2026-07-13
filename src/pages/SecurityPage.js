import { useState } from 'react';
import { faFaceSmile, faKeyboard, faKey } from '@fortawesome/free-solid-svg-icons';
import Modal from '~/components/Modal';
import SecurityAlertBanner from '~/components/SecurityAlertBanner';
import DoorLockCard from '~/components/DoorLockCard';
import FaceProfilesCard from '~/components/FaceProfilesCard';
import AddFaceProfileForm from '~/components/AddFaceProfileForm';
import PasscodeCard from '~/components/PasscodeCard';
import ChangePasscodeForm from '~/components/ChangePasscodeForm';
import AccessLogTable from '~/components/AccessLogTable';
import IncidentDetail from '~/components/IncidentDetail';
import UnlockPinPad from '~/components/UnlockPinPad';
import UnlockFaceId from '~/components/UnlockFaceId';

const FACE_PROFILES = [
  { id: 1, name: 'Owner', role: 'owner' },
  { id: 2, name: 'Member A', role: 'member' },
  { id: 3, name: 'Member B', role: 'member' },
];

const ACCESS_LOGS = [
  {
    id: 1,
    time: '14:55:22',
    date: '02 Th10, 2023',
    icon: faFaceSmile,
    userLabel: 'Face ID - Owner',
    subLabel: 'ID: #001',
    result: 'success',
    hasSnapshot: true,
  },
  {
    id: 2,
    time: '14:32:01',
    date: '02 Th10, 2023',
    icon: faKeyboard,
    userLabel: 'Mật khẩu - Không xác định',
    subLabel: 'Sai 3 lần',
    result: 'failed',
    hasSnapshot: true,
  },
  {
    id: 3,
    time: '12:10:45',
    date: '02 Th10, 2023',
    icon: faKey,
    userLabel: 'Chìa khóa',
    subLabel: 'Thủ công',
    result: 'success',
    hasSnapshot: false,
  },
];

const INCIDENT_ATTEMPTS = [
  {
    id: 1,
    time: '14:32:01',
    icon: faKeyboard,
    result: 'failed',
    detail: 'Sai mật khẩu (lần 1/3)',
    snapshot: false,
  },
  {
    id: 2,
    time: '14:32:18',
    icon: faKeyboard,
    result: 'failed',
    detail: 'Sai mật khẩu (lần 2/3)',
    snapshot: false,
  },
  {
    id: 3,
    time: '14:32:34',
    icon: faKeyboard,
    result: 'failed',
    detail: 'Sai mật khẩu (lần 3/3) — hệ thống tạm khóa bàn phím 5 phút',
    snapshot: false,
  },
  {
    id: 4,
    time: '14:55:22',
    icon: faFaceSmile,
    result: 'success',
    detail: 'Face ID xác thực thành công - Owner (độ tin cậy 98%)',
    snapshot: true,
  },
];

function SecurityPage() {
  const [locked, setLocked] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentResolved, setIncidentResolved] = useState(false);
  const [pinPadOpen, setPinPadOpen] = useState(false);
  const [faceIdOpen, setFaceIdOpen] = useState(false);

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6">
      {!incidentResolved && (
        <SecurityAlertBanner
          title="Truy cập trái phép được phát hiện"
          message="Phát hiện nỗ lực nhập sai mật khẩu 3 lần tại Cửa chính (14:32)."
          onCheck={() => setIncidentModalOpen(true)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DoorLockCard
            name="Khóa cửa chính"
            locked={locked}
            online
            onUnlockPin={() => setPinPadOpen(true)}
            onUnlockFace={() => setFaceIdOpen(true)}
            onLock={() => setLocked(true)}
          />
        </div>

        <div className="flex flex-col gap-6">
          <FaceProfilesCard profiles={FACE_PROFILES} onAdd={() => setProfileModalOpen(true)} />
          <PasscodeCard active onEdit={() => setPasscodeModalOpen(true)} />
        </div>
      </div>

      <AccessLogTable logs={ACCESS_LOGS} />

      <Modal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title="Thêm hồ sơ khuôn mặt"
      >
        <AddFaceProfileForm onCancel={() => setProfileModalOpen(false)} />
      </Modal>

      <Modal
        open={passcodeModalOpen}
        onClose={() => setPasscodeModalOpen(false)}
        title="Đổi mã PIN"
      >
        <ChangePasscodeForm onCancel={() => setPasscodeModalOpen(false)} />
      </Modal>

      <Modal
        open={incidentModalOpen}
        onClose={() => setIncidentModalOpen(false)}
        title="Chi tiết cảnh báo"
      >
        <IncidentDetail
          timeRange="14:32:01 - 14:55:22"
          failedCount={3}
          attempts={INCIDENT_ATTEMPTS}
          onResolve={() => {
            setIncidentResolved(true);
            setIncidentModalOpen(false);
          }}
        />
      </Modal>

      <Modal open={pinPadOpen} onClose={() => setPinPadOpen(false)}>
        <UnlockPinPad
          onConfirm={() => {
            setLocked(false);
            setPinPadOpen(false);
          }}
          onCancel={() => setPinPadOpen(false)}
        />
      </Modal>

      <Modal open={faceIdOpen} onClose={() => setFaceIdOpen(false)}>
        <UnlockFaceId
          deviceName="Khóa cửa chính"
          onConfirm={() => {
            setLocked(false);
            setFaceIdOpen(false);
          }}
          onCancel={() => setFaceIdOpen(false)}
        />
      </Modal>
    </div>
  );
}

export default SecurityPage;
