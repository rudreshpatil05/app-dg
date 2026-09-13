import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Receipt, Search, Eye, RotateCcw, Printer, MessageSquare, X } from 'lucide-react';

export default function SalesView() {
  const { formatINR, formatDate, showToast } = useApp();

  const [sales, setSales] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItem, setReturnItem] = useState(null);
  const [returnReason, setReturnReason] = useState('DEFECTIVE');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setLoading(true);
    try {
      const data = await api.getSales();
      setSales(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReturnSale = async () => {
    if (!selectedSale || !returnItem) return;
    try {
      await api.returnSale(selectedSale.id, {
        items: [{ sale_item_id: returnItem.id, quantity: 1, refund_price: returnItem.unit_price }],
        reason: returnReason,
        refund_amount: returnItem.unit_price,
        notes: `Returned: ${returnReason}`
      });

      showToast(`Item marked as RETURNED (Pending Inspection)`);
      setShowReturnModal(false);
      loadSales();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredSales = sales.filter(s =>
    s.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.customer_phone.includes(searchQuery)
  );

  return (
    <div className="p-4 lg:p-6 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Sales Invoices & Billing History
          </h2>
          <p className="text-xs text-slate-500">View customer tax invoices, reprint 80mm thermal slips, and process device returns</p>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Invoice #, Customer Name, or Phone..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3.5">Invoice #</th>
              <th className="p-3.5">Date</th>
              <th className="p-3.5">Customer</th>
              <th className="p-3.5">Type</th>
              <th className="p-3.5 text-right">Invoice Total</th>
              <th className="p-3.5 text-right">Paid</th>
              <th className="p-3.5 text-right">Balance Due</th>
              <th className="p-3.5 text-center">Status</th>
              <th className="p-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSales.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/70">
                <td className="p-3.5 font-bold font-mono text-slate-900">{s.invoice_number}</td>
                <td className="p-3.5 text-slate-600">{formatDate(s.invoice_date)}</td>
                <td className="p-3.5">
                  <p className="font-semibold text-slate-800">{s.customer_name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{s.customer_phone}</p>
                </td>
                <td className="p-3.5">
                  <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {s.payment_type}
                  </span>
                </td>
                <td className="p-3.5 text-right font-bold text-slate-900 font-display">{formatINR(s.final_payable)}</td>
                <td className="p-3.5 text-right font-semibold text-emerald-600 font-display">{formatINR(s.paid_amount)}</td>
                <td className="p-3.5 text-right font-bold text-rose-600 font-display">{formatINR(s.balance_due)}</td>
                <td className="p-3.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                    s.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    ● {s.payment_status}
                  </span>
                </td>
                <td className="p-3.5 text-center">
                  <button
                    onClick={() => setSelectedSale(s)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900"
                    title="View Invoice & Reprint"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail & Return Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Invoice #{selectedSale.invoice_number}</h3>
                <p className="text-xs text-slate-500">Customer: {selectedSale.customer_name} ({selectedSale.customer_phone})</p>
              </div>
              <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-bold text-slate-700 block">Items on Bill:</span>
              {selectedSale.items?.map((it) => (
                <div key={it.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{it.product_name}</p>
                    {it.imei1 && <p className="font-mono text-[11px] text-emerald-700">IMEI: {it.imei1}</p>}
                    <p className="text-[10px] text-slate-500">HSN: {it.hsn_code} • Warranty: {it.warranty_months} Mos</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatINR(it.total)}</p>
                    <button
                      onClick={() => {
                        setReturnItem(it);
                        setShowReturnModal(true);
                      }}
                      className="text-[11px] text-rose-600 font-semibold hover:underline mt-1"
                    >
                      Return Item
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between"><span>Grand Total:</span><span className="font-bold">{formatINR(selectedSale.final_payable)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>Paid:</span><span>{formatINR(selectedSale.paid_amount)}</span></div>
              {selectedSale.balance_due > 0 && (
                <div className="flex justify-between text-rose-600 font-bold"><span>Balance Due:</span><span>{formatINR(selectedSale.balance_due)}</span></div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedSale(null)}
                className="flex-1 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Dialog */}
      {showReturnModal && returnItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-5 border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Process Return for {returnItem.product_name}</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Return Reason</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="DEFECTIVE">Defective / Manufacturing Issue</option>
                  <option value="CUSTOMER_RETURN">Customer Mind Change</option>
                  <option value="WRONG_PRODUCT">Wrong Product Given</option>
                  <option value="WARRANTY_ISSUE">Warranty Claim</option>
                </select>
              </div>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg">
                Note: Returning this device will set its status to <b>RETURNED (Pending Inspection)</b>. It will not be sold until cleared.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowReturnModal(false)}
                className="flex-1 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnSale}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
