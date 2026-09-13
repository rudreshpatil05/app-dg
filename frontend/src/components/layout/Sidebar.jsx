import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, ShoppingCart, Receipt, Package, 
  Users, CreditCard, ShoppingBag, Truck, Landmark, 
  ReceiptText, RefreshCw, Wrench, ShieldCheck, 
  BarChart3, Settings, LogOut
} from 'lucide-react';

export default function Sidebar() {
  const { activeTab, setActiveTab, currentRole } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'pos', label: 'Counter POS', icon: ShoppingCart, badge: 'Fast', badgeColor: 'bg-emerald-500 text-white' },
    { id: 'sales', label: 'Sales & Invoices', icon: Receipt },
    { id: 'inventory', label: 'Inventory & IMEIs', icon: Package },
    { id: 'customers', label: 'Customers (Khata)', icon: Users, badge: 'Credit', badgeColor: 'bg-amber-100 text-amber-800' },
    { id: 'emi', label: 'Store EMI Plans', icon: CreditCard, badge: 'Finance', badgeColor: 'bg-indigo-100 text-indigo-800' },
    { id: 'purchases', label: 'Purchases (Inward)', icon: ShoppingBag },
    { id: 'suppliers', label: 'Suppliers Khata', icon: Truck },
    { id: 'cashbank', label: 'Cash & Bank', icon: Landmark, badge: 'Recon' },
    { id: 'expenses', label: 'Expenses', icon: ReceiptText },
    { id: 'exchange', label: 'Old Phone Exchange', icon: RefreshCw },
    { id: 'repairs', label: 'Repairs & Service', icon: Wrench },
    { id: 'warranty', label: 'Warranty Check', icon: ShieldCheck },
    { id: 'reports', label: 'Reports & GST', icon: BarChart3 },
    { id: 'settings', label: 'Settings & Audit', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 flex-shrink-0 select-none">
      {/* Navigation list */}
      <div className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Store Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
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

      {/* Terminal Mode Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50">
        <div className="bg-slate-800/60 rounded-xl p-2.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Active Terminal</p>
            <p className="text-xs font-bold text-slate-200 mt-0.5">{currentRole} ACCESS</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>
    </aside>
  );
}
