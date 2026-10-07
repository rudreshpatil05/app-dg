import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { 
  BarChart3, Download, Printer, TrendingUp, 
  DollarSign, FileSpreadsheet, ShieldAlert, Percent
} from 'lucide-react';

const toLocalIso = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export default function ReportsView() {
  const { formatINR, isStaff, showToast } = useApp();

  const [activeReport, setActiveReport] = useState('sales'); // 'sales', 'profit', 'gst', 'stock'
  const [salesData, setSalesData] = useState(null);
  const [profitData, setProfitData] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const todayIso = toLocalIso(today);
  const monthStartIso = toLocalIso(new Date(today.getFullYear(), today.getMonth(), 1));
  const [salesFilters, setSalesFilters] = useState({ start_date: monthStartIso, end_date: todayIso, category_id: '', brand: '', product_search: '', customer_search: '', payment_method: '' });
  const [appliedSalesFilters, setAppliedSalesFilters] = useState({ start_date: monthStartIso, end_date: todayIso });
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);

  useEffect(() => {
    loadReports();
  }, [activeReport, appliedSalesFilters]);

  useEffect(() => {
    Promise.all([api.getCategories(), api.getProducts()]).then(([categories, products]) => {
      setCategoryOptions(categories);
      setBrandOptions([...new Set(products.map((product) => product.brand).filter(Boolean))].sort());
    }).catch((err) => console.warn('Could not load sales filter options:', err.message));
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      if (activeReport === 'sales') {
        const s = await api.getSalesReport(appliedSalesFilters);
        setSalesData(s);
      } else if (activeReport === 'profit' && !isStaff) {
        const p = await api.getProfitLossReport();
        setProfitData(p);
      } else if (activeReport === 'gst') {
        const g = await api.getGstSummaryReport();
        setGstData(g);
      } else if (activeReport === 'stock' && !isStaff) {
        const st = await api.getStockValuationReport();
        setStockData(st);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async (type) => {
    try {
      await api.downloadExportCsv(type);
    } catch (err) {
      showToast(err.message || 'Could not generate CSV file', 'error');
    }
  };

  const handleExportPdf = async () => {
    try {
      await api.downloadSalesPdf(appliedSalesFilters);
    } catch (err) {
      showToast(err.message || 'Could not generate PDF', 'error');
    }
  };

  const handleExportExcel = async () => {
    try {
      await api.downloadSalesXlsx(appliedSalesFilters);
    } catch (err) {
      showToast(err.message || 'Could not generate Excel file', 'error');
    }
  };

  const applySalesFilters = () => {
    setAppliedSalesFilters(Object.fromEntries(Object.entries(salesFilters).filter(([, value]) => value !== '')));
  };

  const resetSalesFilters = () => {
    const defaults = { start_date: monthStartIso, end_date: todayIso, category_id: '', brand: '', product_search: '', customer_search: '', payment_method: '' };
    setSalesFilters(defaults);
    setAppliedSalesFilters({ start_date: monthStartIso, end_date: todayIso });
  };

  const applyQuickPeriod = (period) => {
    const date = new Date();
    let start = new Date(date);
    let end = new Date(date);
    if (period === 'YESTERDAY') {
      start.setDate(start.getDate() - 1);
      end = new Date(start);
    } else if (period === 'THIS_WEEK') {
      start.setDate(start.getDate() - start.getDay());
    } else if (period === 'LAST_MONTH') {
      start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
      end = new Date(date.getFullYear(), date.getMonth(), 0);
    } else if (period === 'THIS_MONTH') {
      start = new Date(date.getFullYear(), date.getMonth(), 1);
    }
    const next = { ...salesFilters, start_date: toLocalIso(start), end_date: toLocalIso(end) };
    setSalesFilters(next);
    setAppliedSalesFilters(Object.fromEntries(Object.entries(next).filter(([, value]) => value !== '')));
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Financial Reports, GST Filing & Valuation
          </h2>
          <p className="text-xs text-slate-500">GSTR-1 compliant sales reports, accurate COGS profitability, and inventory valuation</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportCsv(activeReport === 'gst' ? 'sales' : activeReport)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" /> Export Excel/CSV
          </button>
          {activeReport === 'sales' && (
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Download PDF
            </button>
          )}
          {activeReport === 'sales' && (
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Download Excel
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveReport('sales')}
          className={`pb-2 transition-all ${
            activeReport === 'sales' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Sales Performance
        </button>
        {!isStaff && (
          <button
            onClick={() => setActiveReport('profit')}
            className={`pb-2 transition-all ${
              activeReport === 'profit' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            True Profit & Loss (COGS)
          </button>
        )}
        <button
          onClick={() => setActiveReport('gst')}
          className={`pb-2 transition-all ${
            activeReport === 'gst' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          GST Summary (GSTR-1)
        </button>
        {!isStaff && (
          <button
            onClick={() => setActiveReport('stock')}
            className={`pb-2 transition-all ${
              activeReport === 'stock' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Stock Valuation
          </button>
        )}
      </div>

      {/* Content Area */}
      {activeReport === 'sales' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Sales Period</h3>
              <p className="text-[11px] text-slate-500">All totals below are calculated from completed invoices in the selected period.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[['TODAY', 'Today'], ['YESTERDAY', 'Yesterday'], ['THIS_WEEK', 'This Week'], ['THIS_MONTH', 'This Month'], ['LAST_MONTH', 'Last Month']].map(([id, label]) => (
                <button key={id} onClick={() => applyQuickPeriod(id)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">{label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <label className="text-[11px] font-semibold text-slate-600">From<input type="date" value={salesFilters.start_date} onChange={(e) => setSalesFilters({ ...salesFilters, start_date: e.target.value })} className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" /></label>
            <label className="text-[11px] font-semibold text-slate-600">To<input type="date" value={salesFilters.end_date} onChange={(e) => setSalesFilters({ ...salesFilters, end_date: e.target.value })} className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" /></label>
            <label className="text-[11px] font-semibold text-slate-600">Category<select value={salesFilters.category_id} onChange={(e) => setSalesFilters({ ...salesFilters, category_id: e.target.value })} className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"><option value="">All categories</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="text-[11px] font-semibold text-slate-600">Brand<select value={salesFilters.brand} onChange={(e) => setSalesFilters({ ...salesFilters, brand: e.target.value })} className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"><option value="">All brands</option>{brandOptions.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></label>
            <label className="text-[11px] font-semibold text-slate-600">Product/Model<input value={salesFilters.product_search} onChange={(e) => setSalesFilters({ ...salesFilters, product_search: e.target.value })} placeholder="Search product" className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" /></label>
            <label className="text-[11px] font-semibold text-slate-600">Customer<input value={salesFilters.customer_search} onChange={(e) => setSalesFilters({ ...salesFilters, customer_search: e.target.value })} placeholder="Name or phone" className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" /></label>
            <label className="text-[11px] font-semibold text-slate-600">Payment<select value={salesFilters.payment_method} onChange={(e) => setSalesFilters({ ...salesFilters, payment_method: e.target.value })} className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"><option value="">All methods</option><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="BANK">Bank</option><option value="EMI">EMI</option></select></label>
            <div className="flex items-end gap-1.5"><button onClick={applySalesFilters} className="flex-1 px-2 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold">Apply</button><button onClick={resetSalesFilters} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold">Reset</button></div>
          </div>
        </div>
      )}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading report metrics...</div>
      ) : (
        <>
          {/* TAB 1: Sales Report */}
          {activeReport === 'sales' && salesData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales</span>
                  <p className="text-xl font-extrabold text-slate-900 font-display mt-0.5">{formatINR(salesData.total_revenue)}</p>
                  <p className="text-[11px] text-slate-500">{salesData.invoices_count} bills</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GST Collected</span>
                  <p className="text-xl font-extrabold text-emerald-700 font-display mt-0.5">{formatINR(salesData.total_tax_collected)}</p>
                  <p className="text-[11px] text-slate-500">CGST + SGST</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discounts Given</span>
                  <p className="text-xl font-extrabold text-rose-600 font-display mt-0.5">{formatINR(salesData.total_discount_given)}</p>
                  <p className="text-[11px] text-slate-500">Counter promotions</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items Sold</span>
                  <p className="text-xl font-extrabold text-slate-900 font-display mt-0.5">{salesData.total_items_sold}</p>
                  <p className="text-[11px] text-slate-500">Units in completed bills</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid</span><p className="text-xl font-extrabold text-emerald-700 font-display mt-0.5">{formatINR(salesData.total_paid)}</p></div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Credit / Due</span><p className="text-xl font-extrabold text-rose-600 font-display mt-0.5">{formatINR(salesData.total_due)}</p></div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">EMI Sales</span><p className="text-xl font-extrabold text-indigo-700 font-display mt-0.5">{formatINR(salesData.total_emi_sales)}</p></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[["Cash", salesData.cash_sales], ["UPI", salesData.upi_sales], ["Card / Bank", salesData.card_bank_sales], ["Period", `${salesData.period.start} → ${salesData.period.end}`]].map(([label, value]) => <div key={label} className="bg-slate-50 p-3 rounded-xl border border-slate-200"><span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span><p className="text-sm font-bold text-slate-900 mt-1">{typeof value === 'number' ? formatINR(value) : value}</p></div>)}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"><div className="p-3.5 border-b border-slate-200 bg-slate-50/50"><h4 className="text-xs font-bold text-slate-700">Category-wise Sales</h4></div><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-[10px] uppercase text-slate-500"><th className="p-3 text-left">Category</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-right">Sales</th></tr></thead><tbody className="divide-y divide-slate-100">{salesData.categories.map((row) => <tr key={row.category}><td className="p-3 font-semibold">{row.category}</td><td className="p-3 text-right">{row.quantity}</td><td className="p-3 text-right font-bold text-emerald-700">{formatINR(row.revenue)}</td></tr>)}</tbody></table></div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"><div className="p-3.5 border-b border-slate-200 bg-slate-50/50"><h4 className="text-xs font-bold text-slate-700">Product-wise Sales</h4></div><div className="max-h-72 overflow-y-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-[10px] uppercase text-slate-500"><th className="p-3 text-left">Product / Brand</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right">Avg.</th></tr></thead><tbody className="divide-y divide-slate-100">{salesData.products.map((row) => <tr key={row.product_id}><td className="p-3"><strong>{row.product}</strong><span className="block text-[10px] text-slate-500">{row.brand} · {row.category}</span></td><td className="p-3 text-right">{row.quantity}</td><td className="p-3 text-right font-bold text-emerald-700">{formatINR(row.revenue)}</td><td className="p-3 text-right">{formatINR(row.average_selling_price)}</td></tr>)}</tbody></table></div></div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50/50"><h4 className="text-xs font-bold text-slate-700">Matching Bills & Transactions</h4></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[850px]"><thead><tr className="bg-slate-50 text-[10px] uppercase text-slate-500"><th className="p-3 text-left">Invoice / Date</th><th className="p-3 text-left">Customer</th><th className="p-3 text-left">Products</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Discount</th><th className="p-3 text-right">Tax</th><th className="p-3 text-right">Final</th><th className="p-3 text-left">Payment / Staff</th></tr></thead><tbody className="divide-y divide-slate-100">{salesData.transactions.map((row) => <tr key={row.id}><td className="p-3"><strong className="font-mono">{row.invoice_number}</strong><span className="block text-[10px] text-slate-500">{row.date}</span></td><td className="p-3">{row.customer}</td><td className="p-3 max-w-xs">{row.products}</td><td className="p-3 text-right">{row.quantity}</td><td className="p-3 text-right">{formatINR(row.discount)}</td><td className="p-3 text-right">{formatINR(row.tax)}</td><td className="p-3 text-right font-bold text-emerald-700">{formatINR(row.final_amount)}</td><td className="p-3"><span className="block">{row.payment_methods || '—'}</span><span className="text-[10px] text-slate-500">{row.staff}</span></td></tr>)}</tbody></table>
                  {salesData.transactions.length === 0 && <p className="p-6 text-center text-xs text-slate-400">No transactions match the selected filters.</p>}
                </div>
              </div>

              {/* Brand Breakdown Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-700">Brand-wise Sales Volume & Revenue</h4>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3">Brand</th>
                      <th className="p-3 text-center">Units Sold</th>
                      <th className="p-3 text-right">Revenue Generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesData.brands.map((b, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="p-3 font-bold text-slate-900">{b.brand}</td>
                        <td className="p-3 text-center font-semibold text-slate-700">{b.units}</td>
                        <td className="p-3 text-right font-bold text-emerald-700 font-display">{formatINR(b.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: True Profit & Loss Report */}
          {activeReport === 'profit' && profitData && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm">Comprehensive Store Profit & Loss (COGS Method)</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Gross Margin: {profitData.gross_margin_percent}%
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b text-slate-700">
                  <span className="font-bold">Total Sales Turnover (Revenue):</span>
                  <span className="font-bold text-sm font-display text-slate-900">{formatINR(profitData.total_revenue)}</span>
                </div>
                <div className="flex justify-between py-2 border-b text-slate-600">
                  <span>Less: Cost of Goods Sold (Actual Mobile & Device Purchase Costs):</span>
                  <span className="font-semibold text-rose-600 font-display">- {formatINR(profitData.cogs)}</span>
                </div>
                <div className="flex justify-between py-2 border-b text-slate-600">
                  <span>Less: Discounts Given to Customers:</span>
                  <span className="font-semibold text-rose-600 font-display">- {formatINR(profitData.total_discounts_given)}</span>
                </div>
                <div className="flex justify-between py-2.5 border-b bg-emerald-50/60 px-3 rounded-xl text-emerald-950 font-bold">
                  <span>GROSS PROFIT:</span>
                  <span className="text-base font-display">{formatINR(profitData.gross_profit)}</span>
                </div>
                <div className="flex justify-between py-2 border-b text-slate-600">
                  <span>Less: Operating Expenses (Rent, Salaries, Electricity, Tea, Marketing):</span>
                  <span className="font-semibold text-rose-600 font-display">- {formatINR(profitData.total_expenses)}</span>
                </div>
                <div className="flex justify-between py-3 bg-slate-900 text-white px-4 rounded-xl font-bold text-sm">
                  <span>NET STORE PROFIT (EBITDA):</span>
                  <span className="text-lg font-display text-emerald-400">{formatINR(profitData.net_profit)}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GST Summary (GSTR-1) */}
          {activeReport === 'gst' && gstData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taxable Turnover</span>
                  <p className="text-xl font-extrabold text-slate-900 font-display mt-0.5">{formatINR(gstData.taxable_turnover)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CGST (Central Tax)</span>
                  <p className="text-xl font-extrabold text-emerald-700 font-display mt-0.5">{formatINR(gstData.cgst_amount)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SGST (State Tax)</span>
                  <p className="text-xl font-extrabold text-emerald-700 font-display mt-0.5">{formatINR(gstData.sgst_amount)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total GST Liability</span>
                  <p className="text-xl font-extrabold text-slate-900 font-display mt-0.5">{formatINR(gstData.total_tax)}</p>
                </div>
              </div>

              {/* HSN Summary */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-700">HSN-wise Outward Supplies Summary (GSTR-1 Ready)</h4>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3">HSN Code</th>
                      <th className="p-3">GST %</th>
                      <th className="p-3 text-right">Taxable Value</th>
                      <th className="p-3 text-right">CGST</th>
                      <th className="p-3 text-right">SGST</th>
                      <th className="p-3 text-right">Total Invoice Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gstData.hsn_summary.map((h, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono font-bold text-slate-900">{h.hsn_code}</td>
                        <td className="p-3 font-semibold text-slate-700">{h.gst_rate}%</td>
                        <td className="p-3 text-right font-display">{formatINR(h.taxable_value)}</td>
                        <td className="p-3 text-right font-display text-emerald-700">{formatINR(h.cgst)}</td>
                        <td className="p-3 text-right font-display text-emerald-700">{formatINR(h.sgst)}</td>
                        <td className="p-3 text-right font-bold text-slate-900 font-display">{formatINR(h.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Stock Valuation */}
          {activeReport === 'stock' && stockData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Current Inventory Value</span>
                <p className="text-2xl font-extrabold text-slate-900 font-display">{formatINR(stockData.total_stock_value)}</p>
                <p className="text-xs text-slate-500">{stockData.total_items_count} items in store</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Smartphones & Serialized Devices</span>
                <p className="text-2xl font-extrabold text-indigo-700 font-display">{formatINR(stockData.smartphones_and_devices.value)}</p>
                <p className="text-xs text-slate-500">{stockData.smartphones_and_devices.count} IMEIs registered in stock</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accessories & Audio</span>
                <p className="text-2xl font-extrabold text-emerald-700 font-display">{formatINR(stockData.accessories.value)}</p>
                <p className="text-xs text-slate-500">{stockData.accessories.count} pieces at cost</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
