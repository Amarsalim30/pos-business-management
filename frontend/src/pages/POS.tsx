import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import type { Product, Customer, Sale } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
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
  Layers,
  Percent,
  Bookmark,
  Play,
  Clock,
  Keyboard,
  UserPlus
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
  notes: string;
  total: number;
}

const LOCAL_STORAGE_PARKED_KEY = 'pos_parked_carts';

export const POSPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [isETR, setIsETR] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card' | 'bank' | 'credit'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [amountTendered, setAmountTendered] = useState('');
  
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

  // Initial Load only (no dependencies to prevent refocus bugs on state edits)
  useEffect(() => {
    loadProducts();
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

  const loadProducts = async () => {
    try {
      const data = await apiFetch<Product[]>('/api/v1/products/');
      setProducts(data);
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

  // Filter products by search
  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  }).slice(0, 8);

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

  // Strict 1-row per product: Add to Cart always finds by product.id
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

  // Switch selling mode between Roll and Loose Meters directly in the cart
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

  // Cart Totals
  const subtotal = cart.reduce((acc, item) => acc + item.line_total, 0);
  const discount = Math.max(0, parseFloat(discountAmount) || 0);
  const total = Math.max(0, subtotal - discount);
  const tendered = parseFloat(amountTendered) || 0;
  const change = paymentMethod === 'cash' && tendered > total ? tendered - total : 0;

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
      discount_amount: discountAmount,
      is_etr: isETR,
      notes: notes,
      total: total
    };

    saveParkedCartsToStorage([newParkedCart, ...parkedCarts]);
    setCart([]);
    setDiscountAmount('0');
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
    if (paymentMethod === 'credit' && (!selectedCustomerId || isWalkIn)) {
      setCheckoutError('Please select or register a customer for credit sales');
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

    const payload = {
      customer_id: !isWalkIn && selectedCustomerId ? Number(selectedCustomerId) : null,
      payment_method: paymentMethod,
      payment_reference: paymentReference.trim() || null,
      discount_amount: discount,
      is_etr: isETR,
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

    try {
      const sale = await apiFetch<Sale>('/api/v1/sales/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setCompletedSale(sale);
      setCart([]);
      setDiscountAmount('0');
      setPaymentReference('');
      setNotes('');
      setAmountTendered('');
      loadProducts();
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Cashier POS Terminal
              </h1>
              <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono border border-slate-200">
                <Keyboard className="h-3 w-3" />
                <span>F2: Search • F4: Park</span>
              </span>
              {parkedCarts.length > 0 && (
                <button
                  onClick={() => setShowParkedDrawer(true)}
                  className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-bold text-[10px] hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  <Bookmark className="h-3 w-3 text-amber-700" />
                  <span>{parkedCarts.length} Parked</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              High-speed checkout with smart stock deduction and 80mm thermal receipts
            </p>
          </div>
        </div>

        {/* Customer & ETR Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setIsWalkIn(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isWalkIn ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Walk-in
            </button>
            <button
              onClick={() => setIsWalkIn(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isWalkIn ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Account
            </button>
          </div>

          {!isWalkIn && (
            <div className="flex items-center space-x-1.5">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 shadow-xs max-w-[200px]"
              >
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} — Debt: KES {Number(c.balance).toLocaleString()}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(true)}
                className="p-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer"
                title="Quick Register New Customer"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>
          )}

          <label className="flex items-center space-x-2 bg-amber-50/60 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={isETR}
              onChange={(e) => setIsETR(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>ETR Fiscal</span>
          </label>

          {/* Parked Carts Button */}
          <button
            onClick={() => setShowParkedDrawer(true)}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
          >
            <Bookmark className="h-3.5 w-3.5 text-amber-600" />
            <span>Parked ({parkedCarts.length})</span>
          </button>
        </div>
      </div>

      {/* Main Cashier Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Search & Catalog */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product name or scan barcode / SKU (F2)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredProducts.length > 0) {
                  handleAddToCart(filteredProducts[0]);
                }
              }}
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 shadow-xs"
            />
          </div>

          {/* Search Dropdown */}
          {searchQuery && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No products matching "{searchQuery}"
                </div>
              ) : (
                filteredProducts.map(p => (
                  <div
                    key={p.id}
                    className="p-3 flex items-center justify-between hover:bg-amber-50/50 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {p.sku ? `SKU: ${p.sku} • ` : ''}Stock: {p.formatted_stock || `${p.current_stock} ${p.unit}`}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {p.unit_type === 'roll' ? (
                        <>
                          <button
                            onClick={() => handleAddToCart(p, false)}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs cursor-pointer shadow-2xs"
                          >
                            + Roll (KES {Number(p.selling_price).toLocaleString()})
                          </button>
                          <button
                            onClick={() => handleAddToCart(p, true)}
                            className="px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold text-xs cursor-pointer shadow-2xs"
                          >
                            + Meters
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(p)}
                          className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer shadow-2xs"
                        >
                          + Add (KES {Number(p.selling_price).toLocaleString()})
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Catalog Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.slice(0, 12).map(p => {
              const inCart = cart.find(i => i.product.id === p.id);
              const isRoll = p.unit_type === 'roll';
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all shadow-2xs ${
                    inCart
                      ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-500'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-bold text-xs text-slate-900 line-clamp-2 leading-tight">
                        {p.name}
                      </h4>
                      {isRoll && (
                        <span className="shrink-0 p-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[9px] font-bold">
                          <Layers className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      {p.formatted_stock || `${p.current_stock} in stock`}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <div className="font-extrabold text-xs text-slate-900 font-mono mb-2">
                      KES {Number(p.selling_price).toLocaleString()}
                    </div>
                    
                    {isRoll ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handleAddToCart(p, false)}
                          className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          + Roll
                        </button>
                        <button
                          onClick={() => handleAddToCart(p, true)}
                          className="px-2 py-1 rounded bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 text-[10px] font-bold cursor-pointer"
                        >
                          + Meter
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddToCart(p)}
                        className="w-full py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        Add to Cart
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Cart & Checkout Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-4 w-4 text-amber-400" />
                <span className="font-bold text-xs tracking-tight">Active Cart ({cart.length} items)</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {cart.length > 0 && (
                  <>
                    <button
                      onClick={handleParkCart}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] transition-colors cursor-pointer border border-slate-700"
                      title="Save cart (F4)"
                    >
                      <Bookmark className="h-3 w-3" />
                      <span>Park (F4)</span>
                    </button>
                    <button
                      onClick={() => setCart([])}
                      className="text-[11px] text-rose-300 hover:text-rose-100 font-bold transition-colors cursor-pointer p-1"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="p-4 divide-y divide-slate-100 max-h-[380px] overflow-y-auto space-y-3">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <ShoppingCart className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-medium">Your cashier cart is empty</p>
                  <p className="text-[10px] text-slate-400">Click products or press F2 to search items</p>
                </div>
              ) : (
                cart.map(item => {
                  const isRoll = item.product.unit_type === 'roll';
                  const mpr = Number(item.product.meters_per_roll) || 100;
                  const isBelowBP = item.unit_price < Number(item.product.cost_price);
                  const isOverStock = item.quantity > Number(item.product.current_stock || 0);

                  return (
                    <div key={item.product.id} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                            <span>{item.product.name}</span>
                            {isRoll && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200">
                                {item.unit_sold === 'meter' ? 'Loose Meters' : 'Full Roll'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Stock: {item.product.formatted_stock}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Quantity & Unit Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {isRoll ? (
                          <div className="flex items-center space-x-2">
                            {/* Segmented Switcher */}
                            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-bold">
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
                                  className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center font-mono text-xs focus:outline-none focus:border-amber-600 font-bold"
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
                                  className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-center font-mono text-xs focus:outline-none focus:border-amber-600 font-bold"
                                />
                                <span className="text-[11px] text-slate-500 font-medium">m</span>
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

                        {/* Editable Selling Price */}
                        <div className="flex items-center space-x-1.5">
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.unit_price === 0 ? '' : item.unit_price}
                              onChange={(e) => {
                                const val = e.target.value;
                                const p = val === '' ? 0 : parseFloat(val) || 0;
                                handleUpdateItem(item.product.id, i => ({ ...i, unit_price: p }));
                              }}
                              className={`w-20 rounded border px-1.5 py-1 text-right font-mono text-xs focus:outline-none ${
                                isBelowBP
                                  ? 'border-rose-400 bg-rose-50/50 text-rose-800 focus:border-rose-600'
                                  : 'border-slate-300 focus:border-amber-600'
                              }`}
                              title={item.unit_sold === 'roll' ? "Selling price per roll" : `Selling price per ${item.unit_sold}`}
                            />
                          </div>
                          <span className="font-extrabold text-xs text-slate-900 font-mono w-20 text-right">
                            KES {Number(item.line_total).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {isOverStock && (
                        <div className="flex items-center space-x-1 text-[10px] text-rose-600 font-bold">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Exceeds available stock ({item.product.formatted_stock})</span>
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

            {/* Payment Drawer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">KES {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <Percent className="h-3 w-3 text-slate-400" />
                    <span>Overall Discount:</span>
                  </span>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] text-slate-400">KES</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="w-20 rounded border border-slate-300 bg-white px-2 py-0.5 text-right font-mono text-xs focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                  <span>NET TOTAL:</span>
                  <span className="font-mono text-amber-700">KES {total.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700">Payment Method:</label>
                <div className="grid grid-cols-3 gap-1.5">
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
                        className={`flex items-center justify-center space-x-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {paymentMethod === 'cash' ? (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-600 font-medium">Tendered Cash:</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Amount"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs focus:outline-none focus:border-amber-600"
                    />
                    {change > 0 && (
                      <span className="text-emerald-700 font-bold font-mono text-[11px]">
                        Change: KES {change.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Payment Reference (Mpesa Code, Cheque #, etc.)"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              )}

              {checkoutError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center space-x-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={checkingOut || cart.length === 0}
                className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-md cursor-pointer active:scale-[0.98]"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{checkingOut ? 'Processing Checkout...' : `Complete Checkout (KES ${total.toLocaleString()})`}</span>
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
                  No parked carts stored. Click "Park Cart" to hold a sale.
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
                        <span className="font-mono font-bold text-amber-700">KES {c.total.toLocaleString()}</span>
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
