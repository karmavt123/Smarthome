import { useState } from 'react';
import useRouter from '~/hooks/useRouter';
import Modal from '~/components/Modal';
import HomeCard from '~/components/HomeCard';
import AddHomeCard from '~/components/AddHomeCard';
import AddHomeForm from '~/components/AddHomeForm';

const HOMES = [
  {
    id: 1,
    name: 'Nhà riêng - Hà Nội',
    location: 'Tây Hồ, Hà Nội',
    deviceCount: 24,
    status: 'safe',
    tags: ['Smart Lighting', 'HVAC'],
    gradient: 'from-slate-800 via-slate-700 to-emerald-900',
  },
  {
    id: 2,
    name: 'Căn hộ Landmark',
    location: 'Bình Thạnh, TP.HCM',
    deviceCount: 12,
    status: 'locked',
    tags: ['Security Cam', 'Door Lock'],
    gradient: 'from-slate-900 via-indigo-950 to-slate-800',
  },
  {
    id: 3,
    name: 'Biệt thự biển',
    location: 'Ngũ Hành Sơn, Đà Nẵng',
    deviceCount: 18,
    status: 'safe',
    tags: ['Irrigation', 'Pool Care'],
    gradient: 'from-cyan-900 via-slate-800 to-teal-800',
  },
];

function SelectHomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background p-8 md:p-12">
      <h1 className="text-headline-lg font-bold text-on-surface">
        Chào mừng trở lại, Nguyễn Minh!
      </h1>
      <p className="text-body-md text-outline mt-2">Vui lòng chọn ngôi nhà bạn muốn quản lý</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {HOMES.map((home) => (
          <HomeCard key={home.id} {...home} onClick={() => router.navigate('/')} />
        ))}
        <AddHomeCard onClick={() => setModalOpen(true)} />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Thêm ngôi nhà mới">
        <AddHomeForm onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

export default SelectHomePage;
