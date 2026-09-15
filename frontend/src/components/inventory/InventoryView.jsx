import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { 
  Package, Search, Plus, Filter, Smartphone, 
  AlertTriangle, ShieldCheck, CheckCircle2, Tag, Edit3, X
} from 'lucide-react';

export default function InventoryView() {
  const { formatINR, showToast, isStaff } = useApp();

  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'serials'
  const [products, setProducts] = useState([]);
  const [serials, setSerials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('IN_STOCK');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // New Product Form state
  const [newProduct, setNewProduct] = useState({
    name: '',
    brand: 'Samsung',
    model: '',
    category_id: 1,
    hsn_code: '8517',
    gst_rate: 18,
    mrp: '',
    selling_price: '',
    purchase_cost: '',
    min_stock_level: 2,
    is_serialized: true,
    warranty_months: 12,
    initial_imeis: '' // Line separated or comma separated
  });

  useEffect(() => {
    loadInventory();
  }, [activeTab, statusFilter]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const [prodsData, serialsData, catsData] = await Promise.all([
        api.getProducts(),
        api.getSerialNumbers({ status: statusFilter !== 'ALL' ? statusFilter : undefined }),
        api.getCategories()
      ]);
      const productList = Array.isArray(prodsData) ? prodsData : (prodsData.items || []);
      const serialList = Array.isArray(serialsData) ? serialsData : (serialsData.items || []);
      const categoryList = Array.isArray(catsData) ? catsData : (catsData.items || []);
      setProducts(productList);
      setSerials(serialList);
      setCategories(categoryList);
      if (categoryList.length > 0 && !newProduct.category_id) {
        setNewProduct(prev => ({ ...prev, category_id: categoryList[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.selling_price) {
      showToast('Please fill in product name and selling price', 'error');
      return;
    }

    try {
      const imeisArray = newProduct.initial_imeis
        ? newProduct.initial_imeis.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
        : [];

      const payload = {
        name: newProduct.name,
        brand: newProduct.brand,
        model: newProduct.model || newProduct.name,
        category_id: Number(newProduct.category_id),
        hsn_code: newProduct.hsn_code,
        gst_rate: Number(newProduct.gst_rate),
        mrp: Number(newProduct.mrp) || Number(newProduct.selling_price),
        selling_price: Number(newProduct.selling_price),
        purchase_cost: Number(newProduct.purchase_cost) || 0,
        min_stock_level: Number(newProduct.min_stock_level) || 2,
        is_serialized: newProduct.is_serialized,
        warranty_months: Number(newProduct.warranty_months) || 12,
        initial_stock: imeisArray.length > 0 ? imeisArray.length : 1,
        initial_imeis: imeisArray
      };

      await api.createProduct(payload);
      showToast(`Product "${newProduct.name}" created with ${imeisArray.length} serials!`);
      setShowAddModal(false);
      setNewProduct({
        name: '', brand: 'Samsung', model: '', category_id: categories[0]?.id || 1,
        hsn_code: '8517', gst_rate: 18, mrp: '', selling_price: '', purchase_cost: '',
        min_stock_level: 2, is_serialized: true, warranty_months: 12, initial_imeis: ''
      });
      loadInventory();
    } catch (err) {
      showToast(err.message || 'Failed to create product', 'error');
    }
  };

  const handleUpdateStatus = async (serialId, newStatus) => {
    try {
      await api.updateSerialStatus(serialId, { status: newStatus });
      showToast(`IMEI status updated to ${newStatus}`);
      loadInventory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.barcode && p.barcode.includes(searchQuery));
    const matchesCat = selectedCategory ? String(p.category_id) === String(selectedCategory) : true;
    return matchesSearch && matchesCat;
  });

  const filteredSerials = serials.filter(s => {
    return (s.imei1 && s.imei1.includes(searchQuery)) ||
           (s.imei2 && s.imei2.includes(searchQuery)) ||
           (s.product_name && s.product_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
           (s.serial_number && s.serial_number.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  return (
    <div className="p-4 lg:p-6 space-y-5">
      
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Inventory & Serial Number Management
          </h2>
          <p className="text-xs text-slate-500">Track smartphones by dual-IMEI, manage stock levels, variants, and HSN/GST</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'products' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Products ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('serials')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'serials' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Serialized IMEIs ({serials.length})
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'products' ? "Filter products by brand, model, SKU..." : "Search by exact IMEI, Serial, or Model..."}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-emerald-500"
            />
          </div>
        </div>

        {activeTab === 'products' ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">IMEI Status:</span>
            {['IN_STOCK', 'SOLD', 'RETURNED', 'ALL'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  statusFilter === st ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {activeTab === 'products' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Product & Model</th>
                  <th className="p-3.5">Brand & Category</th>
                  <th className="p-3.5">HSN & GST</th>
                  <th className="p-3.5 text-right">Selling Price</th>
                  {!isStaff && <th className="p-3.5 text-right">Cost Price</th>}
                  <th className="p-3.5 text-center">Stock Level</th>
                  <th className="p-3.5 text-center">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isLow = p.current_stock <= p.min_stock_level;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900 text-xs">{p.name}</p>
                        {p.barcode && <p className="text-[10px] text-slate-400 font-mono">Barcode: {p.barcode}</p>}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-800">{p.brand}</span>
                        <p className="text-[10px] text-slate-500">{p.category_name || 'General'}</p>
                      </td>
                      <td className="p-3.5 font-mono">
                        <span className="text-slate-800">{p.hsn_code}</span>
                        <span className="text-[10px] text-slate-500 ml-1">({p.gst_rate}%)</span>
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-900 font-display">
                        {formatINR(p.selling_price)}
                        <p className="text-[10px] text-slate-400 font-normal">MRP: {formatINR(p.mrp)}</p>
                      </td>
                      {!isStaff && (
                        <td className="p-3.5 text-right font-semibold text-slate-600 font-display">
                          {formatINR(p.purchase_cost)}
                        </td>
                      )}
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] ${
                          isLow ? 'bg-rose-100 text-rose-700 font-extrabold' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isLow && '⚠️'} {p.current_stock} {p.is_serialized ? 'units' : 'pcs'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {p.is_serialized ? '📱 IMEI Serialized' : '📦 Accessory'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Device & Model</th>
                  <th className="p-3.5">Primary IMEI (15-Digit)</th>
                  <th className="p-3.5">IMEI 2 / Serial</th>
                  <th className="p-3.5">Specs & Color</th>
                  <th className="p-3.5 text-right">Selling Price</th>
                  {!isStaff && <th className="p-3.5 text-right">Purchase Cost</th>}
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSerials.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5">
                      <p className="font-bold text-slate-900">{s.product_name}</p>
                      <p className="text-[10px] text-slate-500">{s.brand} • {s.model}</p>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-700">
                      {s.imei1 || 'N/A'}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {s.imei2 || s.serial_number || 'N/A'}
                    </td>
                    <td className="p-3.5 text-slate-700">
                      {s.color || 'Standard'} {s.ram ? `(${s.ram}/${s.storage})` : ''}
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-900 font-display">
                      {formatINR(s.selling_price)}
                    </td>
                    {!isStaff && (
                      <td className="p-3.5 text-right font-semibold text-slate-600 font-display">
                        {formatINR(s.purchase_cost)}
                      </td>
                    )}
                    <td className="p-3.5 text-center">
                      <span className={`inline-block font-bold text-[10px] px-2 py-0.5 rounded-full uppercase ${
                        s.status === 'IN_STOCK' ? 'bg-emerald-100 text-emerald-800' :
                        s.status === 'SOLD' ? 'bg-slate-200 text-slate-700' :
                        s.status === 'RETURNED' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        ● {s.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <select
                        value={s.status}
                        onChange={(e) => handleUpdateStatus(s.id, e.target.value)}
                        className="text-[11px] bg-white border border-slate-200 rounded px-2 py-1 font-semibold outline-none"
                      >
                        <option value="IN_STOCK">In Stock</option>
                        <option value="SOLD">Sold</option>
                        <option value="RETURNED">Returned</option>
                        <option value="DAMAGED">Damaged</option>
                        <option value="UNDER_REPAIR">Under Repair</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product & IMEI Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl p-6 border border-slate-200 space-y-4 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Add New Product & IMEIs</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="e.g. Samsung Galaxy S24 (256GB)"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Brand</label>
                  <input
                    type="text"
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                    placeholder="e.g. Apple, Samsung, OnePlus, boAt"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Category</label>
                  <select
                    value={newProduct.category_id}
                    onChange={(e) => setNewProduct({ ...newProduct, category_id: Number(e.target.value) })}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">HSN Code</label>
                  <input
                    type="text"
                    value={newProduct.hsn_code}
                    onChange={(e) => setNewProduct({ ...newProduct, hsn_code: e.target.value })}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">GST Rate (%)</label>
                  <select
                    value={newProduct.gst_rate}
                    onChange={(e) => setNewProduct({ ...newProduct, gst_rate: Number(e.target.value) })}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value={18}>18% (Smartphones & Electronics)</option>
                    <option value={12}>12%</option>
                    <option value={28}>28%</option>
                    <option value={0}>0% (Non-GST)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    value={newProduct.selling_price}
                    onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })}
                    placeholder="e.g. 64999"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">MRP (₹)</label>
                  <input
                    type="number"
                    value={newProduct.mrp}
                    onChange={(e) => setNewProduct({ ...newProduct, mrp: e.target.value })}
                    placeholder="e.g. 69999"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    value={newProduct.purchase_cost}
                    onChange={(e) => setNewProduct({ ...newProduct, purchase_cost: e.target.value })}
                    placeholder="e.g. 58000"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-semibold"
                  />
                </div>
              </div>

              {/* Serialized Checkbox */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProduct.is_serialized}
                    onChange={(e) => setNewProduct({ ...newProduct, is_serialized: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>This item requires unique 15-digit IMEI / Serial Numbers (Mobile phones, Tablets, Laptops)</span>
                </label>

                {newProduct.is_serialized && (
                  <div>
                    <label className="text-[11px] text-slate-500 block mt-2">
                      Enter Initial IMEIs (one per line, or comma-separated):
                    </label>
                    <textarea
                      rows={3}
                      value={newProduct.initial_imeis}
                      onChange={(e) => setNewProduct({ ...newProduct, initial_imeis: e.target.value })}
                      placeholder="358921118234001&#10;358921118234002"
                      className="w-full p-2 mt-1 border border-slate-300 rounded-lg font-mono text-xs outline-none focus:border-emerald-500 bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Save Product & IMEIs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
