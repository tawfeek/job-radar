import { Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api/client';
import Layout from './components/Layout';
import Login from './pages/Login';
import Kanban from './pages/Kanban';
import ProfileList from './pages/ProfileList';
import ProfileForm from './pages/ProfileForm';

// Single guard. The route table below wraps everything except /login in
// it; on first render with no token we bounce to /login. Token validity
// is also checked on every API call (the axios interceptor) which is
// where expired tokens get caught.
function RequireAuth({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Kanban />} />
        <Route path="/profiles" element={<ProfileList />} />
        <Route path="/profiles/new" element={<ProfileForm />} />
        <Route path="/profiles/:id" element={<ProfileForm />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
