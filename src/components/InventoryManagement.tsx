import { useState, useMemo, useEffect } from 'react';
import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type InventoryItem, type SchoolExpense } from '../db/schema';
import { 
  Plus, 
  Trash2, 
  Package, 
  AlertTriangle, 
  DollarSign, 
  Layers, 
  Search, 
  Printer, 
  Edit2, 
  X, 
  PlusCircle, 
  MinusCircle, 
  TrendingUp, 
  MapPin, 
  PhoneCall, 
  Sparkles,
  RefreshCw,
  TrendingDown,
  CreditCard,
  FileText,
  Calendar,
  User,
  CheckCircle,
  HelpCircle,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, triggerPrint } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function InventoryManagement() {
  const { user: authUser } = useAuth();
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const schoolName = settings.find(s => s.key === 'schoolProfile')?.value?.schoolName || 'ESEPA INTERNATIONAL SCHOOL';

  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState<'registry' | 'expenses'>('registry');

  // ---------- TAB 1: STOCK REGISTRY STATE ----------
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);

  // Form Fields for Stock Item
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<'Stationery' | 'Textbooks' | 'Uniforms' | 'Furniture' | 'Sports Gear' | 'Lab Equipment' | 'General'>('General');
  const [quantity, setQuantity] = useState(0);
  const [minQuantity, setMinQuantity] = useState(10);
  const [unitPrice, setUnitPrice] = useState(0);
  const [location, setLocation] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');

  // Fetch Inventory Items
  const inventoryList = useLiveQuery(() => db.inventory.toArray()) || [];

  // ---------- TAB 2: EXPENSES STATE ----------
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('All');
  const [expensePaymentFilter, setExpensePaymentFilter] = useState<string>('All');
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);

  // Form Fields for Expense
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<'Inventory Restock' | 'Utilities' | 'Maintenance' | 'Salaries' | 'Administrative' | 'Events' | 'Other'>('Administrative');
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [selectedItemIdForRestock, setSelectedItemIdForRestock] = useState<number | null>(null);
  const [restockQuantity, setRestockQuantity] = useState(1);
  const [restockUnitPrice, setRestockUnitPrice] = useState(0);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'Mobile Money' | 'Cheque'>('Mobile Money');
  const [expenseRecordedBy, setExpenseRecordedBy] = useState('');

  // Fetch Expenses
  const expensesList = useLiveQuery(() => db.expenses.toArray()) || [];

  // Set default recorder when expense modal opens
  useEffect(() => {
    if (isExpenseFormOpen && authUser?.fullName) {
      setExpenseRecordedBy(authUser.fullName);
    }
  }, [isExpenseFormOpen, authUser]);

  // Select first stock item for restock dropdown when selection changes
  useEffect(() => {
    if (expenseCategory === 'Inventory Restock' && inventoryList.length > 0 && !selectedItemIdForRestock) {
      const firstItem = inventoryList[0];
      setSelectedItemIdForRestock(firstItem.id || null);
      setRestockUnitPrice(firstItem.unitPrice);
    }
  }, [expenseCategory, inventoryList, selectedItemIdForRestock]);

  // Auto-update restock unit price when selected item changes
  const handleItemRestockChange = (itemId: number) => {
    setSelectedItemIdForRestock(itemId);
    const item = inventoryList.find(i => i.id === itemId);
    if (item) {
      setRestockUnitPrice(item.unitPrice);
    }
  };

  // Filter & Search Logic: Stock
  const filteredItems = useMemo(() => {
    const query = (searchQuery || '').toLowerCase().trim();
    return inventoryList.filter(item => {
      if (!item) return false;
      const itemName = (item.itemName || '').toLowerCase();
      const location = (item.location || '').toLowerCase();
      const matchesSearch = !query || itemName.includes(query) || location.includes(query);
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesLowStock = !showLowStockOnly || item.quantity <= item.minQuantity;
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [inventoryList, searchQuery, selectedCategory, showLowStockOnly]);

  // Filter & Search Logic: Expenses
  const filteredExpenses = useMemo(() => {
    const query = (expenseSearch || '').toLowerCase().trim();
    return expensesList.filter(exp => {
      if (!exp) return false;
      const desc = (exp.description || '').toLowerCase();
      const rec = (exp.recordedBy || '').toLowerCase();
      const matchesSearch = !query || desc.includes(query) || rec.includes(query);
      const matchesCategory = expenseCategoryFilter === 'All' || exp.category === expenseCategoryFilter;
      const matchesPayment = expensePaymentFilter === 'All' || exp.paymentMethod === expensePaymentFilter;
      return matchesSearch && matchesCategory && matchesPayment;
    }).sort((a, b) => (b.date || 0) - (a.date || 0));
  }, [expensesList, expenseSearch, expenseCategoryFilter, expensePaymentFilter]);

  // Aggregate Metrics: Stock Registry
  const stockMetrics = useMemo(() => {
    let totalItems = 0;
    let totalAssetValue = 0;
    let lowStockCount = 0;

    inventoryList.forEach(item => {
      totalItems += item.quantity;
      totalAssetValue += item.quantity * item.unitPrice;
      if (item.quantity <= item.minQuantity) {
        lowStockCount++;
      }
    });

    return {
      totalUniqueItems: inventoryList.length,
      totalItems,
      totalAssetValue,
      lowStockCount
    };
  }, [inventoryList]);

  // Aggregate Metrics: Expenses
  const expenseMetrics = useMemo(() => {
    let totalSpent = 0;
    let restockSpent = 0;
    let overheadSpent = 0;
    const methodCounts: Record<string, number> = {};

    expensesList.forEach(exp => {
      totalSpent += exp.amount;
      if (exp.category === 'Inventory Restock') {
        restockSpent += exp.amount;
      } else {
        overheadSpent += exp.amount;
      }
      methodCounts[exp.paymentMethod] = (methodCounts[exp.paymentMethod] || 0) + 1;
    });

    let topPaymentMethod = 'N/A';
    let maxCount = 0;
    Object.entries(methodCounts).forEach(([method, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topPaymentMethod = method;
      }
    });

    return {
      totalSpent,
      restockSpent,
      overheadSpent,
      topPaymentMethod
    };
  }, [expensesList]);

  // Form Reset: Stock
  const resetForm = () => {
    setItemName('');
    setCategory('General');
    setQuantity(0);
    setMinQuantity(10);
    setUnitPrice(0);
    setLocation('');
    setSupplierName('');
    setSupplierPhone('');
    setIsEditing(null);
  };

  // Form Reset: Expense
  const resetExpenseForm = () => {
    setExpenseDescription('');
    setExpenseCategory('Administrative');
    setExpenseAmount(0);
    setSelectedItemIdForRestock(inventoryList[0]?.id || null);
    setRestockQuantity(1);
    setRestockUnitPrice(inventoryList[0]?.unitPrice || 0);
    setExpensePaymentMethod('Mobile Money');
  };

  // Submit Handler: Stock Item
  const handleSubmitStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || quantity < 0 || unitPrice < 0) return;

    const payload: Omit<InventoryItem, 'id'> = {
      itemName: itemName.trim(),
      category,
      quantity,
      minQuantity,
      unitPrice,
      location: location.trim() || 'General Storehouse',
      supplierName: supplierName.trim() || undefined,
      supplierPhone: supplierPhone.trim() || undefined,
      lastUpdated: Date.now()
    };

    if (isEditing !== null) {
      await db.inventory.update(isEditing, payload);
    } else {
      await db.inventory.add(payload);
    }

    resetForm();
    setIsFormOpen(false);
  };

  // Submit Handler: Expense / Stock Purchase
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (expenseCategory === 'Inventory Restock') {
      if (!selectedItemIdForRestock || restockQuantity <= 0 || restockUnitPrice < 0) {
        alert('Please fill out all stock purchase fields correctly.');
        return;
      }
      const targetItem = inventoryList.find(i => i.id === selectedItemIdForRestock);
      if (!targetItem) {
        alert('Selected inventory item not found.');
        return;
      }

      const totalCost = restockQuantity * restockUnitPrice;
      const desc = `Restocked ${restockQuantity}x ${targetItem.itemName}`;

      // 1. Add Expense record
      await db.expenses.add({
        description: desc,
        category: 'Inventory Restock',
        amount: totalCost,
        date: Date.now(),
        inventoryItemId: selectedItemIdForRestock,
        quantityPurchased: restockQuantity,
        paymentMethod: expensePaymentMethod,
        recordedBy: expenseRecordedBy.trim() || authUser?.fullName || 'Accountant'
      });

      // 2. Increment stock count
      await db.inventory.update(selectedItemIdForRestock, {
        quantity: targetItem.quantity + restockQuantity,
        lastUpdated: Date.now()
      });

    } else {
      // General overhead expense
      if (!expenseDescription.trim() || expenseAmount <= 0) {
        alert('Please specify an expense description and standard amount spent.');
        return;
      }

      await db.expenses.add({
        description: expenseDescription.trim(),
        category: expenseCategory,
        amount: expenseAmount,
        date: Date.now(),
        paymentMethod: expensePaymentMethod,
        recordedBy: expenseRecordedBy.trim() || authUser?.fullName || 'Accountant'
      });
    }

    resetExpenseForm();
    setIsExpenseFormOpen(false);
  };

  // Edit Trigger: Stock
  const handleEditStock = (item: InventoryItem) => {
    setIsEditing(item.id || null);
    setItemName(item.itemName);
    setCategory(item.category);
    setQuantity(item.quantity);
    setMinQuantity(item.minQuantity);
    setUnitPrice(item.unitPrice);
    setLocation(item.location);
    setSupplierName(item.supplierName || '');
    setSupplierPhone(item.supplierPhone || '');
    setIsFormOpen(true);
  };

  // Delete Action: Stock
  const handleDeleteStock = async (id: number) => {
    if (confirm('Are you sure you want to delete this inventory item? This action cannot be undone.')) {
      await db.inventory.delete(id);
    }
  };

  // Delete Action: Expense (with optional quantity rollback support)
  const handleDeleteExpense = async (id: number) => {
    const expense = expensesList.find(e => e.id === id);
    if (!expense) return;

    let confirmMsg = 'Are you sure you want to delete this expense record permanently?';
    if (expense.category === 'Inventory Restock' && expense.inventoryItemId) {
      confirmMsg = `This is a Stock Purchase expense of GHS ${expense.amount.toFixed(2)} for ${expense.quantityPurchased} units. Would you also like to automatically revert the stock addition (deduct ${expense.quantityPurchased} units from the inventory)?`;
    }

    const answer = confirm(confirmMsg);
    if (answer) {
      // If stock restock, optional rollback
      if (expense.category === 'Inventory Restock' && expense.inventoryItemId) {
        const item = await db.inventory.get(expense.inventoryItemId);
        if (item) {
          const newQty = Math.max(0, item.quantity - (expense.quantityPurchased || 0));
          await db.inventory.update(expense.inventoryItemId, {
            quantity: newQty,
            lastUpdated: Date.now()
          });
        }
      }
      await db.expenses.delete(id);
    }
  };

  // Quick Quantity Update (+ / -) in Stock registry directly
  const handleAdjustQuantity = async (id: number, currentQty: number, adjustment: number) => {
    const newQty = Math.max(0, currentQty + adjustment);
    await db.inventory.update(id, { 
      quantity: newQty,
      lastUpdated: Date.now() 
    });
  };

  // Selected item's details for rendering inside the purchase form preview
  const selectedRestockItemPreview = useMemo(() => {
    if (!selectedItemIdForRestock) return null;
    return inventoryList.find(i => i.id === selectedItemIdForRestock);
  }, [selectedItemIdForRestock, inventoryList]);

  return (
    <div className="space-y-6">
      {/* Print-Only Header */}
      <div className="only-print">
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter text-center">{schoolName}</h1>
        <div className="mt-2 text-sm font-bold text-slate-600 uppercase tracking-widest flex items-center justify-center gap-4">
          <span>{activeTab === 'registry' ? 'Official Assets & Resource Inventory' : 'Official School Expenses & Purchases Ledger'}</span>
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span>Date: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Main Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Assets & Finance Terminal</h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {activeTab === 'registry' 
              ? 'Manage school apparatus, textbooks, uniforms, furniture, and stationery resources.' 
              : 'Log and review overhead expenditures, utility bills, and integrated inventory restocking acquisitions.'}
          </p>
        </div>
        
        {/* Tab Selection Controls */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('registry')}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
              activeTab === 'registry' 
                ? "bg-white text-indigo-700 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Package className="w-3.5 h-3.5" />
            Stock Commodities
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
              activeTab === 'expenses' 
                ? "bg-white text-indigo-700 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Expenses & Restocks
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: STOCK REGISTRY VIEW ==================== */}
      {activeTab === 'registry' && (
        <>
          {/* Action Header bar inside Stock Registry */}
          <div className="flex justify-end gap-2 print:hidden">
            <button
              onClick={() => triggerPrint()}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Stock Registry
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Stock Item
            </button>
          </div>

          {/* Metrics Cards Grid - Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unique Commodities</p>
                <h3 className="text-lg font-black text-slate-950 mt-0.5">{stockMetrics.totalUniqueItems} Products</h3>
                <p className="text-[9px] text-slate-500 font-semibold mt-0.5">{stockMetrics.totalItems} Units total stored</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estimated Stock Worth</p>
                <h3 className="text-lg font-black text-slate-950 mt-0.5">
                  GHS {stockMetrics.totalAssetValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-[9px] text-emerald-600 font-bold mt-0.5 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  <span>Full assets valuation</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                stockMetrics.lowStockCount > 0 
                  ? 'bg-rose-50 border border-rose-100 text-rose-600 animate-pulse' 
                  : 'bg-slate-50 border border-slate-100 text-slate-400'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reorder Alerts</p>
                <h3 className={`text-lg font-black mt-0.5 ${stockMetrics.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-950'}`}>
                  {stockMetrics.lowStockCount} Commodities
                </h3>
                <p className="text-[9px] text-slate-500 font-semibold mt-0.5">Items falling below minimum threshold</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Inventory Categories</p>
                <h3 className="text-lg font-black text-slate-950 mt-0.5">7 Departments</h3>
                <p className="text-[9px] text-slate-500 font-semibold mt-0.5">Structured school assets segregation</p>
              </div>
            </div>
          </div>

          {/* Control Filters Toolbar - Stock */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search assets by name or location room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Classify:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">All Categories</option>
                  <option value="Stationery">Stationery</option>
                  <option value="Textbooks">Textbooks</option>
                  <option value="Uniforms">Uniforms</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Sports Gear">Sports Gear</option>
                  <option value="Lab Equipment">Lab Equipment</option>
                  <option value="General">General</option>
                </select>
              </div>

              <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={cn(
                  "px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all cursor-pointer flex items-center gap-1.5",
                  showLowStockOnly 
                    ? "bg-rose-50 border-rose-200 text-rose-700 shadow-inner" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <AlertTriangle className={cn("w-3.5 h-3.5", showLowStockOnly ? "text-rose-500" : "text-slate-400")} />
                Low Stock Alerts
              </button>
            </div>
          </div>

          {/* Main Stock Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="px-6 py-4">Item Details</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-center">In Stock</th>
                    <th className="px-6 py-4 text-right">Unit Price</th>
                    <th className="px-6 py-4 text-right">Asset Valuation</th>
                    <th className="px-6 py-4">Room/Location</th>
                    <th className="px-6 py-4 print:hidden">Supplier Contact</th>
                    <th className="px-6 py-4 text-right print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => {
                      const isLow = item.quantity <= item.minQuantity;
                      return (
                        <tr 
                          key={item.id} 
                          className={cn(
                            "hover:bg-slate-50/50 transition-colors",
                            isLow && "bg-rose-50/10 hover:bg-rose-50/20"
                          )}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                                isLow 
                                  ? "bg-rose-50 border-rose-100 text-rose-500" 
                                  : "bg-indigo-50 border-indigo-100 text-indigo-600"
                              )}>
                                <Package className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 uppercase tracking-tight leading-snug">
                                  {item.itemName}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[9px] font-semibold text-slate-400">
                                  <span>Alert Threshold: {item.minQuantity} units</span>
                                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                  <span>Updated: {new Date(item.lastUpdated).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                              item.category === 'Textbooks' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100/30' :
                              item.category === 'Stationery' ? 'bg-amber-50 text-amber-600 border border-amber-100/30' :
                              item.category === 'Uniforms' ? 'bg-teal-50 text-teal-600 border border-teal-100/30' :
                              item.category === 'Furniture' ? 'bg-blue-50 text-blue-600 border border-blue-100/30' :
                              item.category === 'Sports Gear' ? 'bg-orange-50 text-orange-600 border border-orange-100/30' :
                              item.category === 'Lab Equipment' ? 'bg-purple-50 text-purple-600 border border-purple-100/30' :
                              'bg-slate-50 text-slate-600 border border-slate-100/30'
                            )}>
                              {item.category}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-black min-w-[50px] text-center shadow-sm",
                                isLow 
                                  ? 'bg-rose-600 text-white' 
                                  : 'bg-slate-100 text-slate-800 border border-slate-200'
                              )}>
                                {item.quantity}
                              </span>
                              
                              {/* Quick adjustments in table */}
                              <div className="flex items-center gap-1.5 mt-1.5 print:hidden">
                                <button
                                  onClick={() => handleAdjustQuantity(item.id!, item.quantity, -1)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 hover:bg-slate-100 rounded cursor-pointer"
                                  title="Decrement Stock"
                                >
                                  <MinusCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleAdjustQuantity(item.id!, item.quantity, 1)}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 hover:bg-slate-100 rounded cursor-pointer"
                                  title="Increment Stock"
                                >
                                  <PlusCircle className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-right font-bold text-slate-700 font-mono">
                            GHS {item.unitPrice.toFixed(2)}
                          </td>

                          <td className="px-6 py-4 text-right font-extrabold text-slate-900 font-mono">
                            GHS {(item.quantity * item.unitPrice).toFixed(2)}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="uppercase tracking-tight truncate max-w-[150px]">{item.location}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4 print:hidden">
                            {item.supplierName ? (
                              <div className="space-y-0.5">
                                <div className="font-extrabold text-slate-700 leading-none text-[10px]">{item.supplierName}</div>
                                {item.supplierPhone && (
                                  <div className="flex items-center gap-0.5 text-[9px] text-slate-400 font-semibold font-mono mt-0.5">
                                    <PhoneCall className="w-2.5 h-2.5 text-slate-300" />
                                    <span>{item.supplierPhone}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic">No supplier info</span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right print:hidden">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditStock(item)}
                                className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-all cursor-pointer border border-transparent hover:border-slate-200"
                                title="Edit Item"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStock(item.id!)}
                                className="p-1.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all cursor-pointer border border-transparent hover:border-rose-100"
                                title="Delete Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400 bg-white">
                        <Package className="w-12 h-12 text-slate-100 mx-auto mb-3 animate-bounce" />
                        <p className="font-bold">No inventory matches found</p>
                        <p className="text-[10px] text-slate-400 mt-1">Adjust search parameters or insert a new stock commodity</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ==================== TAB 2: EXPENSES LEDGER VIEW ==================== */}
      {activeTab === 'expenses' && (
        <>
          {/* Action Header bar inside Expense Ledger */}
          <div className="flex justify-end gap-2 print:hidden">
            <button
              onClick={() => triggerPrint()}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Expense Report
            </button>
            <button
              onClick={() => {
                resetExpenseForm();
                setIsExpenseFormOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Log Expense / Purchase
            </button>
          </div>

          {/* Metrics Cards Grid - Expenses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Expenses Spent</p>
                <h3 className="text-lg font-black text-rose-700 mt-0.5">
                  GHS {expenseMetrics.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-[9px] text-slate-500 font-semibold mt-0.5">Sum of all overheads & purchases</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stock Purchase Costs</p>
                <h3 className="text-lg font-black text-indigo-700 mt-0.5">
                  GHS {expenseMetrics.restockSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-[9px] text-indigo-600 font-bold mt-0.5 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  <span>Linked to Inventory registry</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">General Overheads</p>
                <h3 className="text-lg font-black text-slate-950 mt-0.5">
                  GHS {expenseMetrics.overheadSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-[9px] text-slate-500 font-semibold mt-0.5">Utilities, Maintenance, Salaries, etc.</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Common Payment Mode</p>
                <h3 className="text-lg font-black text-slate-950 mt-0.5">{expenseMetrics.topPaymentMethod}</h3>
                <p className="text-[9px] text-slate-500 font-semibold mt-0.5">Most recurrent medium used</p>
              </div>
            </div>
          </div>

          {/* Control Filters Toolbar - Expenses */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search expense description, or recorder name..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Category:</span>
                <select
                  value={expenseCategoryFilter}
                  onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">All Categories</option>
                  <option value="Inventory Restock">Inventory Restock</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Salaries">Salaries</option>
                  <option value="Administrative">Administrative</option>
                  <option value="Events">Events</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Payment:</span>
                <select
                  value={expensePaymentFilter}
                  onChange={(e) => setExpensePaymentFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Expense Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="px-6 py-4">Expense Description / Commodity</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Amount Paid</th>
                    <th className="px-6 py-4">Transaction Date</th>
                    <th className="px-6 py-4">Payment Method</th>
                    <th className="px-6 py-4">Recorded By</th>
                    <th className="px-6 py-4 text-right print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredExpenses.length > 0 ? (
                    filteredExpenses.map((exp) => {
                      const isRestock = exp.category === 'Inventory Restock';
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                                isRestock 
                                  ? "bg-indigo-50 border-indigo-100 text-indigo-600" 
                                  : "bg-rose-50 border-rose-100 text-rose-500"
                              )}>
                                {isRestock ? <Package className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 uppercase tracking-tight leading-snug">
                                  {exp.description}
                                </div>
                                {isRestock && exp.inventoryItemId && (
                                  <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold text-indigo-600">
                                    <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100/50 rounded uppercase tracking-wider">
                                      Inventory-Linked Asset Purchase
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                              exp.category === 'Inventory Restock' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100/30' :
                              exp.category === 'Utilities' ? 'bg-cyan-50 text-cyan-600 border border-cyan-100/30' :
                              exp.category === 'Maintenance' ? 'bg-amber-50 text-amber-600 border border-amber-100/30' :
                              exp.category === 'Salaries' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/30' :
                              exp.category === 'Administrative' ? 'bg-purple-50 text-purple-600 border border-purple-100/30' :
                              exp.category === 'Events' ? 'bg-orange-50 text-orange-600 border border-orange-100/30' :
                              'bg-slate-50 text-slate-600 border border-slate-100/30'
                            )}>
                              {exp.category}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right font-extrabold text-rose-600 font-mono">
                            GHS {exp.amount.toFixed(2)}
                          </td>

                          <td className="px-6 py-4 text-slate-600 font-semibold font-mono">
                            {new Date(exp.date).toLocaleDateString()}
                          </td>

                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold uppercase border border-slate-200">
                              {exp.paymentMethod}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-slate-700 font-bold">
                            {exp.recordedBy}
                          </td>

                          <td className="px-6 py-4 text-right print:hidden">
                            <button
                              onClick={() => handleDeleteExpense(exp.id!)}
                              className="p-1.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all cursor-pointer border border-transparent hover:border-rose-100"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400 bg-white">
                        <DollarSign className="w-12 h-12 text-slate-100 mx-auto mb-3 animate-bounce" />
                        <p className="font-bold">No expenses matched your selection</p>
                        <p className="text-[10px] text-slate-400 mt-1">Specify different filters or record a new administrative payout above</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ==================== FORM DIALOG: CREATE/EDIT STOCK ITEM ==================== */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                      {isEditing !== null ? 'Modify Stock Commodity' : 'Create New Stock Commodity'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold">Declare and track storage room products</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border border-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitStock} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Item Name / Asset Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard Exercise Book (A4 - Pack of 100)"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    >
                      <option value="Stationery">Stationery</option>
                      <option value="Textbooks">Textbooks</option>
                      <option value="Uniforms">Uniforms</option>
                      <option value="Furniture">Furniture</option>
                      <option value="Sports Gear">Sports Gear</option>
                      <option value="Lab Equipment">Lab Equipment</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Storage Room / Shelf</label>
                    <input
                      type="text"
                      placeholder="e.g. Storage Hall B"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Quantity</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Min. Alert Limit</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={minQuantity}
                      onChange={(e) => setMinQuantity(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Unit Cost (GHS)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min={0}
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3.5 grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Supplier Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Golden Books Ghana"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Supplier Mobile</label>
                    <input
                      type="text"
                      placeholder="e.g. +233 24 000 0000"
                      value={supplierPhone}
                      onChange={(e) => setSupplierPhone(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                >
                  {isEditing !== null ? 'Apply Stock Changes' : 'Publish Stock Commodity'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== FORM DIALOG: LOG EXPENSE / STOCK PURCHASE ==================== */}
      <AnimatePresence>
        {isExpenseFormOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                      Log School Payout Expense
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold">Account general overheads or replenish inventory commodities</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExpenseFormOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border border-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitExpense} className="p-6 space-y-4">
                {/* Category Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Expense Category</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  >
                    <option value="Administrative">Administrative Overheads</option>
                    <option value="Inventory Restock">Inventory Restock (Linked to Stock Registry)</option>
                    <option value="Utilities">Utilities (Electricity, Water, Internet)</option>
                    <option value="Maintenance">Maintenance & Repairs</option>
                    <option value="Salaries">Salaries & Allowances</option>
                    <option value="Events">School Events & Sports</option>
                    <option value="Other">Other Miscellaneous Expenses</option>
                  </select>
                </div>

                {/* Conditional Fields based on whether Inventory Restock is selected */}
                {expenseCategory === 'Inventory Restock' ? (
                  <div className="space-y-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/60">
                    <div className="text-[11px] font-black text-indigo-800 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Configure Inventory Restock</span>
                    </div>

                    {inventoryList.length > 0 ? (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Select Commodity to Restock</label>
                          <select
                            value={selectedItemIdForRestock || ''}
                            onChange={(e) => handleItemRestockChange(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {inventoryList.map(item => (
                              <option key={item.id} value={item.id}>{item.itemName} (In stock: {item.quantity})</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Restock Quantity</label>
                            <input
                              type="number"
                              required
                              min={1}
                              value={restockQuantity}
                              onChange={(e) => setRestockQuantity(parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Purchase Unit Price (GHS)</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              min={0}
                              value={restockUnitPrice}
                              onChange={(e) => setRestockUnitPrice(parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
                            />
                          </div>
                        </div>

                        {/* Interactive dynamic total and supplier helper widget */}
                        <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-xs font-extrabold text-indigo-900">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Calculated Total Payout</span>
                            <span className="text-sm font-black font-mono">GHS {(restockQuantity * restockUnitPrice).toFixed(2)}</span>
                          </div>
                          {selectedRestockItemPreview?.supplierName && (
                            <div className="text-right text-[10px] text-slate-500 font-bold max-w-[180px]">
                              <span className="text-[9px] text-slate-400 font-medium block">Default Supplier</span>
                              <span className="text-slate-700 truncate block">{selectedRestockItemPreview.supplierName}</span>
                              <span className="text-indigo-600 font-mono block">{selectedRestockItemPreview.supplierPhone}</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-rose-600 font-bold p-2 bg-rose-50 border border-rose-100 rounded">
                        No inventory stock items exist yet. Please create a Stock Commodity first in the "Stock Commodities" tab before logging a restock purchase.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {/* General overhead description */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Expense Description</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ECG Power Recharge Meter token purchase"
                        value={expenseDescription}
                        onChange={(e) => setExpenseDescription(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                      />
                    </div>

                    {/* General overhead spent amount */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Amount Spent (GHS)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min={0.01}
                        placeholder="0.00"
                        value={expenseAmount || ''}
                        onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 font-mono"
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                  {/* Payment Method selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Payment Method</label>
                    <select
                      value={expensePaymentMethod}
                      onChange={(e) => setExpensePaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    >
                      <option value="Mobile Money">Mobile Money (MoMo)</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Bank Cheque</option>
                    </select>
                  </div>

                  {/* Recorded By prefill/input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Recorded By (Officer)</label>
                    <input
                      type="text"
                      required
                      placeholder="Name of Accountant"
                      value={expenseRecordedBy}
                      onChange={(e) => setExpenseRecordedBy(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                    />
                  </div>
                </div>

                {/* Submission action */}
                <button
                  type="submit"
                  disabled={expenseCategory === 'Inventory Restock' && inventoryList.length === 0}
                  className="w-full mt-2 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                >
                  Log Transaction & Update Stock
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
