import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import ProtectedLayout from './layouts/ProtectedLayout';
import HomePage from './pages/HomePage';
import RoomsPage from './pages/RoomsPage';
import SecurityPage from './pages/SecurityPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import StatisticsPage from './pages/StatisticsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import SelectHomePage from './pages/SelectHomePage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="tong-quan" element={<HomePage />} />
        <Route path="thiet-bi" element={<RoomsPage />} />
        <Route path="an-ninh" element={<SecurityPage />} />
        <Route path="thong-bao" element={<NotificationsPage />} />
        <Route path="cai-dat" element={<SettingsPage />} />
        <Route path="thong-ke" element={<StatisticsPage />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route path="/dang-ky" element={<RegisterPage />} />
        <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
      </Route>
      <Route element={<ProtectedLayout />}>
        <Route path="/chon-nha" element={<SelectHomePage />} />
      </Route>
    </Routes>
  );
}

export default App;
