import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { 
  BarChart3, Download, Printer, TrendingUp, 
  DollarSign, FileSpreadsheet, ShieldAlert, Percent
} from 'lucide-react';

export default function ReportsView() {
  const { formatINR, isStaff } = useApp();

  const [activeReport, setActiveReport] = useState('sales'); // 'sales', 'profit', 'gst', 'stock'
  const [salesData, setSalesData] = useState(null);
  const [profitData, setProfitData] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [activeReport]);

  const loadReports = async () => {
    setLoading(true);
    try {
      if (activeReport === 'sales') {
        const s = await api.getSalesReport();
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

  const handleExportCsv = (type) => {
    window.open(api.getExportCsvUrl(type), '_blank');
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
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading report metrics...</div>
      ) : (
        <>
          {/* TAB 1: Sales Report */}
          {activeReport === 'sales' && salesData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales Turnover</span>
                  <p className="text-xl font-extrabold text-slate-900 font-display mt-0.5">{formatINR(salesData.total_revenue)}</p>
                  <p className="text-[11px] text-slate-500">{salesData.invoices_count} tax invoices</p>
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Payment Mode</span>
                  <p className="text-xl font-extrabold text-slate-900 font-display mt-0.5">UPI & Cash</p>
                  <p className="text-[11px] text-slate-500">Instant counter settlement</p>
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
