import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NavigationLayout } from './components/Navigation';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POSPage } from './pages/POS';
import { SalesListPage } from './pages/SalesList';
import { PreSalesPage } from './pages/PreSales';
import { CustomersPage } from './pages/Customers';
import { ProductsPage } from './pages/Products';
import { InventoryPage } from './pages/Inventory';
import { StockTakePage } from './pages/StockTake';
import { PurchasesPage } from './pages/Purchases';
import { SuppliersPage } from './pages/Suppliers';
import { ProjectsPage } from './pages/Projects';
import { ProjectWorkspacePage } from './pages/ProjectWorkspace';
import { AccountsPage } from './pages/Accounts';
import { ReportsPage } from './pages/Reports';
import { UsersPage } from './pages/Users';
import { SettingsPage } from './pages/Settings';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<NavigationLayout><Dashboard /></NavigationLayout>} />
            <Route path="/pos" element={<NavigationLayout><POSPage /></NavigationLayout>} />
            <Route path="/sales" element={<NavigationLayout><SalesListPage /></NavigationLayout>} />
            <Route path="/pre-sales" element={<NavigationLayout><PreSalesPage /></NavigationLayout>} />
            <Route path="/customers" element={<NavigationLayout><CustomersPage /></NavigationLayout>} />
            <Route path="/purchases" element={<NavigationLayout><PurchasesPage /></NavigationLayout>} />
            <Route path="/suppliers" element={<NavigationLayout><SuppliersPage /></NavigationLayout>} />
            <Route path="/projects" element={<NavigationLayout><ProjectsPage /></NavigationLayout>} />
            <Route path="/projects/:id" element={<NavigationLayout><ProjectWorkspacePage /></NavigationLayout>} />
            <Route path="/accounts" element={<NavigationLayout><AccountsPage /></NavigationLayout>} />
            <Route path="/mpesa" element={<Navigate to="/accounts?tab=mpesa" replace />} />

            <Route path="/reports" element={<NavigationLayout><ReportsPage /></NavigationLayout>} />
            <Route path="/products" element={<NavigationLayout><ProductsPage /></NavigationLayout>} />
            <Route path="/inventory" element={<NavigationLayout><InventoryPage /></NavigationLayout>} />
            <Route path="/stock-take" element={<NavigationLayout><StockTakePage /></NavigationLayout>} />

            <Route path="/users" element={<NavigationLayout><UsersPage /></NavigationLayout>} />
            <Route path="/settings" element={<NavigationLayout><SettingsPage /></NavigationLayout>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
