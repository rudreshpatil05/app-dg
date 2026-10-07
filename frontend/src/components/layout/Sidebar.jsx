import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, ShoppingCart, Receipt, Package, 
  Users, CreditCard, ShoppingBag, Truck, Landmark, 
  ReceiptText, RefreshCw, Wrench, ShieldCheck,
  BarChart3, Settings, X
} from 'lucide-react';

export default function Sidebar({ mobileNavOpen, onClose }) {
  const { activeTab, setActiveTab, currentRole, business, canAccess } = useApp();

  const navGroups = [
    { label: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    { label: 'Sales', items: [
      { id: 'pos', label: 'Counter POS', icon: ShoppingCart, badge: 'Fast', badgeColor: 'bg-emerald-500 text-white' },
      { id: 'sales', label: 'Sales & Invoices', icon: Receipt }
    ] },
    { label: 'Inventory', items: [{ id: 'inventory', label: 'Inventory & IMEIs', icon: Package }] },
    { label: 'Customers', items: [
      { id: 'customers', label: 'Customers & Khata', icon: Users, badge: 'Credit', badgeColor: 'bg-amber-100 text-amber-800' },
      { id: 'emi', label: 'Store EMI Plans', icon: CreditCard, badge: 'Finance', badgeColor: 'bg-indigo-100 text-indigo-800' }
    ] },
    { label: 'Purchasing', items: [
      { id: 'purchases', label: 'Purchases', icon: ShoppingBag },
      { id: 'suppliers', label: 'Suppliers Khata', icon: Truck }
    ] },
    { label: 'Finance', items: [
      { id: 'cashbank', label: 'Cash & Bank', icon: Landmark, badge: 'Recon' },
      { id: 'expenses', label: 'Expenses', icon: ReceiptText }
    ] },
    { label: 'Operations', items: [
      { id: 'exchange', label: 'Old Phone Exchange', icon: RefreshCw },
      { id: 'repairs', label: 'Repairs & Service', icon: Wrench },
      { id: 'warranty', label: 'Warranty Check', icon: ShieldCheck }
    ] },
    { label: 'Insights & Admin', items: [
      { id: 'reports', label: 'Reports & GST', icon: BarChart3 },
      { id: 'settings', label: 'Settings & Audit', icon: Settings }
    ] }
  ];

  return (
    <>
      {mobileNavOpen && <button aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 flex-shrink-0 select-none transform transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 lg:hidden">
          <span className="text-sm font-bold text-white">Store Operations</span>
          <button aria-label="Close navigation" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
      {/* Navigation list */}
      <div className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => canAccess(item.id));
          if (!visibleItems.length) return null;
          return <div key={group.label}>
            <div className="px-3 pb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{group.label}</div>
            <div className="space-y-1">
            {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); onClose?.(); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md font-semibold shadow-emerald-900/30'
                  : 'hover:bg-slate-800/80 hover:text-slate-100 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
            })}
            </div>
          </div>;
        })}
      </div>

      {/* Terminal Mode Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50">
        <div className="mb-2 px-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Current Store</p>
          <p className="text-xs font-semibold text-slate-200 truncate mt-0.5" title={business.name}>{business.name}</p>
          <p className="text-[10px] text-slate-500 truncate">{business.city}, {business.state}</p>
        </div>
        <div className="bg-slate-800/60 rounded-xl p-2.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Active Terminal</p>
            <p className="text-xs font-bold text-slate-200 mt-0.5">{currentRole} ACCESS</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>
      </aside>
    </>
  );
}
