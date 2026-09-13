import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Search, Shield, UserCheck, Bell, Smartphone, 
  Wallet, PlusCircle, AlertTriangle, CheckCircle, X, Sparkles
} from 'lucide-react';
import { api } from '../../api/client';

export default function Navbar() {
  const { 
    business, currentRole, switchRole, staffList, 
    setActiveTab, notifications, formatINR, showToast 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [targetRole, setTargetRole] = useState(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchModalOpen(true);
    try {
      const res = await api.searchImeiOrBarcode(searchQuery.trim());
      setSearchResult(res);
    } catch (err) {
      setSearchResult({ found: false, message: err.message });
    } finally {
      setIsSearching(false);
    }
  };

  const handleRoleSelect = (roleCode) => {
    setShowRoleDropdown(false);
    if (roleCode === 'OWNER' && currentRole !== 'OWNER') {
      setTargetRole('OWNER');
      setShowPinModal(true);
      setEnteredPin('');
    } else {
      switchRole(roleCode);
    }
  };

  const verifyPinAndSwitch = () => {
    if (enteredPin === '1234' || enteredPin === '2222' || enteredPin === '3333' || enteredPin === '4444') {
      switchRole(targetRole);
      setShowPinModal(false);
      setEnteredPin('');
    } else {
      showToast('Incorrect Staff PIN (Try 1234 for Owner, 3333 for Staff)', 'error');
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'MANAGER': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'STAFF': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'ACCOUNTANT': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 lg:px-6 py-2.5 flex items-center justify-between shadow-sm">
        {/* Left: Store identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold shadow-md">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none font-display">
                {business.name}
              </h1>
              <span className="hidden sm:inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                GST: {business.gstin ? business.gstin.slice(0, 7) + '...' : 'Registered'}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span>📍 {business.city}, MH</span>
              <span>•</span>
              <span className="text-slate-600 font-medium">POS Terminal Active</span>
            </p>
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Instant search IMEI (15-digit), Barcode, or Customer Mobile..."
              className="w-full pl-9 pr-20 py-1.5 text-xs bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-lg outline-none transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded shadow-xs"
            >
              Scan / Enter
            </button>
          </form>
        </div>

        {/* Right: Actions, Role switcher, Notifications */}
        <div className="flex items-center gap-3">
          {/* Fast POS CTA */}
          <button
            onClick={() => setActiveTab('pos')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-transform active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Counter POS</span>
          </button>

          {/* Quick Counter Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${getRoleBadgeColor(currentRole)}`}
              title="Click to switch terminal user permissions (Owner, Manager, Staff)"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{currentRole}</span>
              <span className="text-[10px] opacity-60">▼</span>
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Terminal Access Mode</p>
                </div>
                {[
                  { code: 'OWNER', label: 'Store Owner', desc: 'Full profits, audit logs & settings' },
                  { code: 'MANAGER', label: 'Store Manager', desc: 'Sales, purchases & stock' },
                  { code: 'STAFF', label: 'Counter Staff', desc: 'Fast billing, profits masked' },
                  { code: 'ACCOUNTANT', label: 'Accountant', desc: 'GST, cash & expenses' },
                ].map((item) => (
                  <button
                    key={item.code}
                    onClick={() => handleRoleSelect(item.code)}
                    className={`w-full text-left px-3 py-2 text-xs flex flex-col hover:bg-slate-50 transition-colors ${currentRole === item.code ? 'bg-emerald-50/70' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{item.label}</span>
                      {currentRole === item.code && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notification Icon */}
          <button
            onClick={() => setShowNotifDrawer(true)}
            className="relative p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            title="Notifications & Alerts"
          >
            <Bell className="w-4 h-4" />
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            )}
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>
        </div>
      </header>

      {/* Global IMEI / Product Search Result Modal */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">IMEI & Device Lookup</h3>
              </div>
              <button onClick={() => setSearchModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              {isSearching ? (
                <div className="py-8 text-center text-sm text-slate-500">Scanning inventory database...</div>
              ) : searchResult && searchResult.found ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                        {searchResult.type === 'SERIAL_DEVICE' ? 'Serialized Mobile' : 'Product Accessory'}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-1">{searchResult.product_name}</h4>
                      <p className="text-xs text-slate-500">{searchResult.brand} • {searchResult.model}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-900">{formatINR(searchResult.selling_price)}</span>
                      <p className="text-[10px] text-slate-400">MRP: {formatINR(searchResult.mrp)}</p>
                    </div>
                  </div>

                  {searchResult.type === 'SERIAL_DEVICE' && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">IMEI 1:</span>
                        <span className="font-mono font-bold text-slate-800">{searchResult.imei1 || 'N/A'}</span>
                      </div>
                      {searchResult.imei2 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">IMEI 2:</span>
                          <span className="font-mono text-slate-700">{searchResult.imei2}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500">Specs / Color:</span>
                        <span className="font-medium text-slate-800">{searchResult.ram ? `${searchResult.ram} / ${searchResult.storage}` : ''} • {searchResult.color}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-200">
                        <span className="text-slate-500">Status:</span>
                        <span className={`font-bold uppercase ${searchResult.status === 'IN_STOCK' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ● {searchResult.status}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        setSearchModalOpen(false);
                        setActiveTab('pos');
                      }}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      Sell in POS Counter
                    </button>
                    <button
                      onClick={() => {
                        setSearchModalOpen(false);
                        setActiveTab('inventory');
                      }}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      View in Stock
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No device found</p>
                  <p className="text-xs text-slate-500 mt-1">No product matches IMEI/barcode "{searchQuery}" in your inventory.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff PIN Verification Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full shadow-2xl p-5 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm text-center">Store Owner PIN</h3>
            <p className="text-xs text-slate-500 text-center mt-1">Enter PIN to access Owner Mode (Default: 1234)</p>
            <input
              type="password"
              maxLength={6}
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              placeholder="••••"
              autoFocus
              className="w-full text-center text-xl tracking-widest font-mono py-2 mt-4 bg-slate-50 border border-slate-300 rounded-lg focus:border-emerald-500 outline-none"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowPinModal(false)}
                className="flex-1 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={verifyPinAndSwitch}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Drawer */}
      {showNotifDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-sm h-full shadow-2xl p-5 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Store Alerts & Reminders</h3>
              </div>
              <button onClick={() => setShowNotifDrawer(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-2">
              {notifications.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">No new alerts</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="py-3">
                    <div className="flex items-start gap-2.5">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.severity === 'DANGER' ? 'bg-rose-500' : n.severity === 'WARNING' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{n.title}</h4>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">{n.category.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
