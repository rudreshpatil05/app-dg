import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LoginView from './components/auth/LoginView';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import DashboardView from './components/dashboard/DashboardView';
import POSBilling from './components/pos/POSBilling';
import SalesView from './components/sales/SalesView';
import InventoryView from './components/inventory/InventoryView';
import CustomersView from './components/customers/CustomersView';
import EMIPlansView from './components/emi/EMIPlansView';
import PurchasesView from './components/purchases/PurchasesView';
import SuppliersView from './components/suppliers/SuppliersView';
import CashBankView from './components/finance/CashBankView';
import ExpensesView from './components/finance/ExpensesView';
import ExchangeView from './components/specialized/ExchangeView';
import RepairsView from './components/specialized/RepairsView';
import WarrantyView from './components/specialized/WarrantyView';
import ReportsView from './components/reports/ReportsView';
import SettingsView from './components/settings/SettingsView';

function MainLayout() {
  const { activeTab, setActiveTab, canAccess } = useApp();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!canAccess(activeTab)) setActiveTab('dashboard');
  }, [activeTab, canAccess, setActiveTab]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar mobileNavOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar onOpenMenu={() => setMobileNavOpen(true)} />

        {/* Tab Canvas Content */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'pos' && <POSBilling />}
          {activeTab === 'sales' && <SalesView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'customers' && <CustomersView />}
          {activeTab === 'emi' && <EMIPlansView />}
          {activeTab === 'purchases' && <PurchasesView />}
          {activeTab === 'suppliers' && <SuppliersView />}
          {activeTab === 'cashbank' && <CashBankView />}
          {activeTab === 'expenses' && <ExpensesView />}
          {activeTab === 'exchange' && <ExchangeView />}
          {activeTab === 'repairs' && <RepairsView />}
          {activeTab === 'warranty' && <WarrantyView />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'settings' && canAccess('settings') && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthenticatedApp />
    </AppProvider>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) return <LoginView />;

  return <MainLayout />;
}
