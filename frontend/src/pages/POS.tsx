import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import type { Product, Customer, Sale, Category } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  CreditCard,
  Banknote,
  Smartphone,
  Landmark,
  FileText,
  CheckCircle2,
  Percent,
  Bookmark,
  Play,
  Clock,
  Keyboard,
  UserPlus,
  Split,
  ShieldAlert,
  Zap,
  Loader2,
  MapPin
} from 'lucide-react';

interface CartItem {
  product: Product;
  unit_sold: 'piece' | 'roll' | 'meter';
  rolls_qty: number;
  loose_meters: number;
  quantity: number; // base units (meters for rolls, pieces for piece items)
  unit_price: number; // selling price per piece, per roll, or per meter
  line_total: number;
}

interface ParkedCart {
  id: string;
  name: string;
  parked_at: string;
  customer_id: number | null;
  customer_name: string | null;
  items: CartItem[];
  discount_amount: string;
  is_etr: boolean;
  site_name?: string;
  notes: string;
  total: number;
}

interface SplitPaymentLine {
  id: string;
  payment_method: 'cash' | 'mpesa' | 'card' | 'bank';
  amount: string;
  reference: string;
}

const LOCAL_STORAGE_PARKED_KEY = 'pos_parked_carts';

export const POSPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Infinite Scrolling Products State
  const {
    items: products,
    loading: productsLoading,
    loadingMore: productsLoadingMore,
    hasMore: productsHasMore,
    sentinelRef: productsSentinelRef,
    reload: reloadProducts
  } = useInfiniteScroll<Product>({
    fetchFn: async (offset, limit) => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (selectedCategory !== 'all') params.append('category_id', String(selectedCategory));
      params.append('limit', String(limit));
      params.append('offset', String(offset));
      return await apiFetch<Product[]>(`/api/v1/products/?${params.toString()}`);
    },
    limit: 24,
    dependencies: [searchQuery, selectedCategory]
  });
  
  // Customer & Fiscal Controls
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [isETR, setIsETR] = useState(false);
  
  // Cart & Pricing
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  
  // Single Payment Method State
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card' | 'bank' | 'credit'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [amountTendered, setAmountTendered] = useState('');

  // Split Payment Mode State
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitPaymentLine[]>([
    { id: 'split_1', payment_method: 'mpesa', amount: '', reference: '' }
  ]);

  const [notes, setNotes] = useState('');
  const [siteName, setSiteName] = useState('');
  const [customerSites, setCustomerSites] = useState<string[]>([]);
  const [showNotesField, setShowNotesField] = useState(false);
  
  // Parked Carts State
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>([]);
  const [showParkedDrawer, setShowParkedDrawer] = useState(false);

  // Inline Quick Customer Creation Modal State
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [creatingQuickCust, setCreatingQuickCust] = useState(false);

  // Checkout & Printing State
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Search Input Ref for quick autofocus & hotkeys
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load distinct sites for selected customer
  useEffect(() => {
    if (selectedCustomerId && !isWalkIn) {
      apiFetch<string[]>(`/api/v1/customers/${selectedCustomerId}/sites`)
        .then(sites => setCustomerSites(sites || []))
        .catch(err => console.error('Failed to load customer sites', err));
    } else {
      setCustomerSites([]);
    }
  }, [selectedCustomerId, isWalkIn]);

  useEffect(() => {
    loadCategories();
    loadCustomers();
    loadParkedCartsFromStorage();
    searchInputRef.current?.focus();
  }, []);

  // Global keyboard hotkeys: F2 -> Focus Search, F4 -> Park Cart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleParkCart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCustomerId, isWalkIn, isETR, notes, discountAmount]);

  const loadCategories = async () => {
    try {
      const data = await apiFetch<Category[]>('/api/v1/categories/');
      setCategories(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await apiFetch<Customer[]>('/api/v1/customers/');
      setCustomers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadParkedCartsFromStorage = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PARKED_KEY);
      if (saved) {
        setParkedCarts(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load parked carts from storage', e);
    }
  };

  const saveParkedCartsToStorage = (carts: ParkedCart[]) => {
    setParkedCarts(carts);
    try {
      localStorage.setItem(LOCAL_STORAGE_PARKED_KEY, JSON.stringify(carts));
    } catch (e) {
      console.error('Failed to save parked carts to storage', e);
    }
  };

  // Calculate line item total
  const computeLineTotal = (item: CartItem): number => {
    if (item.product.unit_type === 'roll') {
      const mpr = Number(item.product.meters_per_roll) || 100;
      if (item.unit_sold === 'roll') {
        const rollFraction = item.rolls_qty + (item.loose_meters / mpr);
        return rollFraction * item.unit_price;
      } else {
        return item.quantity * item.unit_price;
      }
    }
    return item.quantity * item.unit_price;
  };

  // Add to cart (Single row per product guaranteed)
  const handleAddToCart = (product: Product, sellAsMeter: boolean = false) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(i => i.product.id === product.id);
      const isRoll = product.unit_type === 'roll';
      const mpr = Number(product.meters_per_roll) || 100;
      
      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        if (isRoll) {
          if (sellAsMeter) {
            const updated: CartItem = {
              ...existing,
              unit_sold: 'meter',
              unit_price: existing.unit_sold === 'meter' 
                ? existing.unit_price 
                : Number(product.price_per_meter || (Number(product.selling_price) / mpr)),
              quantity: existing.quantity + 10,
              loose_meters: existing.loose_meters + 10
            };
            updated.line_total = computeLineTotal(updated);
            return prev.map((i, idx) => idx === existingIndex ? updated : i);
          } else {
            const newRolls = (existing.rolls_qty || 0) + 1;
            const updated: CartItem = {
              ...existing,
              unit_sold: 'roll',
              unit_price: existing.unit_sold === 'roll' ? existing.unit_price : Number(product.selling_price),
              rolls_qty: newRolls,
              quantity: (newRolls * mpr) + existing.loose_meters
            };
            updated.line_total = computeLineTotal(updated);
            return prev.map((i, idx) => idx === existingIndex ? updated : i);
          }
        } else {
          const updated: CartItem = {
            ...existing,
            quantity: existing.quantity + 1,
          };
          updated.line_total = computeLineTotal(updated);
          return prev.map((i, idx) => idx === existingIndex ? updated : i);
        }
      }

      // New line item
      if (isRoll && sellAsMeter) {
        const meterPrice = product.price_per_meter || (Number(product.selling_price) / mpr);
        const initialItem: CartItem = {
          product,
          unit_sold: 'meter',
          rolls_qty: 0,
          loose_meters: 10,
          quantity: 10,
          unit_price: Number(meterPrice),
          line_total: Number(meterPrice) * 10
        };
        return [initialItem, ...prev];
      }

      const initialItem: CartItem = {
        product,
        unit_sold: isRoll ? 'roll' : 'piece',
        rolls_qty: isRoll ? 1 : 0,
        loose_meters: 0,
        quantity: isRoll ? mpr : 1,
        unit_price: Number(product.selling_price),
        line_total: Number(product.selling_price)
      };
      return [initialItem, ...prev];
    });
    setSearchQuery('');
  };

  const handleUpdateItem = (productId: number, updater: (item: CartItem) => CartItem) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const updated = updater(item);
        updated.line_total = computeLineTotal(updated);
        return updated;
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  // Switch selling mode between Roll and Loose Meters
  const handleSwitchUnitSold = (item: CartItem, newUnitSold: 'roll' | 'meter') => {
    const mpr = Number(item.product.meters_per_roll) || 100;
    const defaultRollPrice = Number(item.product.selling_price);
    const defaultMeterPrice = item.product.price_per_meter || (defaultRollPrice / mpr);

    handleUpdateItem(item.product.id, i => {
      if (newUnitSold === 'meter') {
        const totalMeters = (i.rolls_qty * mpr) + i.loose_meters || 10;
        return {
          ...i,
          unit_sold: 'meter',
          rolls_qty: 0,
          loose_meters: totalMeters,
          quantity: totalMeters,
          unit_price: Number(defaultMeterPrice)
        };
      } else {
        const rolls = Math.max(1, Math.floor(i.quantity / mpr) || 1);
        const loose = 0;
        return {
          ...i,
          unit_sold: 'roll',
          rolls_qty: rolls,
          loose_meters: loose,
          quantity: rolls * mpr,
          unit_price: defaultRollPrice
        };
      }
    });
  };

  // Quick Customer Creation
  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim()) return;
    setCreatingQuickCust(true);
    try {
      const newCust = await apiFetch<Customer>('/api/v1/customers/', {
        method: 'POST',
        body: JSON.stringify({
          name: quickCustName.trim(),
          phone: quickCustPhone.trim() || null
        })
      });
      await loadCustomers();
      setIsWalkIn(false);
      setSelectedCustomerId(newCust.id);
      setShowQuickCustomerModal(false);
      setQuickCustName('');
      setQuickCustPhone('');
    } catch (e: any) {
      alert(e.message || 'Failed to create customer');
    } finally {
      setCreatingQuickCust(false);
    }
  };

  // Split payment helpers
  const handleAddSplitLine = () => {
    setSplitLines(prev => [
      ...prev,
      { id: `split_${Date.now()}`, payment_method: 'cash', amount: '', reference: '' }
    ]);
  };

  const handleUpdateSplitLine = (id: string, field: keyof SplitPaymentLine, value: string) => {
    setSplitLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleRemoveSplitLine = (id: string) => {
    if (splitLines.length <= 1) return;
    setSplitLines(prev => prev.filter(l => l.id !== id));
  };

  // Stock status pill helper
  const renderStockBadge = (p: Product) => {
    const stock = Number(p.current_stock) || 0;
    const reorder = Number(p.reorder_level) || 0;
    if (stock <= 0) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200">
          Out of Stock
        </span>
      );
    }
    if (stock <= reorder) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          Low: {p.formatted_stock || `${stock} ${p.unit}`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        {p.formatted_stock || `${stock} ${p.unit}`}
      </span>
    );
  };

  // Cart Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.line_total, 0);
  const rawDiscount = Math.max(0, parseFloat(discountAmount) || 0);
  const calculatedDiscount = discountType === 'percent'
    ? (subtotal * rawDiscount) / 100
    : rawDiscount;
  const total = Math.max(0, subtotal - calculatedDiscount);

  // Split payment totals
  const totalSplitTendered = splitLines.reduce((acc, l) => acc + (parseFloat(l.amount) || 0), 0);
  const splitBalanceDue = Math.max(0, total - totalSplitTendered);
  const splitExcessCash = splitLines.some(l => l.payment_method === 'cash') && totalSplitTendered > total
    ? totalSplitTendered - total
    : 0;

  // Single payment cash change & quick cash helpers
  const singleTendered = parseFloat(amountTendered) || 0;
  const singleCashChange = paymentMethod === 'cash' && singleTendered > total ? singleTendered - total : 0;

  // Park Current Cart
  const handleParkCart = () => {
    if (cart.length === 0) return;
    const cust = customers.find(c => c.id === selectedCustomerId);
    const cartName = isWalkIn || !cust 
      ? `Walk-in (${cart.length} items)`
      : `${cust.name} (${cart.length} items)`;

    const newParkedCart: ParkedCart = {
      id: `cart_${Date.now()}`,
      name: cartName,
      parked_at: new Date().toISOString(),
      customer_id: !isWalkIn && selectedCustomerId ? Number(selectedCustomerId) : null,
      customer_name: cust ? cust.name : null,
      items: cart,
      discount_amount: String(calculatedDiscount),
      is_etr: isETR,
      site_name: siteName,
      notes: notes,
      total: total
    };

    saveParkedCartsToStorage([newParkedCart, ...parkedCarts]);
    setCart([]);
    setDiscountAmount('0');
    setSiteName('');
    setNotes('');
    setAmountTendered('');
    setShowParkedDrawer(false);
  };

  // Resume Parked Cart
  const handleResumeCart = (parkedCart: ParkedCart) => {
    if (cart.length > 0) {
      if (!window.confirm('Active cart has items. Replace with resumed cart?')) {
        return;
      }
    }

    setCart(parkedCart.items);
    setDiscountAmount(parkedCart.discount_amount);
    setIsETR(parkedCart.is_etr);
    setSiteName(parkedCart.site_name || '');
    setNotes(parkedCart.notes || '');
    if (parkedCart.customer_id) {
      setIsWalkIn(false);
      setSelectedCustomerId(parkedCart.customer_id);
    } else {
      setIsWalkIn(true);
      setSelectedCustomerId('');
    }

    handleDeleteParkedCart(parkedCart.id);
    setShowParkedDrawer(false);
  };

  // Delete Parked Cart
  const handleDeleteParkedCart = (id: string) => {
    const updated = parkedCarts.filter(c => c.id !== id);
    saveParkedCartsToStorage(updated);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Check if customer is needed for credit / partial sales
    const isCreditOrPartial = isSplitMode 
      ? splitBalanceDue > 0 
      : paymentMethod === 'credit';

    if (isCreditOrPartial && (!selectedCustomerId || isWalkIn)) {
      setCheckoutError('Customer account selection is required for credit or partial sales');
      return;
    }

    // Check if any cart quantity exceeds available stock
    for (const item of cart) {
      const available = Number(item.product.current_stock) || 0;
      if (item.quantity > available) {
        setCheckoutError(`Requested ${item.quantity} ${item.product.unit} of '${item.product.name}', but only ${available} ${item.product.unit} is available in stock.`);
        return;
      }
    }

    setCheckingOut(true);
    setCheckoutError(null);

    let payload: any = {
      customer_id: !isWalkIn && selectedCustomerId ? Number(selectedCustomerId) : null,
      discount_amount: calculatedDiscount,
      is_etr: isETR,
      site_name: siteName.trim() || null,
      notes: notes.trim() || null,
      items: cart.map(item => ({
        product_id: item.product.id,
        unit_type: item.product.unit_type,
        unit_sold: item.unit_sold,
        quantity: item.quantity,
        rolls_qty: item.rolls_qty,
        loose_meters: item.loose_meters,
        unit_price: item.unit_price
      }))
    };

    if (isSplitMode) {
      const validPayments = splitLines
        .filter(l => (parseFloat(l.amount) || 0) > 0)
        .map(l => ({
          payment_method: l.payment_method,
          amount: parseFloat(l.amount),
          reference: l.reference.trim() || null
        }));
      payload.payments = validPayments;
      payload.payment_method = validPayments.length > 1 ? 'split' : (validPayments[0]?.payment_method || 'credit');
    } else {
      payload.payment_method = paymentMethod;
      payload.payment_reference = paymentReference.trim() || null;
    }

    try {
      const sale = await apiFetch<Sale>('/api/v1/sales/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setCompletedSale(sale);
      setCart([]);
      setDiscountAmount('0');
      setPaymentReference('');
      setSiteName('');
      setNotes('');
      setAmountTendered('');
      setSplitLines([{ id: 'split_1', payment_method: 'mpesa', amount: '', reference: '' }]);
      reloadProducts();
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="h-[calc(100vh-105px)] flex flex-col space-y-2.5 overflow-hidden">
      {/* Top Ergonomic Action Bar */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Terminal Title & Cashier Hotkey Indicator */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
            <Zap className="h-4 w-4 fill-amber-500" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-900 tracking-tight">
                Cashier Point of Sale
              </span>
              <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono border border-slate-200">
                <Keyboard className="h-3 w-3 text-slate-400" />
                <span>F2: Search • F4: Park</span>
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {cart.length > 0 ? (
                <span className="text-emerald-600 font-medium">Cart Active • {cart.length} line items ready</span>
              ) : (
                <span>Ready for scan or barcode search</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Walk-In / Account Selector & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setIsWalkIn(true)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                isWalkIn ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Walk-in
            </button>
            <button
              onClick={() => setIsWalkIn(false)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                !isWalkIn ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Account
            </button>
          </div>

          {!isWalkIn && (
            <div className="flex items-center space-x-1">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 shadow-2xs max-w-[180px] font-medium"
              >
                <option value="">-- Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {Number(c.balance) > 0 ? `(Debt: KES ${Number(c.balance).toLocaleString()})` : ''}
                  </option>
                ))}
              </select>

              {selectedCustomerObj && Number(selectedCustomerObj.balance) > 0 && (
                <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-mono font-bold text-[11px] whitespace-nowrap">
                  Debt: KES {Number(selectedCustomerObj.balance).toLocaleString()}
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(true)}
                className="p-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer"
                title="Quick Register Customer"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>
          )}

          <label className="flex items-center space-x-1.5 bg-amber-50/70 border border-amber-200/80 px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-900 cursor-pointer shadow-2xs">
            <input
              type="checkbox"
              checked={isETR}
              onChange={(e) => setIsETR(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>ETR</span>
          </label>

          {/* Parked Carts Trigger */}
          <button
            onClick={() => setShowParkedDrawer(true)}
            className={`flex items-center space-x-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer ${
              parkedCarts.length > 0
                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5 text-amber-600" />
            <span>Parked ({parkedCarts.length})</span>
          </button>
        </div>
      </div>

      {/* Main Cashier Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-0 items-stretch">
        {/* Left: Product Search, Category Pills & Catalog Grid (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 space-y-2.5">
          {/* Quick Search Bar */}
          <div className="relative shrink-0">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product name or scan barcode / SKU (F2)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && products.length > 0) {
                  handleAddToCart(products[0]);
                }
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 shadow-2xs font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs shrink-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Items
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-amber-600 text-white shadow-2xs border border-amber-600'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Cards Grid with Dedicated Inner Scroll */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {productsLoading && products.length === 0 ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <div key={`skel-${idx}`} className="rounded-2xl border border-slate-100 bg-white p-3.5 space-y-3 animate-pulse shadow-2xs">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                    <div className="h-6 bg-slate-100 rounded-lg w-full" />
                    <div className="h-8 bg-slate-200 rounded-xl w-full" />
                  </div>
                ))
              ) : products.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 space-y-2">
                  <Search className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-medium">No products found matching your search</p>
                  <p className="text-[11px] text-slate-400">Try changing categories or clearing search keywords</p>
                </div>
              ) : (
              products.map(p => {
                const cartItem = cart.find(i => i.product.id === p.id);
                const isRoll = p.unit_type === 'roll';
                const isOutOfStock = (Number(p.current_stock) || 0) <= 0;

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-3.5 flex flex-col justify-between transition-all duration-150 shadow-2xs ${
                      cartItem
                        ? 'border-amber-500 bg-amber-50/30 ring-1 ring-amber-400'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Card Header: Product Name + Cart Counter */}
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug">
                          {p.name}
                        </h4>
                        {cartItem && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black">
                            {cartItem.unit_sold === 'roll' ? `${cartItem.rolls_qty}r` : `${cartItem.quantity}`}
                          </span>
                        )}
                      </div>

                      {/* Stock & Cost Meta Row */}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
                        {renderStockBadge(p)}
                        <span className="text-[10px] text-slate-400 font-mono tracking-tight" title="Buying Price Margin Floor">
                          BP: {Number(p.cost_price).toLocaleString()}
                        </span>
                      </div>

                      {/* Price Section */}
                      <div className="mt-2.5">
                        <div className="text-sm font-black text-slate-900 font-mono">
                          KES {Number(p.selling_price).toLocaleString()}
                        </div>
                        {isRoll && p.price_per_meter && (
                          <div className="text-[10px] text-amber-700 font-medium font-mono">
                            KES {Number(p.price_per_meter).toFixed(0)}/meter
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button: Dual Mode for Roll Products */}
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      {isRoll ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => handleAddToCart(p, false)}
                            className="py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs active:scale-95 text-center"
                          >
                            + Roll
                          </button>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => handleAddToCart(p, true)}
                            className="py-1.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 disabled:opacity-40 text-sky-800 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs active:scale-95 text-center"
                          >
                            + Meters
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => handleAddToCart(p)}
                          className="w-full py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs flex items-center justify-center space-x-1.5 active:scale-95"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add to Cart</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Loading More Spinner */}
            {productsLoadingMore && (
              <div className="col-span-full py-3 flex items-center justify-center space-x-2 text-xs text-amber-600 font-bold bg-amber-50/50 rounded-xl border border-amber-100">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <span>Loading more products...</span>
              </div>
            )}

            {/* Intersection Observer Sentinel */}
            <div ref={productsSentinelRef} className="h-4 w-full col-span-full" />

            {/* End of Products Indicator */}
            {/* End of Products Indicator */}
            {!productsHasMore && products.length > 0 && (
              <div className="col-span-full py-2 text-center text-[11px] text-slate-400 font-medium">
                Showing all {products.length} products
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Right: Cart & Tender Settlement Console (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-0">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col h-full min-h-0">
            {/* Dark Slate Cart Header */}
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <div className="h-6 w-6 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950">
                  <ShoppingCart className="h-3.5 w-3.5 fill-slate-950" />
                </div>
                <span className="font-bold text-xs">Active Cart</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 text-[10px] font-mono font-bold">
                  {cart.length} {cart.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {cart.length > 0 && (
                  <>
                    <button
                      onClick={handleParkCart}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] transition-colors cursor-pointer border border-slate-700"
                      title="Save cart on hold (F4)"
                    >
                      <Bookmark className="h-3 w-3" />
                      <span>Park</span>
                    </button>
                    <button
                      onClick={() => setCart([])}
                      className="text-[11px] text-rose-300 hover:text-rose-100 font-bold transition-colors cursor-pointer px-1.5 py-0.5"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="p-3 divide-y divide-slate-100 flex-1 min-h-0 overflow-y-auto space-y-2.5">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <ShoppingCart className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-medium">Your cashier cart is empty</p>
                  <p className="text-[10px] text-slate-400">Click products or press F2 to scan and add items</p>
                </div>
              ) : (
                cart.map(item => {
                  const isRoll = item.product.unit_type === 'roll';
                  const mpr = Number(item.product.meters_per_roll) || 100;
                  const isBelowBP = item.unit_price < Number(item.product.cost_price);
                  const isOverStock = item.quantity > Number(item.product.current_stock || 0);

                  return (
                    <div key={item.product.id} className="pt-2.5 first:pt-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                            <span>{item.product.name}</span>
                            {isRoll && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200">
                                {item.unit_sold === 'meter' ? 'Loose Meters' : 'Roll'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Available: {item.product.formatted_stock}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Controls: Quantity Stepper & Price Input */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        {isRoll ? (
                          <div className="flex items-center space-x-1.5">
                            {/* Segmented Switcher */}
                            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => handleSwitchUnitSold(item, 'roll')}
                                className={`px-2 py-0.5 rounded cursor-pointer ${
                                  item.unit_sold === 'roll'
                                    ? 'bg-white text-slate-900 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                Roll
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchUnitSold(item, 'meter')}
                                className={`px-2 py-0.5 rounded cursor-pointer ${
                                  item.unit_sold === 'meter'
                                    ? 'bg-white text-slate-900 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                Meters
                              </button>
                            </div>

                            {/* Quantity Input */}
                            {item.unit_sold === 'roll' ? (
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.rolls_qty > 1) {
                                      handleUpdateItem(item.product.id, i => ({
                                        ...i,
                                        rolls_qty: i.rolls_qty - 1,
                                        quantity: (i.rolls_qty - 1) * mpr
                                      }));
                                    }
                                  }}
                                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={item.rolls_qty === 0 ? '' : item.rolls_qty}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const r = val === '' ? 0 : parseInt(val, 10) || 0;
                                    handleUpdateItem(item.product.id, i => ({
                                      ...i,
                                      rolls_qty: r,
                                      loose_meters: 0,
                                      quantity: r * mpr
                                    }));
                                  }}
                                  className="w-10 rounded border border-slate-300 px-1 py-0.5 text-center font-mono text-xs focus:outline-none focus:border-amber-600 font-bold"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateItem(item.product.id, i => ({
                                      ...i,
                                      rolls_qty: (i.rolls_qty || 0) + 1,
                                      quantity: ((i.rolls_qty || 0) + 1) * mpr
                                    }));
                                  }}
                                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.quantity === 0 ? '' : item.quantity}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const q = val === '' ? 0 : parseFloat(val) || 0;
                                    handleUpdateItem(item.product.id, i => ({
                                      ...i,
                                      quantity: q,
                                      loose_meters: q,
                                      rolls_qty: 0
                                    }));
                                  }}
                                  className="w-14 rounded border border-slate-300 px-1 py-0.5 text-center font-mono text-xs focus:outline-none focus:border-amber-600 font-bold"
                                />
                                <span className="text-[10px] text-slate-500 font-medium">m</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => {
                                if (item.quantity > 1) {
                                  handleUpdateItem(item.product.id, i => ({ ...i, quantity: i.quantity - 1 }));
                                } else {
                                  handleRemoveFromCart(item.product.id);
                                }
                              }}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                const q = val === '' ? 0 : parseFloat(val) || 0;
                                handleUpdateItem(item.product.id, i => ({ ...i, quantity: q }));
                              }}
                              className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center font-mono text-xs focus:outline-none focus:border-amber-600 font-bold"
                            />
                            <button
                              onClick={() => handleUpdateItem(item.product.id, i => ({ ...i, quantity: (i.quantity || 0) + 1 }))}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        {/* Unit Price & Line Total */}
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.unit_price === 0 ? '' : item.unit_price}
                            onChange={(e) => {
                              const val = e.target.value;
                              const p = val === '' ? 0 : parseFloat(val) || 0;
                              handleUpdateItem(item.product.id, i => ({ ...i, unit_price: p }));
                            }}
                            className={`w-18 rounded border px-1.5 py-0.5 text-right font-mono text-xs focus:outline-none ${
                              isBelowBP
                                ? 'border-rose-400 bg-rose-50/50 text-rose-800'
                                : 'border-slate-300 focus:border-amber-600'
                            }`}
                            title={item.unit_sold === 'roll' ? "Price per roll" : `Price per ${item.unit_sold}`}
                          />
                          <span className="font-black text-xs text-slate-950 font-mono w-20 text-right">
                            KES {Number(item.line_total).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {isOverStock && (
                        <div className="flex items-center space-x-1 text-[10px] text-rose-600 font-bold">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Exceeds stock ({item.product.formatted_stock})</span>
                        </div>
                      )}

                      {isBelowBP && !isOverStock && (
                        <div className="flex items-center space-x-1 text-[10px] text-amber-600 font-semibold">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Price below cost (BP: KES {Number(item.product.cost_price).toLocaleString()})</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Financial Summary & Settlement Box */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2.5 shrink-0 overflow-y-auto max-h-[50vh]">
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">
                    KES {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Discount Control */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Percent className="h-3 w-3 text-slate-400" />
                    <span>Discount:</span>
                    <div className="flex items-center rounded border border-slate-300 bg-white text-[10px] ml-1 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={`px-1.5 py-0.2 font-bold cursor-pointer ${discountType === 'fixed' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                      >
                        KES
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        className={`px-1.5 py-0.2 font-bold cursor-pointer ${discountType === 'percent' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                      >
                        %
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="w-16 rounded border border-slate-300 bg-white px-2 py-0.5 text-right font-mono text-xs focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>

                <div className="flex justify-between text-base font-black text-slate-950 pt-2 border-t border-slate-200">
                  <span>NET TOTAL:</span>
                  <span className="font-mono text-amber-700">
                    KES {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Site / Project Location & Narrative Input */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-amber-600" />
                    <span>Site / Project / Narrative:</span>
                  </span>
                  {siteName && (
                    <button
                      type="button"
                      onClick={() => setSiteName('')}
                      className="text-[10px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Autocomplete recent site tags for selected customer */}
                {customerSites.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Recent Sites:</span>
                    {customerSites.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSiteName(s)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                          siteName === s
                            ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                        }`}
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="e.g. Kilifi Beach Villa - Main DB (optional)"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-amber-600 focus:bg-white"
                />

                {/* Expandable Internal Notes */}
                <div className="pt-0.5">
                  {!showNotesField && !notes ? (
                    <button
                      type="button"
                      onClick={() => setShowNotesField(true)}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      <span>Add internal sale note</span>
                    </button>
                  ) : (
                    <textarea
                      placeholder="Internal sale note (optional)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={1}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:border-amber-600 focus:bg-white resize-none"
                    />
                  )}
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-700">Tender Method:</span>
                <div className="flex items-center space-x-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setIsSplitMode(false)}
                    className={`px-2 py-1 rounded font-bold cursor-pointer transition-all ${
                      !isSplitMode ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSplitMode(true)}
                    className={`px-2 py-1 rounded font-bold cursor-pointer flex items-center space-x-1 transition-all ${
                      isSplitMode ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Split className="h-3 w-3" />
                    <span>Split Payment</span>
                  </button>
                </div>
              </div>

              {/* Single Mode Controls */}
              {!isSplitMode ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'mpesa', label: 'M-Pesa', icon: Smartphone },
                      { id: 'bank', label: 'Bank', icon: Landmark },
                      { id: 'credit', label: 'Credit', icon: FileText },
                      { id: 'card', label: 'Card', icon: CreditCard },
                    ].map(m => {
                      const Icon = m.icon;
                      const isSelected = paymentMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="h-4 w-4 mb-0.5" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {paymentMethod === 'cash' ? (
                    <div className="space-y-2 pt-1">
                      {/* Cash Input & Change */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Tendered Cash:</span>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Amount"
                            value={amountTendered}
                            onChange={(e) => setAmountTendered(e.target.value)}
                            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs focus:outline-none focus:border-amber-600 font-bold"
                          />
                          {singleCashChange > 0 && (
                            <span className="text-emerald-700 font-black font-mono text-xs">
                              Change: KES {singleCashChange.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  ) : paymentMethod === 'credit' ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium flex items-center space-x-1.5">
                      <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
                      <span>Full sale billed to selected customer's account receivable balance.</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Payment Reference (M-Pesa code, EFT ref, Card Auth)"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                    />
                  )}
                </div>
              ) : (
                /* Split Mode Rows */
                <div className="space-y-2">
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {splitLines.map((line) => (
                      <div key={line.id} className="p-2 bg-white rounded-xl border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <select
                            value={line.payment_method}
                            onChange={(e) => handleUpdateSplitLine(line.id, 'payment_method', e.target.value)}
                            className="rounded-lg border border-slate-300 bg-slate-50 p-1 text-xs font-bold text-slate-800"
                          >
                            <option value="mpesa">M-Pesa</option>
                            <option value="cash">Cash</option>
                            <option value="bank">Bank / EFT</option>
                            <option value="card">Card</option>
                          </select>

                          <div className="flex items-center space-x-1 flex-1">
                            <span className="text-[10px] text-slate-400 font-mono">KES</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Amount"
                              value={line.amount}
                              onChange={(e) => handleUpdateSplitLine(line.id, 'amount', e.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-right font-mono text-xs font-bold focus:outline-none focus:border-amber-600"
                            />
                          </div>

                          {splitLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSplitLine(line.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {line.payment_method !== 'cash' && (
                          <input
                            type="text"
                            placeholder="Ref code (e.g. QKH7129JK)"
                            value={line.reference}
                            onChange={(e) => handleUpdateSplitLine(line.id, 'reference', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] focus:outline-none focus:border-amber-600"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSplitLine}
                    className="flex items-center space-x-1 text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Add Payment Tender Line</span>
                  </button>

                  {/* Split Totals */}
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-slate-700">
                      <span>Total Tendered:</span>
                      <span className="font-bold">KES {totalSplitTendered.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {splitBalanceDue > 0 ? (
                      <div className="flex justify-between text-rose-700 font-bold">
                        <span>Balance to Credit Debt:</span>
                        <span>KES {splitBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ) : splitExcessCash > 0 ? (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Cash Change:</span>
                        <span>KES {splitExcessCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Fully Settled</span>
                        <span>KES 0.00</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Credit Guardrail Notice */}
              {((isSplitMode && splitBalanceDue > 0) || (!isSplitMode && paymentMethod === 'credit')) && isWalkIn && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center space-x-1.5">
                  <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>Credit or partial sales require selecting an Account Customer above.</span>
                </div>
              )}

              {checkoutError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center space-x-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* High-Impact Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={
                  checkingOut || 
                  cart.length === 0 || 
                  (((isSplitMode && splitBalanceDue > 0) || (!isSplitMode && paymentMethod === 'credit')) && isWalkIn)
                }
                className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-sm transition-all shadow-md cursor-pointer active:scale-[0.98]"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{checkingOut ? 'Completing Transaction...' : `Complete Checkout (KES ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })})`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Customer Creation Modal */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Quick Register Customer</h3>
            <form onSubmit={handleCreateQuickCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. John Doe / Green Solar Ltd"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Phone Number (Optional)</label>
                <input
                  type="text"
                  placeholder="+254 7..."
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingQuickCust}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                >
                  {creatingQuickCust ? 'Saving...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Parked Carts Modal */}
      {showParkedDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Bookmark className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Parked Carts ({parkedCarts.length})
                </h3>
              </div>
              <button
                onClick={() => setShowParkedDrawer(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100">
              {parkedCarts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No parked carts stored. Click "Park" to hold a sale.
                </div>
              ) : (
                parkedCarts.map(c => (
                  <div key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{new Date(c.parked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                        <span>•</span>
                        <span className="font-mono font-bold text-amber-700">KES {c.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleResumeCart(c)}
                        className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-2xs transition-all"
                      >
                        <Play className="h-3 w-3" />
                        <span>Resume</span>
                      </button>
                      <button
                        onClick={() => handleDeleteParkedCart(c.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 80mm Receipt Modal */}
      <ReceiptModal
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />
    </div>
  );
};


