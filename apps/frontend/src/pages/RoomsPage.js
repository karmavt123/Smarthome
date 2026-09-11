import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faPen } from '@fortawesome/free-solid-svg-icons';
import useRouter from '~/hooks/useRouter';
import useHome from '~/hooks/useHome';
import useDeviceCommand from '~/hooks/useDeviceCommand';
import useDevices from '~/hooks/useDevices';
import dashboardService from '~/services/dashboardService';
import roomService from '~/services/roomService';
import deviceService from '~/services/deviceService';
import {
  CONTROLLABLE_TYPES,
  DEVICE_TYPE_ICON,
  isDeviceOn,
  getNextAction,
  getStatusLabel,
} from '~/utils/deviceStatus';
import Modal from '~/components/Modal';
import RoomTabs from '~/components/RoomTabs';
import RoomClimateCard from '~/components/RoomClimateCard';
import QuickControlCard from '~/components/QuickControlCard';
import AddDeviceForm from '~/components/AddDeviceForm';
import EditDeviceForm from '~/components/EditDeviceForm';
import AddRoomForm from '~/components/AddRoomForm';
import EditRoomForm from '~/components/EditRoomForm';
import ConnectDeviceCard from '~/components/ConnectDeviceCard';
import PairDeviceModal from '~/components/PairDeviceModal';

const REFRESH_INTERVAL_MS = 5000;

function getRoomClimate(room, devices) {
  const env = room.environment || {};
  const sensorsOnline = devices.filter(
    (d) => d.rooms?.id === room.id && d.deviceType === 'sensor' && d.connectionStatus === 'online'
  ).length;

  return {
    temperature: env.temperature?.value,
    humidity: env.humidity?.value,
    light: env.light?.value,
    sensorsOnline,
  };
}

function RoomsPage() {
  const router = useRouter();
  const { currentHomeId } = useHome();
  const { toggle, getOptimisticAction, errorFor } = useDeviceCommand();
  const { devices, setDevices } = useDevices();

  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [isSubmittingDevice, setIsSubmittingDevice] = useState(false);
  const [deviceError, setDeviceError] = useState(null);

  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false);
  const [roomError, setRoomError] = useState(null);

  const [editingDevice, setEditingDevice] = useState(null);
  const [isSubmittingEditDevice, setIsSubmittingEditDevice] = useState(false);
  const [editDeviceError, setEditDeviceError] = useState(null);

  const [editRoomOpen, setEditRoomOpen] = useState(false);
  const [isSubmittingEditRoom, setIsSubmittingEditRoom] = useState(false);
  const [editRoomError, setEditRoomError] = useState(null);

  const [pairModalOpen, setPairModalOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const [data, devicesRes] = await Promise.all([
        dashboardService.get(currentHomeId),
        deviceService.getAll({ homeId: currentHomeId }),
      ]);
      setDashboard(data);
      setDevices(devicesRes);
      setLoadError(null);
    } catch (err) {
      setLoadError(err?.message || 'Không thể tải dữ liệu, thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }, [currentHomeId, setDevices]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleToggle = (device) => {
    const nextAction = getNextAction(device, getOptimisticAction(device.id));
    toggle(device.id, nextAction, { onSettled: () => fetchDashboard() });
  };

  const handleAddRoom = async (name) => {
    setIsSubmittingRoom(true);
    setRoomError(null);
    try {
      const room = await roomService.create({ name, homeId: currentHomeId });
      await fetchDashboard();
      setRoomModalOpen(false);
      router.navigate(`/thiet-bi?roomId=${room.id}`);
    } catch (err) {
      setRoomError(
        err?.status === 409 ? 'Tên phòng đã tồn tại.' : err?.message || 'Không thể tạo phòng.'
      );
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  const handleAddDevice = async (data) => {
    setIsSubmittingDevice(true);
    setDeviceError(null);
    try {
      await deviceService.create({ ...data, homeId: currentHomeId });
      await fetchDashboard();
      setDeviceModalOpen(false);
    } catch (err) {
      setDeviceError(err?.message || 'Không thể thêm thiết bị.');
    } finally {
      setIsSubmittingDevice(false);
    }
  };

  const openEditDevice = (device) => {
    setEditDeviceError(null);
    setEditingDevice(device);
  };

  const handleUpdateDevice = async ({ name, roomId }) => {
    setIsSubmittingEditDevice(true);
    setEditDeviceError(null);
    try {
      await deviceService.update(editingDevice.id, { name, roomId });
      await fetchDashboard();
      setEditingDevice(null);
    } catch (err) {
      setEditDeviceError(err?.message || 'Không thể cập nhật thiết bị.');
    } finally {
      setIsSubmittingEditDevice(false);
    }
  };

  const handleDeleteDevice = async () => {
    setIsSubmittingEditDevice(true);
    setEditDeviceError(null);
    try {
      await deviceService.delete(editingDevice.id);
      await fetchDashboard();
      setEditingDevice(null);
    } catch (err) {
      // 409 = the backend refuses because history still references this device. Say what
      // it actually means instead of showing the raw English sentence.
      setEditDeviceError(
        err?.status === 409
          ? 'Thiết bị đã có lịch sử điều khiển hoặc quy tắc cảnh báo, không xoá được. Xoá các mục đó trước.'
          : err?.message || 'Không thể xoá thiết bị.'
      );
    } finally {
      setIsSubmittingEditDevice(false);
    }
  };

  const handleUpdateRoom = async (roomId, name) => {
    setIsSubmittingEditRoom(true);
    setEditRoomError(null);
    try {
      await roomService.update(roomId, { name });
      await fetchDashboard();
      setEditRoomOpen(false);
    } catch (err) {
      setEditRoomError(
        err?.status === 409 ? 'Tên phòng đã tồn tại.' : err?.message || 'Không thể đổi tên phòng.'
      );
    } finally {
      setIsSubmittingEditRoom(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    setIsSubmittingEditRoom(true);
    setEditRoomError(null);
    try {
      await roomService.delete(roomId);
      await fetchDashboard();
      setEditRoomOpen(false);
      // The deleted room is still in the URL; drop the query so the page falls back to
      // the first remaining room instead of rendering "phòng không tồn tại".
      router.navigate('/thiet-bi');
    } catch (err) {
      setEditRoomError(err?.message || 'Không thể xoá phòng.');
    } finally {
      setIsSubmittingEditRoom(false);
    }
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

  const { rooms } = dashboard;
  const requestedRoomId = Number(router.queryParams.roomId);
  const activeRoomId = rooms.some((room) => room.id === requestedRoomId)
    ? requestedRoomId
    : rooms[0]?.id;
  const activeRoom = rooms.find((room) => room.id === activeRoomId);
  const roomDevices = devices.filter((device) => device.rooms?.id === activeRoomId);
  const controllableRoomDevices = roomDevices.filter((d) =>
    CONTROLLABLE_TYPES.includes(d.deviceType)
  );
  const climate = activeRoom ? getRoomClimate(activeRoom, devices) : { sensorsOnline: 0 };

  const selectRoom = (roomId) => router.navigate(`/thiet-bi?roomId=${roomId}`);

  const turnOffAll = () => {
    controllableRoomDevices.forEach((device) => {
      // Door is display-only here — unlock/lock lives on /an-ninh.
      if (device.deviceType === 'door') return;
      if (!isDeviceOn(device, getOptimisticAction(device.id))) return;
      toggle(device.id, 'turn_off', { onSettled: () => fetchDashboard() });
    });
  };

  const roomModal = (
    <Modal open={roomModalOpen} onClose={() => setRoomModalOpen(false)} title="Thêm phòng mới">
      <AddRoomForm
        onSubmit={handleAddRoom}
        onCancel={() => setRoomModalOpen(false)}
        isSubmitting={isSubmittingRoom}
        error={roomError}
      />
    </Modal>
  );

  if (devices.length === 0) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-[24rem]">
          <ConnectDeviceCard onClick={() => setPairModalOpen(true)} />
        </div>
        <PairDeviceModal
          open={pairModalOpen}
          onClose={() => setPairModalOpen(false)}
          homeId={currentHomeId}
        />
      </div>
    );
  }

  if (!activeRoom) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-body-md text-outline">Chưa có phòng nào trong nhà này.</p>
        <button
          type="button"
          onClick={() => setRoomModalOpen(true)}
          className="mt-4 rounded-lg bg-secondary text-on-secondary font-medium px-4 py-2 text-body-md hover:opacity-90 transition-opacity"
        >
          Thêm phòng mới
        </button>
        {roomModal}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-headline-md font-semibold text-on-surface">Thiết bị</h1>
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
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditRoomError(null);
              setEditRoomOpen(true);
            }}
            className="flex items-center gap-2 text-on-surface-variant text-body-md hover:underline"
          >
            <FontAwesomeIcon icon={faPen} className="w-3.5 h-3.5" />
            Sửa phòng
          </button>
          <button
            type="button"
            onClick={() => setDeviceModalOpen(true)}
            className="flex items-center gap-2 text-secondary text-body-md hover:underline"
          >
            <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
            Thêm thiết bị
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-72 shrink-0">
          <RoomClimateCard roomName={activeRoom.name} {...climate} />
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
          {/* Every device in the room, not just the controllable ones — sensors used to
              be invisible in the UI, so there was no way to rename or remove one. */}
          {roomDevices.map((device) => {
            const optimisticAction = getOptimisticAction(device.id);
            const controllable = CONTROLLABLE_TYPES.includes(device.deviceType);
            return (
              <QuickControlCard
                key={device.id}
                icon={DEVICE_TYPE_ICON[device.deviceType]}
                label={device.name}
                status={getStatusLabel(device, optimisticAction)}
                checked={isDeviceOn(device, optimisticAction)}
                error={errorFor(device.id)}
                onToggle={() => handleToggle(device)}
                onEdit={() => openEditDevice(device)}
                // Doors are unlocked from /an-ninh (face/PIN), sensors have nothing to switch.
                hideToggle={!controllable || device.deviceType === 'door'}
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

      <Modal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        title="Thêm thiết bị mới"
      >
        <AddDeviceForm
          rooms={rooms}
          onSubmit={handleAddDevice}
          onCancel={() => setDeviceModalOpen(false)}
          isSubmitting={isSubmittingDevice}
          error={deviceError}
        />
      </Modal>

      <Modal open={!!editingDevice} onClose={() => setEditingDevice(null)} title="Sửa thiết bị">
        {editingDevice && (
          <EditDeviceForm
            device={editingDevice}
            rooms={rooms}
            onSubmit={handleUpdateDevice}
            onDelete={handleDeleteDevice}
            onCancel={() => setEditingDevice(null)}
            isSubmitting={isSubmittingEditDevice}
            error={editDeviceError}
          />
        )}
      </Modal>

      <Modal open={editRoomOpen} onClose={() => setEditRoomOpen(false)} title="Sửa phòng">
        <EditRoomForm
          room={activeRoom}
          deviceCount={roomDevices.length}
          onSubmit={(name) => handleUpdateRoom(activeRoom.id, name)}
          onDelete={() => handleDeleteRoom(activeRoom.id)}
          onCancel={() => setEditRoomOpen(false)}
          isSubmitting={isSubmittingEditRoom}
          error={editRoomError}
        />
      </Modal>

      {roomModal}

      <PairDeviceModal
        open={pairModalOpen}
        onClose={() => setPairModalOpen(false)}
        homeId={currentHomeId}
      />
    </div>
  );
}

export default RoomsPage;
