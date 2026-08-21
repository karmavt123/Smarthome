import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';

function useRouter() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  return {
    navigate,
    path: location.pathname,
    params,
    queryParams: Object.fromEntries(searchParams.entries()),
    searchParams,
    setSearchParams,
    location,
    goBack: () => navigate(-1),
    goForward: () => navigate(1),
  };
}

export default useRouter;
