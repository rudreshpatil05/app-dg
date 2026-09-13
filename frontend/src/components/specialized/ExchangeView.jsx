import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { RefreshCw, Smartphone, CheckCircle, Tag } from 'lucide-react';

export default function ExchangeView() {
  const { formatINR, formatDate, showToast } = useApp();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExchange();
  }, []);

  const loadExchange = async () => {
    setLoading(true);
    try {
      const data = await api.getExchangeDevices();
      setDevices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status, resalePrice) => {
    try {
      await api.updateExchangeStatus(id, { status, resale_price: resalePrice });
      showToast(`Device status updated to ${status}`);
      loadExchange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-indigo-600" />
          Old Phone Exchange & Refurbished Inventory
        </h2>
        <p className="text-xs text-slate-500">Track second-hand smartphones traded in by customers, inspection grading, and resale status</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3.5">Device Model & Specs</th>
              <th className="p-3.5">Old Phone IMEI</th>
              <th className="p-3.5">Condition Report</th>
              <th className="p-3.5 text-right">Exchange Value Given</th>
              <th className="p-3.5 text-right">Expected Resale Price</th>
              <th className="p-3.5 text-center">Status</th>
              <th className="p-3.5 text-center">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devices.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50/70">
                <td className="p-3.5">
                  <p className="font-bold text-slate-900">{d.brand} {d.model}</p>
                  <p className="text-[10px] text-slate-500">{d.ram}/{d.storage} • {d.color}</p>
                </td>
                <td className="p-3.5 font-mono font-bold text-indigo-700">{d.imei || 'N/A'}</td>
                <td className="p-3.5 text-slate-600">
                  <p>Screen: <span className="font-semibold">{d.screen_condition}</span></p>
                  <p className="text-[10px] text-slate-400">Battery: {d.battery_health}</p>
                </td>
                <td className="p-3.5 text-right font-bold text-slate-900 font-display">{formatINR(d.final_exchange_value)}</td>
                <td className="p-3.5 text-right font-bold text-emerald-600 font-display">{formatINR(d.resale_price || 0)}</td>
                <td className="p-3.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                    d.status === 'RESALE' ? 'bg-emerald-100 text-emerald-800' :
                    d.status === 'REFURBISHMENT' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    ● {d.status}
                  </span>
                </td>
                <td className="p-3.5 text-center">
                  <select
                    value={d.status}
                    onChange={(e) => updateStatus(d.id, e.target.value, d.resale_price)}
                    className="text-[11px] bg-white border border-slate-200 rounded px-2 py-1 font-semibold outline-none"
                  >
                    <option value="RECEIVED">Received</option>
                    <option value="INSPECTION_PENDING">Inspection Pending</option>
                    <option value="REFURBISHMENT">Under Refurbishment</option>
                    <option value="RESALE">Ready for Resale</option>
                    <option value="SCRAP">Scrap</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
