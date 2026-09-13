import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { ShoppingBag, Plus, Search, Truck, X, Smartphone, CheckCircle } from 'lucide-react';

export default function PurchasesView() {
  const { formatINR, formatDate, showToast } = useApp();

  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // New Purchase Bill form
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([
    { product_id: '', unit_cost: '', quantity: 1, gst_rate: 18, imeis_text: '' }
  ]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('BANK');

  useEffect(() => {
    loadPurchasesData();
  }, []);

  const loadPurchasesData = async () => {
    setLoading(true);
    try {
      const [purchasesData, suppliersData, productsData] = await Promise.all([
        api.getPurchases(),
        api.getSuppliers(),
        api.getProducts()
      ]);
      setPurchases(purchasesData);
      setSuppliers(suppliersData);
      setProducts(productsData);
      if (suppliersData.length > 0) setSupplierId(suppliersData[0].id);
      if (productsData.length > 0) {
        setItems([{ product_id: productsData[0].id, unit_cost: productsData[0].purchase_cost, quantity: 1, gst_rate: 18, imeis_text: '' }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addItemRow = () => {
    setItems([...items, { product_id: products[0]?.id || '', unit_cost: '', quantity: 1, gst_rate: 18, imeis_text: '' }]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id') {
      const p = products.find(prod => String(prod.id) === String(value));
      if (p) {
        updated[index].unit_cost = p.purchase_cost;
      }
    }
    setItems(updated);
  };

  const removeItemRow = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, idx) => idx !== index));
    }
  };

  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    if (!invoiceNumber || !supplierId) {
      showToast('Please enter distributor invoice number and supplier', 'error');
      return;
    }

    try {
      const preparedItems = items.map(it => {
        const prod = products.find(p => String(p.id) === String(it.product_id));
        const imeisArray = it.imeis_text ? it.imeis_text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) : [];

        return {
          product_id: Number(it.product_id),
          quantity: prod?.is_serialized && imeisArray.length > 0 ? imeisArray.length : Number(it.quantity) || 1,
          unit_cost: Number(it.unit_cost) || 0,
          gst_rate: Number(it.gst_rate) || 18,
          imeis: imeisArray
        };
      });

      await api.createPurchase({
        supplier_id: Number(supplierId),
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        items: preparedItems,
        discount: Number(discount) || 0,
        paid_amount: Number(paidAmount) || 0,
        payment_method: paymentMethod
      });

      showToast(`Purchase Bill #${invoiceNumber} recorded and inventory updated!`);
      setShowAddModal(false);
      setInvoiceNumber('');
      loadPurchasesData();
    } catch (err) {
      showToast(err.message || 'Failed to record purchase', 'error');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            Purchases & Distributor Invoices
          </h2>
          <p className="text-xs text-slate-500">Record inward stock from distributors with bulk IMEI registration</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" /> Record Purchase Bill
        </button>
      </div>

      {/* Purchases List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3.5">Distributor Bill #</th>
              <th className="p-3.5">Supplier Name</th>
              <th className="p-3.5">Date</th>
              <th className="p-3.5 text-right">Bill Total</th>
              <th className="p-3.5 text-right">Paid Amount</th>
              <th className="p-3.5 text-right">Balance Due</th>
              <th className="p-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5">
                  <span className="font-bold text-slate-900 font-mono">{p.invoice_number}</span>
                  <p className="text-[10px] text-slate-400">{p.items.length} product lines</p>
                </td>
                <td className="p-3.5">
                  <span className="font-semibold text-slate-800">{p.supplier_name}</span>
                </td>
                <td className="p-3.5 text-slate-600">{formatDate(p.invoice_date)}</td>
                <td className="p-3.5 text-right font-bold text-slate-900 font-display">{formatINR(p.total_amount)}</td>
                <td className="p-3.5 text-right font-semibold text-emerald-600 font-display">{formatINR(p.paid_amount)}</td>
                <td className="p-3.5 text-right font-bold text-rose-600 font-display">{formatINR(p.balance_due)}</td>
                <td className="p-3.5 text-center">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    p.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    ● {p.payment_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Record Purchase Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl p-6 border border-slate-200 space-y-4 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Record Inward Purchase Bill</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.company || s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Supplier Invoice No *</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. ABC/2026/0991"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>Inward Items & IMEIs</span>
                  <button type="button" onClick={addItemRow} className="text-blue-600 hover:underline">+ Add Line</button>
                </div>

                {items.map((it, idx) => {
                  const prod = products.find(p => String(p.id) === String(it.product_id));

                  return (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <label className="text-[10px] text-slate-500">Product</label>
                          <select
                            value={it.product_id}
                            onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded-lg bg-white"
                          >
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Purchase Cost (₹)</label>
                          <input
                            type="number"
                            value={it.unit_cost}
                            onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded-lg font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Quantity</label>
                          <input
                            type="number"
                            value={it.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>

                      {prod?.is_serialized && (
                        <div>
                          <label className="text-[10px] text-slate-500">
                            IMEIs to Register (one per line, auto-counts quantity):
                          </label>
                          <textarea
                            rows={2}
                            value={it.imeis_text}
                            onChange={(e) => updateItem(idx, 'imeis_text', e.target.value)}
                            placeholder="358921118234101&#10;358921118234102"
                            className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs bg-white"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="font-semibold text-slate-700">Paid Amount (₹)</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Payment Mode</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="BANK">Bank Account</option>
                    <option value="UPI">Shop UPI</option>
                    <option value="CASH">Cash Drawer</option>
                    <option value="CREDIT">Full Credit (Payable)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Discount (₹)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Record Bill & Inward Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
