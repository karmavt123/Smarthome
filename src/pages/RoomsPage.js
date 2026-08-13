import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner } from '@fortawesome/free-solid-svg-icons';
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
import AddRoomForm from '~/components/AddRoomForm';
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
      setRoomError(err?.status === 409 ? 'Tên phòng đã tồn tại.' : err?.message || 'Không thể tạo phòng.');
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
  const activeRoomId = rooms.some((room) => room.id === requestedRoomId) ? requestedRoomId : rooms[0]?.id;
  const activeRoom = rooms.find((room) => room.id === activeRoomId);
  const roomDevices = devices.filter((device) => device.rooms?.id === activeRoomId);
  const controllableRoomDevices = roomDevices.filter((d) => CONTROLLABLE_TYPES.includes(d.deviceType));
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
        <PairDeviceModal open={pairModalOpen} onClose={() => setPairModalOpen(false)} homeId={currentHomeId} />
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
        <RoomTabs rooms={rooms} activeId={activeRoomId} onSelect={selectRoom} onAdd={() => setRoomModalOpen(true)} />
        <button
          type="button"
          onClick={() => setDeviceModalOpen(true)}
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
          {controllableRoomDevices.map((device) => {
            const optimisticAction = getOptimisticAction(device.id);
            return (
              <QuickControlCard
                key={device.id}
                icon={DEVICE_TYPE_ICON[device.deviceType]}
                label={device.name}
                status={getStatusLabel(device, optimisticAction)}
                checked={isDeviceOn(device, optimisticAction)}
                error={errorFor(device.id)}
                onToggle={() => handleToggle(device)}
                hideToggle={device.deviceType === 'door'}
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

      <Modal open={deviceModalOpen} onClose={() => setDeviceModalOpen(false)} title="Thêm thiết bị mới">
        <AddDeviceForm
          rooms={rooms}
          onSubmit={handleAddDevice}
          onCancel={() => setDeviceModalOpen(false)}
          isSubmitting={isSubmittingDevice}
          error={deviceError}
        />
      </Modal>

      {roomModal}

      <PairDeviceModal open={pairModalOpen} onClose={() => setPairModalOpen(false)} homeId={currentHomeId} />
    </div>
  );
}

export default RoomsPage;
