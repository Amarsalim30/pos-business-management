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
  Percent
} from 'lucide-react';

interface CartItem {
  product: Product;
  unit_sold: 'piece' | 'roll' | 'meter';
  rolls_qty: number;
  loose_meters: number;
  quantity: number; // base units
  unit_price: number; // selling price per piece or per roll
  line_total: number;
}

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
  
  // Checkout & Printing State
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Search Input Ref for quick autofocus
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
    loadCustomers();
    searchInputRef.current?.focus();
  }, []);

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

  // Filter products by search
  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  }).slice(0, 8); // Top 8 fast results

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

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        if (product.unit_type === 'roll') {
          const updated = {
            ...existing,
            rolls_qty: existing.rolls_qty + 1,
            quantity: existing.quantity + (Number(product.meters_per_roll) || 100),
          };
          updated.line_total = computeLineTotal(updated);
          return prev.map(i => i.product.id === product.id ? updated : i);
        } else {
          const updated = {
            ...existing,
            quantity: existing.quantity + 1,
          };
          updated.line_total = computeLineTotal(updated);
          return prev.map(i => i.product.id === product.id ? updated : i);
        }
      }

      // New line item
      const isRoll = product.unit_type === 'roll';
      const mpr = Number(product.meters_per_roll) || 100;
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
    searchInputRef.current?.focus();
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

  // Cart Totals
  const subtotal = cart.reduce((acc, item) => acc + item.line_total, 0);
  const discount = Math.max(0, parseFloat(discountAmount) || 0);
  const total = Math.max(0, subtotal - discount);
  const tendered = parseFloat(amountTendered) || 0;
  const change = paymentMethod === 'cash' && tendered > total ? tendered - total : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'credit' && (!selectedCustomerId || isWalkIn)) {
      setCheckoutError('Please select a customer for credit sales');
      return;
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
      // Reset cart and inputs
      setCart([]);
      setDiscountAmount('0');
      setPaymentReference('');
      setNotes('');
      setAmountTendered('');
      loadProducts(); // Refresh live stock balances
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Fast Settings */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Cashier POS Terminal
            </h1>
            <p className="text-xs text-slate-500">
              Quick product lookup, flexible pricing, and instant 80mm thermal receipt printing
            </p>
          </div>
        </div>

        {/* Customer & ETR Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setIsWalkIn(true)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isWalkIn ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Walk-in Customer
            </button>
            <button
              onClick={() => setIsWalkIn(false)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isWalkIn ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Registered Account
            </button>
          </div>

          {!isWalkIn && (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 shadow-xs"
            >
              <option value="">-- Select Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''} — Debt: KES {Number(c.balance).toLocaleString()}
                </option>
              ))}
            </select>
          )}

          <label className="flex items-center space-x-2 bg-amber-50/60 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={isETR}
              onChange={(e) => setIsETR(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>ETR Fiscal Invoice</span>
          </label>
        </div>
      </div>

      {/* Main Cashier Workspace (Split View) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Product Search & Fast Catalog (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Instant Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product name or scan barcode / SKU (Type to search)..."
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

          {/* Search Quick Dropdown */}
          {searchQuery && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No products matching "{searchQuery}"
                </div>
              ) : (
                filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    className="w-full p-3 text-left flex items-center justify-between hover:bg-amber-50/50 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {p.sku ? `SKU: ${p.sku} • ` : ''}Stock: {p.formatted_stock || `${p.current_stock} ${p.unit}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xs text-slate-900 font-mono">
                        KES {Number(p.selling_price).toLocaleString()}
                      </div>
                      <span className="text-[10px] text-amber-700 font-semibold uppercase">
                        + Add
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Quick Item Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.slice(0, 12).map(p => {
              const inCart = cart.find(i => i.product.id === p.id);
              const isRoll = p.unit_type === 'roll';
              return (
                <button
                  key={p.id}
                  onClick={() => handleAddToCart(p)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98] ${
                    inCart
                      ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
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

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="font-extrabold text-xs text-slate-900 font-mono">
                      KES {Number(p.selling_price).toLocaleString()}
                    </span>
                    {inCart && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        {inCart.quantity} {isRoll ? 'm' : 'pcs'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Cart, Editable Pricing, & Checkout Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-4 w-4 text-amber-400" />
                <span className="font-bold text-xs tracking-tight">Active Cart ({cart.length} items)</span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-rose-300 hover:text-rose-100 font-bold transition-colors cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="p-4 divide-y divide-slate-100 max-h-[380px] overflow-y-auto space-y-3">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <ShoppingCart className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs">Your cashier cart is empty</p>
                  <p className="text-[10px] text-slate-400">Click products or search above to add items</p>
                </div>
              ) : (
                cart.map(item => {
                  const isRoll = item.product.unit_type === 'roll';
                  const mpr = Number(item.product.meters_per_roll) || 100;
                  const isBelowBP = item.unit_price < Number(item.product.cost_price);

                  return (
                    <div key={item.product.id} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-xs text-slate-900">{item.product.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cost BP: KES {Number(item.product.cost_price).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Quantity & Roll Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {isRoll ? (
                          <div className="flex items-center space-x-1.5 text-xs">
                            <input
                              type="number"
                              min="0"
                              value={item.rolls_qty}
                              onChange={(e) => {
                                const r = parseInt(e.target.value, 10) || 0;
                                handleUpdateItem(item.product.id, i => ({
                                  ...i,
                                  rolls_qty: r,
                                  quantity: (r * mpr) + i.loose_meters
                                }));
                              }}
                              className="w-14 rounded border border-slate-300 px-1.5 py-1 text-center font-mono text-xs focus:outline-none focus:border-amber-600"
                              title="Full rolls"
                            />
                            <span className="text-[10px] text-slate-400 font-bold">rolls +</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={item.loose_meters}
                              onChange={(e) => {
                                const l = parseFloat(e.target.value) || 0;
                                handleUpdateItem(item.product.id, i => ({
                                  ...i,
                                  loose_meters: l,
                                  quantity: (i.rolls_qty * mpr) + l
                                }));
                              }}
                              className="w-16 rounded border border-slate-300 px-1.5 py-1 text-center font-mono text-xs focus:outline-none focus:border-amber-600"
                              title="Loose meters"
                            />
                            <span className="text-[10px] text-slate-400 font-bold">m</span>
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
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const q = Math.max(1, parseFloat(e.target.value) || 1);
                                handleUpdateItem(item.product.id, i => ({ ...i, quantity: q }));
                              }}
                              className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center font-mono text-xs focus:outline-none focus:border-amber-600"
                            />
                            <button
                              onClick={() => handleUpdateItem(item.product.id, i => ({ ...i, quantity: i.quantity + 1 }))}
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
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => {
                                const p = parseFloat(e.target.value) || 0;
                                handleUpdateItem(item.product.id, i => ({ ...i, unit_price: p }));
                              }}
                              className={`w-20 rounded border px-1.5 py-1 text-right font-mono text-xs focus:outline-none ${
                                isBelowBP
                                  ? 'border-rose-400 bg-rose-50/50 text-rose-800 focus:border-rose-600'
                                  : 'border-slate-300 focus:border-amber-600'
                              }`}
                              title={isRoll ? "Selling price per roll" : "Selling price per piece"}
                            />
                          </div>
                          <span className="font-extrabold text-xs text-slate-900 font-mono w-20 text-right">
                            KES {Number(item.line_total).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {isBelowBP && (
                        <div className="flex items-center space-x-1 text-[10px] text-rose-600 font-semibold">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Price below cost (BP: KES {Number(item.product.cost_price).toLocaleString()})</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Payment & Summary Drawer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
              {/* Calculations */}
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
                      type="number"
                      min="0"
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

              {/* Reference / Cash Tendered */}
              {paymentMethod === 'cash' ? (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-600 font-medium">Tendered Cash:</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
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

              {/* Complete Checkout Button */}
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

      {/* 80mm Receipt Modal */}
      <ReceiptModal
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />
    </div>
  );
};
