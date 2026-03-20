import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { ProductFormPage } from './pages/ProductFormPage';
import { ProductsPage } from './pages/ProductsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProductsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/products/new" element={<ProductFormPage mode="create" />} />
          <Route path="/products/:id/edit" element={<ProductFormPage mode="edit" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
