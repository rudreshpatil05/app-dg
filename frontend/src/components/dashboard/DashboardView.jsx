import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, 
  CreditCard, AlertTriangle, ShieldCheck, Wrench, 
  ShoppingCart, Plus, ArrowUpRight, ArrowDownRight, Package, Users
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, CartesianGrid, LineChart, Line 
} from 'recharts';

export default function DashboardView() {
  const { business, formatINR, isOwner, isStaff, setActiveTab } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const summary = await api.getDashboardSummary();
      setData(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Loading real-time store dashboard...
      </div>
    );
  }

  const { kpis, sales_overview, trends, alerts } = data;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      
      {/* Welcome & Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display">Store Performance Overview</h2>
          <p className="text-xs text-slate-500">Today's live transactions, cash counter status, and actionable alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('pos')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-transform active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" /> New Sale (POS)
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs"
          >
            <Users className="w-4 h-4 text-emerald-600" /> Collect Payment
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="w-4 h-4 text-rose-500" /> Add Expense
          </button>
        </div>
      </div>

      {/* Actionable Alerts Banner (Critical Warnings) */}
      {(alerts.low_stock_count > 0 || alerts.overdue_emi_count > 0 || alerts.pending_repairs_count > 0) && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Store Alerts Requiring Immediate Attention</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {alerts.low_stock_count > 0 && (
              <div 
                onClick={() => setActiveTab('inventory')}
                className="bg-white/80 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
              >
                <div>
                  <span className="font-bold text-amber-900">⚠️ {alerts.low_stock_count} Products Low in Stock</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Reorder from distributors</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-amber-600" />
              </div>
            )}
            {alerts.overdue_emi_count > 0 && (
              <div 
                onClick={() => setActiveTab('emi')}
                className="bg-white/80 p-2.5 rounded-xl border border-rose-200 flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
              >
                <div>
                  <span className="font-bold text-rose-900">🔔 {alerts.overdue_emi_count} Customer EMIs Overdue</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Send WhatsApp reminders</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </div>
            )}
            {alerts.pending_repairs_count > 0 && (
              <div 
                onClick={() => setActiveTab('repairs')}
                className="bg-white/80 p-2.5 rounded-xl border border-blue-200 flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
              >
                <div>
                  <span className="font-bold text-blue-900">🔧 {alerts.pending_repairs_count} Devices in Repair Center</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Check technician diagnosis</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Primary KPI Cards Grid (Top 9 Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        
        {/* 1. Today's Sales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Today's Sales</span>
            <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <p className="text-xl font-extrabold text-slate-900 font-display">{formatINR(kpis.today_sales)}</p>
          <p className="text-[11px] text-slate-500">{kpis.today_sales_count} invoices generated today</p>
        </div>

        {/* 2. Today's Gross Profit (Owner restricted) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Today's Profit</span>
            <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600"><DollarSign className="w-4 h-4" /></span>
          </div>
          {kpis.is_profit_hidden ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="font-mono text-base font-bold text-slate-400">••••••</span>
              <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">Owner Only</span>
            </div>
          ) : (
            <p className="text-xl font-extrabold text-emerald-600 font-display">{formatINR(kpis.today_profit || 0)}</p>
          )}
          <p className="text-[11px] text-slate-500">True margin after COGS & tax</p>
        </div>

        {/* 3. Today's Expenses */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Today's Expenses</span>
            <span className="p-1 rounded-lg bg-rose-50 text-rose-600"><TrendingDown className="w-4 h-4" /></span>
          </div>
          <p className="text-xl font-extrabold text-rose-600 font-display">{formatINR(kpis.today_expenses)}</p>
          <p className="text-[11px] text-slate-500">Tea, rent, utilities & logistics</p>
        </div>

        {/* 4. Cash in Hand (Drawer) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Cash in Hand (Counter)</span>
            <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600"><Wallet className="w-4 h-4" /></span>
          </div>
          <p className="text-xl font-extrabold text-slate-900 font-display">{formatINR(kpis.cash_in_hand)}</p>
          <p className="text-[11px] text-slate-500">Physical drawer cash balance</p>
        </div>

        {/* 5. Bank / UPI Balance */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Bank & UPI Balance</span>
            <span className="p-1 rounded-lg bg-blue-50 text-blue-600"><CreditCard className="w-4 h-4" /></span>
          </div>
          <p className="text-xl font-extrabold text-slate-900 font-display">{formatINR(kpis.bank_upi_balance)}</p>
          <p className="text-[11px] text-slate-500">HDFC & PhonePe/GPay settlements</p>
        </div>

        {/* 6. Total Customer Outstanding (Khatabook) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Customer Khata Due</span>
            <span className="p-1 rounded-lg bg-amber-50 text-amber-600"><Users className="w-4 h-4" /></span>
          </div>
          <p className="text-xl font-extrabold text-amber-700 font-display">{formatINR(kpis.total_customer_outstanding)}</p>
          <p className="text-[11px] text-slate-500">Pending customer receivables</p>
        </div>

        {/* 7. Customer EMI Due Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Customer EMI Due Today</span>
            <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600"><CreditCard className="w-4 h-4" /></span>
          </div>
          <p className="text-xl font-extrabold text-indigo-900 font-display">{formatINR(kpis.customer_emi_due_today)}</p>
          <p className="text-[11px] text-slate-500">Store-financed monthly dues</p>
        </div>

        {/* 8. Supplier Payable */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Supplier Payable</span>
            <span className="p-1 rounded-lg bg-slate-100 text-slate-700"><Package className="w-4 h-4" /></span>
          </div>
          <p className="text-xl font-extrabold text-slate-900 font-display">{formatINR(kpis.supplier_payable)}</p>
          <p className="text-[11px] text-slate-500">Owed to mobile distributors</p>
        </div>

        {/* 9. Current Stock Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Inventory Valuation</span>
            <span className="p-1 rounded-lg bg-teal-50 text-teal-600"><Package className="w-4 h-4" /></span>
          </div>
          {kpis.is_profit_hidden ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="font-mono text-base font-bold text-slate-400">••••••</span>
              <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">Owner Only</span>
            </div>
          ) : (
            <p className="text-xl font-extrabold text-teal-800 font-display">{formatINR(kpis.current_stock_value || 0)}</p>
          )}
          <p className="text-[11px] text-slate-500">Total handsets & accessories at cost</p>
        </div>
      </div>

      {/* Second Section: Sales Overview Cards (Today, Week, Month) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Today's Sales</span>
          <p className="text-2xl font-extrabold font-display">{formatINR(sales_overview.today)}</p>
          <p className="text-xs text-emerald-100">Updated automatically with each POS bill</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">This Week's Turnover</span>
          <p className="text-2xl font-extrabold font-display">{formatINR(sales_overview.this_week)}</p>
          <p className="text-xs text-blue-100">Monday to today</p>
        </div>
        <div className="bg-gradient-to-br from-purple-700 to-slate-900 text-white p-4 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200">This Month's Turnover</span>
          <p className="text-2xl font-extrabold font-display">{formatINR(sales_overview.this_month)}</p>
          <p className="text-xs text-purple-200">Calendar month total</p>
        </div>
      </div>

      {/* Chart Section: 7-Day Trend */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-display">Sales vs Expenses Trend (Past 7 Days)</h3>
            <p className="text-xs text-slate-500">Revenue generation compared with operational expenditures</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Sales</span>
            <span className="flex items-center gap-1.5 text-rose-500"><span className="w-3 h-3 rounded-full bg-rose-400" /> Expenses</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip 
                formatter={(value) => [formatINR(value), '']}
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none', fontSize: '12px' }}
              />
              <Bar dataKey="sales" fill="#10b981" radius={[6, 6, 0, 0]} name="Sales" />
              <Bar dataKey="expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
