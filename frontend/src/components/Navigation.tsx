import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  FileCheck2,
  Users,
  Package,
  Boxes,
  ClipboardCheck,
  ShoppingBag,
  Truck,
  Sun,
  Wallet,
  BarChart3,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Search,
  Smartphone,
  TrendingUp
} from 'lucide-react';

interface NavSubItem {
  label: string;
  path: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
  badgeColor?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavSubItem[];
}

export const NavigationLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMobileGroup, setExpandedMobileGroup] = useState<string | null>('revenue');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Group 1: Revenue (Strictly Shop POS, Projects, M-Pesa)
  const revenueGroup: NavGroup = {
    id: 'revenue',
    label: 'Revenue',
    icon: TrendingUp,
    items: [
      {
        label: 'Shop Sales (POS)',
        path: '/pos',
        icon: ShoppingCart,
        description: 'Retail counter sales, barcode scanning & instant receipt checkout',
        badge: 'Counter',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
      },
      {
        label: 'Solar Projects',
        path: '/projects',
        icon: Sun,
        description: 'Solar installation projects, BOM allocations & project profit',
        badge: 'Projects',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200'
      },
      {
        label: 'M-Pesa Services',
        path: '/accounts?tab=mpesa',
        icon: Smartphone,
        description: 'M-Pesa agent commission logs & float income tracking',
        badge: 'M-Pesa',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
      }
    ]
  };

  // Group 2: Sales & Customers
  const salesGroup: NavGroup = {
    id: 'sales_customers',
    label: 'Sales & Orders',
    icon: Receipt,
    items: [
      {
        label: 'Sales & Invoices',
        path: '/sales',
        icon: Receipt,
        description: 'Completed invoice register, receipt lookups & status tracking'
      },
      {
        label: 'Quotations & Proformas',
        path: '/pre-sales',
        icon: FileCheck2,
        description: 'Customer pre-sales quotes, proformas & sale conversion'
      },
      {
        label: 'Customers',
        path: '/customers',
        icon: Users,
        description: 'Customer directory, balances & credit ledgers'
      }
    ]
  };

  // Group 3: Inventory & Catalog
  const inventoryGroup: NavGroup = {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    items: [
      {
        label: 'Products & Catalog',
        path: '/products',
        icon: Package,
        description: 'Product SKUs, buying/selling prices, taxable status & roll parameters'
      },
      {
        label: 'Stock Balances',
        path: '/inventory',
        icon: Boxes,
        description: 'Live store stock quantities & manual adjustments'
      },
      {
        label: 'Stock Take',
        path: '/stock-take',
        icon: ClipboardCheck,
        description: 'Physical stock counts & variance reconciliation'
      }
    ]
  };

  // Group 4: Procurement
  const procurementGroup: NavGroup = {
    id: 'procurement',
    label: 'Purchases',
    icon: ShoppingBag,
    items: [
      {
        label: 'Purchases & GRN',
        path: '/purchases',
        icon: ShoppingBag,
        description: 'Purchase orders, Goods Received Notes & freight expenses'
      },
      {
        label: 'Suppliers',
        path: '/suppliers',
        icon: Truck,
        description: 'Supplier accounts, balances & payment records'
      }
    ]
  };

  const navGroups = [revenueGroup, salesGroup, inventoryGroup, procurementGroup];

  // All flat items for command palette search
  const allItems: { label: string; path: string; group: string; icon: React.ElementType }[] = [
    { label: 'Dashboard', path: '/', group: 'Overview', icon: LayoutDashboard },
    ...revenueGroup.items.map((i) => ({ ...i, group: 'Revenue' })),
    ...salesGroup.items.map((i) => ({ ...i, group: 'Sales & Orders' })),
    ...inventoryGroup.items.map((i) => ({ ...i, group: 'Inventory' })),
    ...procurementGroup.items.map((i) => ({ ...i, group: 'Purchases' })),
    { label: 'Accounts & Petty Cash', path: '/accounts', group: 'Finance', icon: Wallet },
    { label: 'Reports & Analytics', path: '/reports', group: 'Analytics', icon: BarChart3 }
  ];

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts (F2 for POS, Ctrl+K / Cmd+K for Command Palette, Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        navigate('/pos');
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setOpenDropdown(null);
        setMobileMenuOpen(false);
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Close mobile drawer and dropdowns on location change
  useEffect(() => {
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  // Check if current route is inside a group
  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => {
      if (item.path.includes('?')) {
        const [basePath, search] = item.path.split('?');
        return location.pathname === basePath && location.search.includes(search);
      }
      return location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path + '/'));
    });
  };

  const isPathActive = (path: string) => {
    if (path.includes('?')) {
      const [basePath, search] = path.split('?');
      return location.pathname === basePath && location.search.includes(search);
    }
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const filteredCommandItems = searchQuery.trim()
    ? allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.group.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : allItems;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Main Bar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 flex items-center justify-between h-14">

          {/* Left Section: Brand & Desktop Nav */}
          <div className="flex items-center space-x-3 xl:space-x-5 min-w-0" ref={dropdownRef}>
            {/* Brand Logo */}
            <Link to="/" className="flex items-center space-x-2.5 group shrink-0 whitespace-nowrap pr-1">
              <div className="h-8 w-8 rounded-xl bg-amber-600 group-hover:bg-amber-500 flex items-center justify-center text-white font-black text-xs shadow-sm transition-colors tracking-tight">
                POS
              </div>
              <div className="hidden xl:block leading-tight">
                <div className="text-xs font-black text-slate-900 tracking-tight">
                  Solar Business POS
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  Single Store • Local First
                </div>
              </div>
            </Link>

            {/* Desktop Nav Items */}
            <nav className="hidden lg:flex items-center space-x-1 shrink-0">
              {/* Dashboard Direct Link */}
              <Link
                to="/"
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap ${isPathActive('/')
                  ? 'bg-amber-50 text-amber-900 font-extrabold border border-amber-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
              >
                <LayoutDashboard className={`h-4 w-4 shrink-0 ${isPathActive('/') ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>Dashboard</span>
              </Link>

              {/* Categorized Dropdowns */}
              {navGroups.map((group) => {
                const GroupIcon = group.icon;
                const active = isGroupActive(group);
                const isOpen = openDropdown === group.id;

                return (
                  <div key={group.id} className="relative">
                    <button
                      onClick={() => setOpenDropdown(isOpen ? null : group.id)}
                      onMouseEnter={() => setOpenDropdown(group.id)}
                      className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap ${active
                        ? 'bg-amber-50 text-amber-900 font-extrabold border border-amber-200/80 shadow-2xs'
                        : isOpen
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                        }`}
                    >
                      <GroupIcon className={`h-4 w-4 shrink-0 ${active ? 'text-amber-600' : 'text-slate-400'}`} />
                      <span>{group.label}</span>
                      {group.id === 'revenue' && (
                        <span className="ml-0.5 inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500 text-white uppercase tracking-wider">
                          3
                        </span>
                      )}
                      <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-slate-700' : 'text-slate-400'}`} />
                    </button>

                    {/* Popover Dropdown */}
                    {isOpen && (
                      <div
                        onMouseLeave={() => setOpenDropdown(null)}
                        className="absolute left-0 mt-1.5 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                      >
                        <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
                          <span>{group.label} Modules</span>
                          {group.id === 'revenue' && <span className="text-amber-600 font-extrabold">Primary Revenue</span>}
                        </div>

                        <div className="space-y-0.5">
                          {group.items.map((item) => {
                            const ItemIcon = item.icon;
                            const itemActive = isPathActive(item.path);

                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setOpenDropdown(null)}
                                className={`flex items-start space-x-2.5 p-2 rounded-xl text-xs transition-colors ${itemActive
                                  ? 'bg-amber-50/80 text-amber-950 font-bold border border-amber-200/60'
                                  : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium'
                                  }`}
                              >
                                <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${itemActive ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                  <ItemIcon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900">{item.label}</span>
                                    {item.badge && (
                                      <span className={`text-[9px] px-1.5 py-0.2 font-extrabold rounded border whitespace-nowrap ${item.badgeColor}`}>
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5 line-clamp-2">
                                    {item.description}
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Finance Direct Link */}
              <Link
                to="/accounts"
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap ${isPathActive('/accounts') && !location.search.includes('tab=mpesa')
                  ? 'bg-amber-50 text-amber-900 font-extrabold border border-amber-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
              >
                <Wallet className={`h-4 w-4 shrink-0 ${isPathActive('/accounts') && !location.search.includes('tab=mpesa') ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>Finance</span>
              </Link>

              {/* Reports Direct Link */}
              <Link
                to="/reports"
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap ${isPathActive('/reports')
                  ? 'bg-amber-50 text-amber-900 font-extrabold border border-amber-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
              >
                <BarChart3 className={`h-4 w-4 shrink-0 ${isPathActive('/reports') ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>Reports</span>
              </Link>
            </nav>
          </div>

          {/* Right Section: POS Action, Search, User Info & Mobile Hamburger */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0 whitespace-nowrap">
            {/* Quick POS Launch Button */}
            <Link
              to="/pos"
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer whitespace-nowrap"
              title="Open POS Register (F2)"
            >
              <ShoppingCart className="h-4 w-4 text-amber-100 shrink-0" />
              <span>Open POS</span>
              <kbd className="hidden sm:inline-block ml-0.5 px-1 py-0.2 text-[9px] font-mono bg-amber-700/60 rounded text-amber-100 border border-amber-500/50">
                F2
              </kbd>
            </Link>

            {/* Quick Search Palette Trigger */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title="Quick Search (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span className="hidden md:inline text-slate-500">Search...</span>
              <kbd className="hidden md:inline-block px-1 py-0.2 text-[9px] font-mono bg-white rounded border border-slate-200 text-slate-400 shadow-2xs">
                ⌘K
              </kbd>
            </button>

            {/* User Profile Info */}
            <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-slate-200 shrink-0 whitespace-nowrap">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-900 leading-none flex items-center space-x-1">
                  <span>{user?.full_name}</span>
                  <span className="uppercase text-[9px] font-extrabold bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200">
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={() => logout()}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer flex items-center space-x-1 whitespace-nowrap"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="hidden md:inline text-xs font-bold">Exit</span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 focus:outline-none cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Command Palette Overlay Modal */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center space-x-2">
              <Search className="h-4 w-4 text-slate-400 ml-2" />
              <input
                type="text"
                autoFocus
                placeholder="Search modules, sales, inventory, projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-semibold text-slate-900 bg-transparent focus:outline-none py-1"
              />
              <button onClick={() => setCommandPaletteOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100">
              {filteredCommandItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium">
                  No matching module found.
                </div>
              ) : (
                filteredCommandItems.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setCommandPaletteOpen(false)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-50 text-slate-700 hover:text-amber-950 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-slate-100 group-hover:bg-amber-600 group-hover:text-white rounded-lg text-slate-600 transition-colors">
                          <ItemIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-amber-950">{item.label}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{item.group}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 group-hover:text-amber-700 font-bold">Go →</span>
                    </Link>
                  );
                })
              )}
            </div>

            <div className="bg-slate-50 px-4 py-2 text-[10px] text-slate-400 font-medium flex items-center justify-between border-t border-slate-100">
              <span>Press <kbd className="font-mono bg-white px-1 rounded border">Esc</kbd> to close</span>
              <span>Quick Navigation</span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Slide-Over Drawer (< 1024px) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm h-full shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold text-sm">
                  POS
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900">Solar Business POS</div>
                  <div className="text-[10px] text-slate-400 font-medium">Navigation Menu</div>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Dashboard */}
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 p-3 rounded-2xl text-xs font-bold transition-colors ${isPathActive('/') ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-slate-50 text-slate-700'
                  }`}
              >
                <LayoutDashboard className="h-4 w-4 text-amber-600" />
                <span>Dashboard</span>
              </Link>

              {/* Categorized Groups Accordion */}
              {navGroups.map((group) => {
                const GroupIcon = group.icon;
                const isExpanded = expandedMobileGroup === group.id;

                return (
                  <div key={group.id} className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                    <button
                      onClick={() => setExpandedMobileGroup(isExpanded ? null : group.id)}
                      className="w-full p-3 flex items-center justify-between bg-slate-50/80 text-xs font-bold text-slate-900"
                    >
                      <div className="flex items-center space-x-2.5">
                        <GroupIcon className="h-4 w-4 text-slate-500" />
                        <span>{group.label}</span>
                        {group.id === 'revenue' && (
                          <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded text-[9px] font-extrabold">3</span>
                        )}
                      </div>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="p-2 space-y-1 bg-white border-t border-slate-100">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon;
                          const active = isPathActive(item.path);

                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold ${active ? 'bg-amber-50 text-amber-950 font-bold border border-amber-200' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                <ItemIcon className={`h-4 w-4 ${active ? 'text-amber-600' : 'text-slate-400'}`} />
                                <span>{item.label}</span>
                              </div>
                              {item.badge && (
                                <span className={`text-[9px] px-1.5 py-0.2 font-extrabold rounded border ${item.badgeColor}`}>
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Direct Links */}
              <div className="space-y-1 pt-2">
                <Link
                  to="/accounts"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 p-3 rounded-2xl text-xs font-bold ${isPathActive('/accounts') && !location.search.includes('tab=mpesa') ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-slate-50 text-slate-700'
                    }`}
                >
                  <Wallet className="h-4 w-4 text-indigo-600" />
                  <span>Finance & Accounts</span>
                </Link>

                <Link
                  to="/reports"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 p-3 rounded-2xl text-xs font-bold ${isPathActive('/reports') ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-slate-50 text-slate-700'
                    }`}
                >
                  <BarChart3 className="h-4 w-4 text-sky-600" />
                  <span>Reports & Analytics</span>
                </Link>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">{user?.full_name}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">@{user?.username} ({user?.role})</div>
              </div>
              <button
                onClick={() => logout()}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 shadow-2xs"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Body Container */}
      <main className={`flex-1 max-w-[1700px] w-full mx-auto pb-16 sm:pb-6 ${location.pathname === '/pos' ? 'p-3 sm:p-4' : 'p-4 sm:p-6'}`}>
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (< 640px) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 px-3 py-1.5 flex items-center justify-around shadow-lg">
        <Link
          to="/"
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold ${isPathActive('/') ? 'text-amber-600' : 'text-slate-500'
            }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dash</span>
        </Link>

        <Link
          to="/pos"
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-extrabold ${isPathActive('/pos') ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-700 bg-amber-50'
            }`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>POS</span>
        </Link>

        <Link
          to="/projects"
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold ${isPathActive('/projects') ? 'text-amber-600' : 'text-slate-500'
            }`}
        >
          <Sun className="h-4 w-4" />
          <span>Projects</span>
        </Link>

        <Link
          to="/accounts?tab=mpesa"
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold ${location.search.includes('tab=mpesa') ? 'text-emerald-600 font-extrabold' : 'text-slate-500'
            }`}
        >
          <Smartphone className="h-4 w-4" />
          <span>M-Pesa</span>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold text-slate-500 cursor-pointer"
        >
          <Menu className="h-4 w-4" />
          <span>More</span>
        </button>
      </div>
    </div>
  );
};
