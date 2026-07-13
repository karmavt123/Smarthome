import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faFan, faLock, faPlus } from '@fortawesome/free-solid-svg-icons';
import useRouter from '~/hooks/useRouter';
import Modal from '~/components/Modal';
import RoomTabs from '~/components/RoomTabs';
import RoomClimateCard from '~/components/RoomClimateCard';
import QuickControlCard from '~/components/QuickControlCard';
import AddDeviceForm from '~/components/AddDeviceForm';
import AddRoomForm from '~/components/AddRoomForm';

const INITIAL_ROOMS = [
  { id: 'phong-khach', name: 'Phòng khách' },
  { id: 'nha-bep', name: 'Nhà bếp' },
  { id: 'phong-ngu', name: 'Phòng ngủ' },
  { id: 'san-vuon', name: 'Sân vườn' },
];

const DEFAULT_CLIMATE = { temperature: '--', humidity: 0, light: 0, sensorsOnline: 0 };

const slugify = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const CLIMATE_BY_ROOM = {
  'phong-khach': { temperature: 22.5, humidity: 48, light: 350, sensorsOnline: 3 },
  'nha-bep': { temperature: 24.8, humidity: 55, light: 420, sensorsOnline: 2 },
  'phong-ngu': { temperature: 21, humidity: 50, light: 120, sensorsOnline: 2 },
  'san-vuon': { temperature: 27.3, humidity: 60, light: 800, sensorsOnline: 1 },
};

const INITIAL_DEVICES = [
  { id: 1, roomId: 'phong-khach', type: 'light', name: 'Đèn Trần Chính', checked: true },
  { id: 2, roomId: 'phong-khach', type: 'light', name: 'Đèn Bàn Sofa', checked: true },
  { id: 3, roomId: 'phong-khach', type: 'fan', name: 'Quạt Trần', checked: false },
  { id: 4, roomId: 'phong-khach', type: 'door', name: 'Cửa Ban Công', checked: true },
  { id: 5, roomId: 'nha-bep', type: 'light', name: 'Đèn Bếp', checked: true },
  { id: 6, roomId: 'nha-bep', type: 'fan', name: 'Quạt Hút Mùi', checked: false },
  { id: 7, roomId: 'phong-ngu', type: 'light', name: 'Đèn Ngủ', checked: false },
  { id: 8, roomId: 'phong-ngu', type: 'door', name: 'Cửa Phòng', checked: true },
  { id: 9, roomId: 'san-vuon', type: 'light', name: 'Đèn Sân Vườn', checked: false },
  { id: 10, roomId: 'san-vuon', type: 'fan', name: 'Quạt Thông Gió', checked: false },
];

const DEVICE_TYPE_META = {
  light: { icon: faLightbulb, onLabel: 'Đang bật', offLabel: 'Đang tắt' },
  fan: { icon: faFan, onLabel: 'Đang bật', offLabel: 'Đang tắt' },
  door: { icon: faLock, onLabel: 'Đã khóa', offLabel: 'Đã mở' },
};

function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [devices, setDevices] = useState(INITIAL_DEVICES);
  const [modalOpen, setModalOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);

  const activeRoomId = rooms.some((room) => room.id === router.queryParams.id)
    ? router.queryParams.id
    : rooms[0].id;
  const activeRoom = rooms.find((room) => room.id === activeRoomId);
  const roomDevices = devices.filter((device) => device.roomId === activeRoomId);
  const climate = CLIMATE_BY_ROOM[activeRoomId] || DEFAULT_CLIMATE;

  const selectRoom = (roomId) => router.navigate(`/phong?id=${roomId}`);

  const addRoom = (name) => {
    let id = slugify(name) || `phong-${rooms.length + 1}`;
    if (rooms.some((room) => room.id === id)) id = `${id}-${rooms.length + 1}`;
    setRooms((prev) => [...prev, { id, name }]);
    setRoomModalOpen(false);
    router.navigate(`/phong?id=${id}`);
  };

  const toggleDevice = (id) => {
    setDevices((prev) =>
      prev.map((device) => (device.id === id ? { ...device, checked: !device.checked } : device))
    );
  };

  const turnOffAll = () => {
    setDevices((prev) =>
      prev.map((device) =>
        device.roomId === activeRoomId ? { ...device, checked: false } : device
      )
    );
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-headline-md font-semibold text-on-surface">Phòng & Thiết bị</h1>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary/15 text-tertiary text-label-sm font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          HỆ THỐNG HOẠT ĐỘNG
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <RoomTabs
          rooms={rooms}
          activeId={activeRoomId}
          onSelect={selectRoom}
          onAdd={() => setRoomModalOpen(true)}
        />
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 text-secondary text-body-md hover:underline shrink-0"
        >
          <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
          Thêm thiết bị
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-72 shrink-0">
          <RoomClimateCard roomName={activeRoom.name} {...climate} />
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
          {roomDevices.map((device) => {
            const meta = DEVICE_TYPE_META[device.type];
            return (
              <QuickControlCard
                key={device.id}
                icon={meta.icon}
                label={device.name}
                status={device.checked ? meta.onLabel : meta.offLabel}
                checked={device.checked}
                onToggle={() => toggleDevice(device.id)}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 bg-surface-container-low rounded-xl border border-outline-variant/30 px-5 py-4 mt-6">
        <p className="text-body-md text-on-surface-variant">
          <span className="font-semibold text-on-surface">{roomDevices.length}</span> thiết bị trong{' '}
          {activeRoom.name.toLowerCase()}
        </p>
        <button
          type="button"
          onClick={turnOffAll}
          className="rounded-lg bg-surface-container-high text-on-surface-variant font-medium px-4 py-2 text-body-md hover:bg-surface-container transition-colors"
        >
          Tắt tất cả
        </button>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Thêm thiết bị mới">
        <AddDeviceForm rooms={rooms} onCancel={() => setModalOpen(false)} />
      </Modal>

      <Modal open={roomModalOpen} onClose={() => setRoomModalOpen(false)} title="Thêm phòng mới">
        <AddRoomForm onSubmit={addRoom} onCancel={() => setRoomModalOpen(false)} />
      </Modal>
    </div>
  );
}

export default RoomsPage;
