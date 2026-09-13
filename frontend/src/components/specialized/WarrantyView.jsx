import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { ShieldCheck, Search, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react';

export default function WarrantyView() {
  const { formatDate } = useApp();
  const [warranties, setWarranties] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWarranties();
  }, []);

  const loadWarranties = async () => {
    setLoading(true);
    try {
      const data = await api.getWarranties();
      setWarranties(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = warranties.filter(w =>
    (w.imei && w.imei.includes(searchQuery)) ||
    w.customer_phone.includes(searchQuery) ||
    w.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Handset Warranty & Claim Verification
          </h2>
          <p className="text-xs text-slate-500">Instant lookup for warranty duration, start date, and expiry status by IMEI or customer mobile</p>
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type customer mobile number or 15-digit IMEI to verify warranty..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-emerald-500 font-mono"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3.5">Device Model</th>
              <th className="p-3.5">Device IMEI</th>
              <th className="p-3.5">Customer Name & Phone</th>
              <th className="p-3.5">Purchase Date</th>
              <th className="p-3.5">Duration</th>
              <th className="p-3.5">Expiry Date</th>
              <th className="p-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((w) => {
              const isExpired = new Date(w.warranty_end) < new Date();
              return (
                <tr key={w.id} className="hover:bg-slate-50/70">
                  <td className="p-3.5 font-bold text-slate-900">{w.product_name}</td>
                  <td className="p-3.5 font-mono font-bold text-emerald-700">{w.imei || 'N/A'}</td>
                  <td className="p-3.5">
                    <p className="font-semibold text-slate-800">{w.customer_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{w.customer_phone}</p>
                  </td>
                  <td className="p-3.5 text-slate-600">{formatDate(w.purchase_date)}</td>
                  <td className="p-3.5 text-slate-700 font-semibold">{w.warranty_months} Months</td>
                  <td className="p-3.5 font-bold text-slate-800">{formatDate(w.warranty_end)}</td>
                  <td className="p-3.5 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                      !isExpired ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {!isExpired ? '● ACTIVE WARRANTY' : '● EXPIRED'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
