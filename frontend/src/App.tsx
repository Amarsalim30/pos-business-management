import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ProductsPage } from './pages/Products';
import { InventoryPage } from './pages/Inventory';
import { 
  LayoutDashboard, 
  Package, 
  Boxes, 
  LogOut
} from 'lucide-react';

function NavigationLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Products & Rolls', path: '/products', icon: Package },
    { label: 'Inventory Levels', path: '/inventory', icon: Boxes },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              POS
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-none">
                Solar Business POS
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                Local-First • Single Store
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-amber-50 text-amber-800 border border-amber-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-xs font-bold text-slate-900 flex items-center justify-end space-x-1.5">
              <span>{user?.full_name}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                {user?.role}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">@{user?.username}</div>
          </div>

          <button
            onClick={() => logout()}
            className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {children}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<NavigationLayout><Dashboard /></NavigationLayout>} />
            <Route path="/products" element={<NavigationLayout><ProductsPage /></NavigationLayout>} />
            <Route path="/inventory" element={<NavigationLayout><InventoryPage /></NavigationLayout>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
