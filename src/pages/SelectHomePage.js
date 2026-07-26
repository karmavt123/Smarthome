import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import useRouter from '~/hooks/useRouter';
import useAuth from '~/hooks/useAuth';
import useHome from '~/hooks/useHome';
import homeService from '~/services/homeService';
import Modal from '~/components/Modal';
import HomeCard from '~/components/HomeCard';
import AddHomeCard from '~/components/AddHomeCard';
import AddHomeForm from '~/components/AddHomeForm';

const GRADIENTS = [
  'from-slate-800 via-slate-700 to-emerald-900',
  'from-slate-900 via-indigo-950 to-slate-800',
  'from-cyan-900 via-slate-800 to-teal-800',
];

function SelectHomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const router = useRouter();
  const { user } = useAuth();
  const { homes, isLoadingHomes, selectHome, refreshHomes } = useHome();

  const handleSelect = (homeId) => {
    selectHome(homeId);
    router.navigate('/');
  };

  const handleCreate = async ({ name, address }) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const home = await homeService.create({ name, address });
      await refreshHomes();
      setModalOpen(false);
      handleSelect(home.id);
    } catch (err) {
      setSubmitError(err?.message || 'Không thể tạo ngôi nhà, thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8 md:p-12">
      <h1 className="text-headline-lg font-bold text-on-surface">
        Chào mừng trở lại{user?.fullName ? `, ${user.fullName}` : ''}!
      </h1>
      <p className="text-body-md text-outline mt-2">Vui lòng chọn ngôi nhà bạn muốn quản lý</p>

      {isLoadingHomes ? (
        <div className="flex items-center justify-center py-16">
          <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-secondary animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {homes.map((home, index) => (
            <HomeCard
              key={home.id}
              name={home.name}
              address={home.address}
              gradient={GRADIENTS[index % GRADIENTS.length]}
              onClick={() => handleSelect(home.id)}
            />
          ))}
          <AddHomeCard onClick={() => setModalOpen(true)} />
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Thêm ngôi nhà mới">
        <AddHomeForm
          onSubmit={handleCreate}
          onCancel={() => setModalOpen(false)}
          isSubmitting={isSubmitting}
          error={submitError}
        />
      </Modal>
    </div>
  );
}

export default SelectHomePage;
