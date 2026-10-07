import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { 
  Search, Plus, Trash2, Smartphone, Receipt, User, ShoppingCart, ArrowLeft,
  CreditCard, DollarSign, QrCode, MessageSquare, Printer, 
  RefreshCw, CheckCircle, AlertCircle, X, Percent, Shield
} from 'lucide-react';

const EMI_DURATIONS = [3, 6, 9, 12, 15, 18, 24];

export default function POSBilling() {
  const { business, formatINR, showToast, currentRole, setActiveTab } = useApp();

  const [products, setProducts] = useState([]);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: 'Walk-in Customer', phone: '', address: '', gstin: '' });
  const [savedCustomers, setSavedCustomers] = useState([]);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [isGstInvoice, setIsGstInvoice] = useState(true);

  // Exchange Device state
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeDevice, setExchangeDevice] = useState(null);
  const [exchangeForm, setExchangeForm] = useState({
    brand: 'OnePlus', model: 'Nord CE 2', imei: '', ram: '8GB', storage: '128GB',
    screen_condition: 'Good', body_condition: 'Good', battery_health: 'Above 80%',
    accessories_included: 'Box and Original Charger', final_exchange_value: 0
  });

  // Payment splits state
  const [paymentSplits, setPaymentSplits] = useState([
    { payment_method: 'CASH', amount: 0, reference_number: '' }
  ]);
  const [selectedPrimaryMethod, setSelectedPrimaryMethod] = useState('CASH');

  // EMI Configuration state
  const [isEmiSelected, setIsEmiSelected] = useState(false);
  const [emiConfig, setEmiConfig] = useState({
    number_of_installments: 6,
    interest_rate: 0, // 0% interest promotion
    processing_fee: 500,
    finance_provider: '',
    notes: 'Store promotional 0% EMI scheme'
  });

  // Invoice / Receipt Preview modal
  const [completedSale, setCompletedSale] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [printFormat, setPrintFormat] = useState('thermal'); // 'thermal' or 'a4'
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const prods = await api.getProducts();
      setProducts(prods);
      const serials = await api.getSerialNumbers({ status: 'IN_STOCK' });
      setAvailableSerials(serials);
      const custs = await api.getCustomers();
      setSavedCustomers(custs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProductScan = async (event) => {
    event.preventDefault();
    const code = scanInput.trim();
    if (!code || isScanning) return;

    setIsScanning(true);
    setScanResult(null);
    try {
      const result = await api.searchImeiOrBarcode(code);
      setScanResult(result);
      if (!result.found) return;

      const product = products.find((item) => item.id === result.product_id) || {
        id: result.product_id,
        name: result.product_name,
        brand: result.brand,
        model: result.model,
        sku: result.sku,
        barcode: result.barcode,
        is_serialized: result.type === 'SERIAL_DEVICE' || result.is_serialized,
        selling_price: result.selling_price,
        mrp: result.mrp,
        gst_rate: result.gst_rate,
        hsn_code: result.hsn_code,
        current_stock: result.current_stock,
      };

      if (!result.is_available) {
        showToast(`Product found, but it is ${result.status || 'out of stock'}.`, 'error');
        return;
      }

      const serial = result.type === 'SERIAL_DEVICE' ? {
        id: result.serial_id,
        product_id: result.product_id,
        imei1: result.imei1,
        imei2: result.imei2,
        serial_number: result.serial_number,
        color: result.color,
        storage: result.storage,
        selling_price: result.selling_price,
      } : null;
      addToCart(product, serial);
      setScanInput('');
    } catch (error) {
      setScanResult({ found: false, message: error.message });
    } finally {
      setIsScanning(false);
    }
  };

  // Add Product to Cart
  const addToCart = (product, serial = null) => {
    // If product is serialized and no serial provided, find first in-stock serial
    let chosenSerial = serial;
    if (product.is_serialized && !chosenSerial) {
      chosenSerial = availableSerials.find(
        s => s.product_id === product.id && !cart.some(c => c.serial_number_id === s.id)
      );
      if (!chosenSerial) {
        showToast(`No in-stock IMEI available for ${product.name}`, 'error');
        return;
      }
    }

    if (chosenSerial && cart.some(c => c.serial_number_id === chosenSerial.id)) {
      showToast('This IMEI is already added in cart', 'error');
      return;
    }

    const newItem = {
      cart_id: Date.now() + Math.random(),
      product_id: product.id,
      product_name: product.name,
      brand: product.brand,
      model: product.model,
      is_serialized: product.is_serialized,
      serial_number_id: chosenSerial ? chosenSerial.id : null,
      imei1: chosenSerial ? chosenSerial.imei1 : null,
      imei2: chosenSerial ? chosenSerial.imei2 : null,
      serial_number: chosenSerial ? chosenSerial.serial_number : null,
      color: chosenSerial ? chosenSerial.color : '',
      storage: chosenSerial ? chosenSerial.storage : '',
      quantity: 1,
      unit_price: chosenSerial?.selling_price || product.selling_price,
      unit_mrp: product.mrp,
      discount: 0,
      gst_rate: product.gst_rate || 18,
      hsn_code: product.hsn_code || '8517'
    };

    setCart([...cart, newItem]);
    showToast(`Added ${product.name} to cart`);
  };

  const removeFromCart = (cart_id) => {
    setCart(cart.filter(item => item.cart_id !== cart_id));
  };

  const updateCartItemPrice = (cart_id, newPrice) => {
    setCart(cart.map(item => item.cart_id === cart_id ? { ...item, unit_price: Number(newPrice) || 0 } : item));
  };

  const updateCartItemDiscount = (cart_id, discount) => {
    setCart(cart.map(item => item.cart_id === cart_id ? { ...item, discount: Number(discount) || 0 } : item));
  };

  // Financial Calculations
  const cartSubtotal = cart.reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);
  const cartItemDiscounts = cart.reduce((sum, it) => sum + Number(it.discount || 0), 0);
  const totalDiscount = cartItemDiscounts + Number(overallDiscount || 0);
  const grandTotal = Math.max(0, cartSubtotal - totalDiscount);
  const exchangeDeduction = exchangeDevice ? Number(exchangeDevice.final_exchange_value || 0) : 0;
  const finalPayable = Math.max(0, grandTotal - exchangeDeduction);
  const emiDownPayment = Number(paymentSplits[0]?.amount || 0);
  const emiFinancedAmount = Math.max(0, finalPayable - emiDownPayment);
  const emiInterestRate = Number(emiConfig.interest_rate || 0);
  const emiProcessingFee = Number(emiConfig.processing_fee || 0);
  const emiInterestAmount = Math.round(((emiFinancedAmount * emiInterestRate * (emiConfig.number_of_installments / 12)) / 100) * 100) / 100;
  const emiTotalRepayable = Math.round((emiFinancedAmount + emiInterestAmount + emiProcessingFee) * 100) / 100;
  const emiMonthlyAmount = Math.round((emiTotalRepayable / emiConfig.number_of_installments) * 100) / 100;
  const emiInputInvalid = emiDownPayment < 0 || emiDownPayment > finalPayable || emiInterestRate < 0 || emiProcessingFee < 0;

  // Auto-sync payment split with finalPayable
  useEffect(() => {
    if (!isEmiSelected) {
      setPaymentSplits([{ payment_method: selectedPrimaryMethod, amount: finalPayable, reference_number: '' }]);
    }
  }, [finalPayable, selectedPrimaryMethod, isEmiSelected]);

  const handleApplyExchange = () => {
    if (Number(exchangeForm.final_exchange_value) <= 0) {
      showToast('Please enter a valid exchange valuation', 'error');
      return;
    }
    setExchangeDevice({ ...exchangeForm });
    setShowExchangeModal(false);
    showToast(`Exchange deduction ₹${exchangeForm.final_exchange_value} applied!`);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Add products to bill.', 'error');
      return;
    }

    if (!customer.phone || customer.phone.length < 10) {
      showToast('Please enter a 10-digit customer mobile number for invoice & warranty record.', 'error');
      return;
    }

    if (isEmiSelected && emiInputInvalid) {
      showToast('Down payment must be between zero and the final payable amount.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer: {
          name: customer.name || 'Customer',
          phone: customer.phone,
          address: customer.address || '',
          gstin: customer.gstin || ''
        },
        items: cart.map(it => ({
          product_id: it.product_id,
          serial_number_id: it.serial_number_id,
          imei1: it.imei1,
          imei2: it.imei2,
          serial_number: it.serial_number,
          quantity: it.quantity,
          unit_price: it.unit_price,
          unit_mrp: it.unit_mrp,
          discount: it.discount,
          gst_rate: it.gst_rate
        })),
        discount_amount: Number(overallDiscount || 0),
        is_gst_invoice: isGstInvoice,
        exchange_device: exchangeDevice ? {
          brand: exchangeDevice.brand,
          model: exchangeDevice.model,
          imei: exchangeDevice.imei,
          ram: exchangeDevice.ram,
          storage: exchangeDevice.storage,
          screen_condition: exchangeDevice.screen_condition,
          body_condition: exchangeDevice.body_condition,
          battery_health: exchangeDevice.battery_health,
          accessories_included: exchangeDevice.accessories_included,
          final_exchange_value: Number(exchangeDevice.final_exchange_value)
        } : null,
        payments: paymentSplits.map(p => ({
          payment_method: p.payment_method,
          amount: Number(p.amount),
          reference_number: p.reference_number || null
        })),
        emi_details: isEmiSelected ? emiConfig : null,
        notes: isEmiSelected ? 'Store Financed EMI Purchase' : 'POS Counter Sale'
      };

      const saleResult = await api.checkoutPOS(payload);
      setCompletedSale(saleResult);
      setShowReceiptModal(true);
      showToast(`Sale Invoice #${saleResult.invoice_number} created successfully!`);

      // Reset cart and reload stock
      setCart([]);
      setExchangeDevice(null);
      setCustomer({ name: 'Walk-in Customer', phone: '', address: '', gstin: '' });
      setOverallDiscount(0);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to complete sale', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalizeCategory = (categoryName) => {
    const name = (categoryName || '').toLowerCase();
    if (name.includes('phone') || name.includes('mobile') || name.includes('smartphone')) return 'Mobile Phones';
    if (name.includes('accessor')) return 'Inventory & Accessories';
    return categoryName || 'Other Products';
  };

  const categoryGroups = products.reduce((groups, product) => {
    const category = normalizeCategory(product.category_name);
    if (!groups[category]) groups[category] = [];
    groups[category].push(product);
    return groups;
  }, {});

  const categoryEntries = Object.entries(categoryGroups)
    .map(([name, categoryProducts]) => ({ name, products: categoryProducts }))
    .filter((category) => category.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const selectedCategoryProducts = selectedCategory ? categoryGroups[selectedCategory] || [] : [];
  const brandEntries = [...new Set(selectedCategoryProducts.map((product) => product.brand).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second))
    .filter((brand) => brand.toLowerCase().includes(searchQuery.toLowerCase()));

  const selectedBrandProducts = selectedCategoryProducts.filter((product) => product.brand === selectedBrand);
  const filteredProducts = selectedBrandProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.model && product.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (product.barcode && product.barcode.includes(searchQuery))
  );

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            Counter POS Billing Terminal
          </h2>
          <p className="text-xs text-slate-500">Fast IMEI scanning, mixed split payments, exchange buyback, and GST billing</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsGstInvoice(!isGstInvoice)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              isGstInvoice ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {isGstInvoice ? 'Tax Invoice (GST 18%)' : 'Non-GST Bill (Estimate)'}
          </button>
          <button
            onClick={() => setShowExchangeModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              exchangeDevice ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{exchangeDevice ? `Exchange: -₹${exchangeDevice.final_exchange_value}` : '+ Old Phone Exchange'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Catalog / Scan, Right = Live Cart & Checkout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Product Picker & IMEI Quick Grid */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 text-white space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2"><QrCode className="w-4 h-4 text-emerald-300" /> Scan product to sell</h3>
                <p className="text-[11px] text-slate-300 mt-1">Scan a barcode, QR value, IMEI, or serial number. Press Enter after a scanner beep.</p>
              </div>
              {isScanning && <RefreshCw className="w-4 h-4 text-emerald-300 animate-spin" />}
            </div>
            <form onSubmit={handleProductScan} className="flex gap-2">
              <input
                autoFocus
                value={scanInput}
                onChange={(event) => setScanInput(event.target.value)}
                placeholder="Scan IMEI / barcode / SKU..."
                className="flex-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-400"
              />
              <button type="submit" disabled={isScanning || !scanInput.trim()} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-xs font-bold">Find & add</button>
            </form>
            {scanResult && (
              <div className={`rounded-lg p-3 text-xs ${scanResult.found ? 'bg-white/10 border border-emerald-400/40' : 'bg-rose-500/15 border border-rose-300/40'}`}>
                {!scanResult.found ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-rose-100">Product not found</span>
                    <button type="button" onClick={() => setActiveTab('inventory')} className="px-2.5 py-1.5 rounded-md bg-white text-slate-900 font-bold">Add new product</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                    <span className="col-span-2 font-bold text-white">{scanResult.brand} {scanResult.model || scanResult.product_name}</span>
                    <span>Stock: <b>{scanResult.current_stock ?? '-'}</b></span>
                    <span>Price: <b>{formatINR(scanResult.selling_price)}</b></span>
                    <span>IMEI 1: <b>{scanResult.imei1 || '-'}</b></span>
                    <span>IMEI 2: <b>{scanResult.imei2 || '-'}</b></span>
                    <span>Serial: <b>{scanResult.serial_number || '-'}</b></span>
                    <span>SKU: <b>{scanResult.sku || '-'}</b></span>
                    <span>Warranty: <b>{scanResult.warranty_months ? `${scanResult.warranty_months} months` : '-'}</b></span>
                    <span>Supplier: <b>{scanResult.supplier || '-'}</b></span>
                    <span>Purchase date: <b>{scanResult.purchase_date || '-'}</b></span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            {/* Category -> Brand -> Product selection */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={selectedBrand ? `Search ${selectedBrand} models or barcode...` : selectedCategory ? 'Search brands...' : 'Search categories...'}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between min-h-7">
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBrand) setSelectedBrand(null);
                    else setSelectedCategory(null);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              )}
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-auto">
                {!selectedCategory ? 'Choose a category' : !selectedBrand ? `${selectedCategory} / Choose a brand` : `${selectedBrand} models`}
              </span>
            </div>

            {!selectedCategory && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
                {categoryEntries.map((category) => (
                  <button
                    type="button"
                    key={category.name}
                    onClick={() => {
                      setSelectedCategory(category.name);
                      setSearchQuery('');
                    }}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50/40 hover:border-emerald-400 text-left transition-all"
                  >
                    <Smartphone className="w-5 h-5 text-emerald-600 mb-2" />
                    <p className="text-xs font-bold text-slate-800">{category.name}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{category.products.length} products</p>
                  </button>
                ))}
                {categoryEntries.length === 0 && (
                  <div className="col-span-full py-10 text-center text-xs text-slate-500">
                    No product categories are available for this store.
                  </div>
                )}
              </div>
            )}

            {selectedCategory && !selectedBrand && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
                {brandEntries.map((brand) => (
                  <button
                    type="button"
                    key={brand}
                    onClick={() => {
                      setSelectedBrand(brand);
                      setSearchQuery('');
                    }}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50/40 hover:border-emerald-400 text-left transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-extrabold mb-2">
                      {brand.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="text-xs font-bold text-slate-800">{brand}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {selectedCategoryProducts.filter((product) => product.brand === brand).length} models
                    </p>
                  </button>
                ))}
                {brandEntries.length === 0 && (
                  <div className="col-span-full py-10 text-center text-xs text-slate-500">
                    No brands are available in {selectedCategory}.
                  </div>
                )}
              </div>
            )}

            {selectedCategory && selectedBrand && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
              {filteredProducts.map((p) => {
                const inStockSerials = availableSerials.filter(s => s.product_id === p.id);
                const isOutOfStock = p.is_serialized ? inStockSerials.length === 0 : p.current_stock <= 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isOutOfStock
                        ? 'bg-slate-50/60 border-slate-200 opacity-60 cursor-not-allowed'
                        : 'bg-white hover:bg-emerald-50/40 hover:border-emerald-400 border-slate-200 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{p.brand}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isOutOfStock ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {p.is_serialized ? `${inStockSerials.length} IMEI` : `${p.current_stock} pcs`}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-2 mt-1">{p.name}</h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600 font-display">
                        {formatINR(p.selling_price)}
                      </span>
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                    </div>
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-10 text-center text-xs text-slate-500">
                  No {selectedBrand} products match your search or are available in stock.
                </div>
              )}
            </div>
            )}
          </div>

          {/* Quick Available Serial Numbers (Mobiles) Grid */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-2.5">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              Available Serialized Stock (Click IMEI to Add)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {availableSerials.slice(0, 8).map((s) => {
                const prod = products.find(p => p.id === s.product_id);
                const isAlreadyInCart = cart.some(c => c.serial_number_id === s.id);

                return (
                  <div
                    key={s.id}
                    onClick={() => !isAlreadyInCart && prod && addToCart(prod, s)}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer ${
                      isAlreadyInCart
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-50 hover:bg-emerald-50 hover:border-emerald-400 border-slate-200'
                    }`}
                  >
                    <div className="truncate">
                      <p className="font-semibold text-slate-800 truncate">{prod?.name || 'Mobile Phone'}</p>
                      <p className="font-mono text-[11px] text-slate-500">IMEI: {s.imei1 || s.serial_number}</p>
                    </div>
                    <span className="font-bold text-slate-700 font-display ml-2">{formatINR(s.selling_price || prod?.selling_price)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Active Cart, Customer Info & Checkout */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            
            {/* Customer Details Bar */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" /> Customer Details
                </span>
                {customer.phone && (
                  <span className="text-[10px] text-emerald-600 font-semibold">WhatsApp Enabled</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="Customer Name"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                />
                <input
                  type="tel"
                  maxLength={10}
                  value={customer.phone}
                  onChange={(e) => {
                    const phone = e.target.value;
                    const existing = savedCustomers.find(c => c.phone === phone);
                    if (existing) {
                      setCustomer({ name: existing.name, phone: existing.phone, address: existing.address, gstin: existing.gstin });
                    } else {
                      setCustomer({ ...customer, phone });
                    }
                  }}
                  placeholder="Mobile (10-digits)"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Cart Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-1 border-b border-slate-100">
                <span>Items in Cart ({cart.length})</span>
                <button onClick={() => setCart([])} className="text-slate-400 hover:text-rose-500 text-[11px]">Clear All</button>
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Cart is empty. Click a phone or accessory to add.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.cart_id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between gap-2">
                      <div className="flex-1 truncate">
                        <p className="font-bold text-slate-900 truncate">{item.product_name}</p>
                        {item.imei1 && (
                          <p className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                            IMEI: {item.imei1}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500">HSN: {item.hsn_code} • GST {item.gst_rate}%</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateCartItemPrice(item.cart_id, e.target.value)}
                            className="w-20 text-right font-bold text-slate-900 bg-white border border-slate-200 rounded px-1 py-0.5 text-xs"
                          />
                          {item.discount > 0 && (
                            <p className="text-[10px] text-rose-600">-₹{item.discount}</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.cart_id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bill Summary Calculations */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-medium">{formatINR(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Special Discount:</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">₹</span>
                  <input
                    type="number"
                    value={overallDiscount}
                    onChange={(e) => setOverallDiscount(e.target.value)}
                    className="w-16 px-1.5 py-0.5 text-right bg-white border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>
              {exchangeDevice && (
                <div className="flex justify-between text-indigo-700 font-semibold bg-indigo-50/80 p-1.5 rounded">
                  <span>Old Phone Exchange ({exchangeDevice.brand} {exchangeDevice.model}):</span>
                  <span>-₹{exchangeDevice.final_exchange_value}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>Net Payable:</span>
                <span className="text-emerald-700 font-display text-base">{formatINR(finalPayable)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Payment Method</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'CASH', label: 'Cash', icon: DollarSign },
                  { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                  { id: 'CARD', label: 'Card', icon: CreditCard },
                  { id: 'EMI', label: 'Store EMI', icon: Percent },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedPrimaryMethod(m.id);
                      setIsEmiSelected(m.id === 'EMI');
                      if (m.id === 'EMI') {
                        setPaymentSplits([{ payment_method: 'CASH', amount: 0, reference_number: '' }]);
                      }
                    }}
                    className={`py-2 px-1.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      (isEmiSelected ? m.id === 'EMI' : selectedPrimaryMethod === m.id)
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <m.icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Store-Financed EMI Drawer if EMI selected */}
            {isEmiSelected && (
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-indigo-600" /> Store-Financed EMI Plan
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Live calculation</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500">EMI provider / finance company</label>
                    <input
                      type="text"
                      value={emiConfig.finance_provider}
                      onChange={(e) => setEmiConfig({ ...emiConfig, finance_provider: e.target.value })}
                      placeholder="Optional provider name"
                      className="w-full bg-white border border-indigo-200 rounded p-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Product price</label>
                    <p className="mt-1 px-2 py-1.5 bg-white/70 border border-indigo-100 rounded font-bold text-slate-800">{formatINR(finalPayable)}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Down payment</label>
                    <input
                      type="number"
                      min="0"
                      max={finalPayable}
                      step="0.01"
                      value={paymentSplits[0]?.amount ?? 0}
                      onChange={(e) => setPaymentSplits([{ payment_method: 'CASH', amount: e.target.value, reference_number: '' }])}
                      className={`w-full bg-white border rounded p-1.5 text-xs font-semibold ${emiInputInvalid ? 'border-rose-400' : 'border-indigo-200'}`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Interest rate (% yearly)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={emiConfig.interest_rate}
                      onChange={(e) => setEmiConfig({ ...emiConfig, interest_rate: e.target.value })}
                      className="w-full bg-white border border-indigo-200 rounded p-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Processing fee</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={emiConfig.processing_fee}
                      onChange={(e) => setEmiConfig({ ...emiConfig, processing_fee: e.target.value })}
                      className="w-full bg-white border border-indigo-200 rounded p-1.5 text-xs font-semibold"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Available plans</p>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {EMI_DURATIONS.map((duration) => {
                      const durationInterest = Math.round(((emiFinancedAmount * emiInterestRate * (duration / 12)) / 100) * 100) / 100;
                      const durationTotal = Math.round((emiFinancedAmount + durationInterest + emiProcessingFee) * 100) / 100;
                      const durationMonthly = Math.round((durationTotal / duration) * 100) / 100;
                      return (
                        <button
                          key={duration}
                          type="button"
                          onClick={() => setEmiConfig({ ...emiConfig, number_of_installments: duration })}
                          className={`px-1 py-1.5 rounded-lg border text-center ${emiConfig.number_of_installments === duration ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white text-slate-700 border-indigo-100 hover:border-indigo-400'}`}
                        >
                          <span className="block font-bold">{duration}m</span>
                          <span className="block text-[10px]">{formatINR(durationMonthly)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-white/70 border border-indigo-100 rounded-lg p-2">
                  <div><span className="block text-[10px] text-slate-500">Financed amount</span><strong>{formatINR(emiFinancedAmount)}</strong></div>
                  <div><span className="block text-[10px] text-slate-500">Interest</span><strong>{formatINR(emiInterestAmount)}</strong></div>
                  <div><span className="block text-[10px] text-slate-500">Total payable</span><strong>{formatINR(emiTotalRepayable)}</strong></div>
                  <div><span className="block text-[10px] text-slate-500">Remaining balance</span><strong>{formatINR(emiTotalRepayable)}</strong></div>
                  <div><span className="block text-[10px] text-slate-500">Monthly EMI</span><strong className="text-indigo-800">{formatINR(emiMonthlyAmount)}</strong></div>
                </div>
                {emiInputInvalid && <p className="text-[11px] font-semibold text-rose-700">Down payment cannot be negative or greater than the product price.</p>}
              </div>
            )}

            {/* Complete Sale Button */}
            <button
              onClick={handleCheckout}
              disabled={isSubmitting || cart.length === 0}
              className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                isSubmitting || cart.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-98'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Generating Bill...' : `Complete Sale • ${formatINR(finalPayable)}`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Old Phone Exchange Trade-In Wizard Modal */}
      {showExchangeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Old Phone Exchange Valuation</h3>
              </div>
              <button onClick={() => setShowExchangeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Brand</label>
                  <input
                    type="text"
                    value={exchangeForm.brand}
                    onChange={(e) => setExchangeForm({ ...exchangeForm, brand: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Model</label>
                  <input
                    type="text"
                    value={exchangeForm.model}
                    onChange={(e) => setExchangeForm({ ...exchangeForm, model: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600">Old Phone IMEI</label>
                <input
                  type="text"
                  maxLength={15}
                  value={exchangeForm.imei}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, imei: e.target.value })}
                  placeholder="15-digit IMEI number"
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Screen Condition</label>
                  <select
                    value={exchangeForm.screen_condition}
                    onChange={(e) => setExchangeForm({ ...exchangeForm, screen_condition: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option>Good (No Scratches)</option>
                    <option>Minor Scratches</option>
                    <option>Cracked Glass</option>
                    <option>Touch Issue / Dead Pixel</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Battery Health</label>
                  <select
                    value={exchangeForm.battery_health}
                    onChange={(e) => setExchangeForm({ ...exchangeForm, battery_health: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option>Above 80%</option>
                    <option>75% - 80%</option>
                    <option>Needs Replacement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600">Final Exchange Value (₹)</label>
                <input
                  type="number"
                  value={exchangeForm.final_exchange_value}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, final_exchange_value: e.target.value })}
                  placeholder="e.g. 8000"
                  className="w-full p-2 border border-indigo-300 rounded-lg font-bold text-sm text-indigo-700 bg-indigo-50/50 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowExchangeModal(false)}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyExchange}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Apply Trade-in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Completed Modal & Dual Format Receipt Preview */}
      {showReceiptModal && completedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6 border border-slate-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Invoice #{completedSale.invoice_number}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintFormat('thermal')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${
                    printFormat === 'thermal' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  80mm Thermal Slip
                </button>
                <button
                  onClick={() => setPrintFormat('a4')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${
                    printFormat === 'a4' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  A4 / A5 Tax Invoice
                </button>
                <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-slate-600 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60 flex justify-center">
              
              {/* Format 1: 80mm Thermal Receipt */}
              {printFormat === 'thermal' && (
                <div id="printable-receipt" className="w-[320px] bg-white p-5 shadow-md border border-slate-200 font-mono text-[11px] leading-tight text-slate-900 space-y-3">
                  <div className="text-center border-b border-dashed border-slate-400 pb-2">
                    <h2 className="text-sm font-bold uppercase">{business.name}</h2>
                    <p className="text-[10px] text-slate-600">{business.address || `${business.city}, Maharashtra`}</p>
                    <p className="text-[10px]">Ph: {business.phone} | GSTIN: {business.gstin}</p>
                    <p className="font-bold mt-1 text-xs">TAX INVOICE</p>
                  </div>

                  <div className="space-y-0.5 text-[10px] border-b border-dashed border-slate-400 pb-2">
                    <div className="flex justify-between">
                      <span>Inv No: {completedSale.invoice_number}</span>
                      <span>Date: {completedSale.invoice_date}</span>
                    </div>
                    <p>Cust: {completedSale.customer_name} ({completedSale.customer_phone})</p>
                  </div>

                  <div className="border-b border-dashed border-slate-400 pb-2">
                    <div className="flex justify-between font-bold mb-1">
                      <span>Item</span>
                      <span>Amount</span>
                    </div>
                    {completedSale.items.map((it, idx) => (
                      <div key={idx} className="mb-1.5">
                        <div className="flex justify-between">
                          <span className="font-semibold">{it.product_name}</span>
                          <span>{formatINR(it.total)}</span>
                        </div>
                        {it.imei1 && (
                          <div className="text-[9px] text-slate-600">IMEI: {it.imei1}</div>
                        )}
                        <div className="text-[9px] text-slate-500">Warranty: {it.warranty_months} Months</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 text-right border-b border-dashed border-slate-400 pb-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatINR(completedSale.subtotal)}</span>
                    </div>
                    {completedSale.discount_amount > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Discount:</span>
                        <span>-₹{completedSale.discount_amount}</span>
                      </div>
                    )}
                    {completedSale.exchange_deduction > 0 && (
                      <div className="flex justify-between font-bold">
                        <span>Old Phone Trade-in:</span>
                        <span>-₹{completedSale.exchange_deduction}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
                      <span>GRAND TOTAL:</span>
                      <span>{formatINR(completedSale.final_payable)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>Paid ({completedSale.payment_type}):</span>
                      <span>{formatINR(completedSale.paid_amount)}</span>
                    </div>
                    {completedSale.balance_due > 0 && (
                      <div className="flex justify-between font-bold text-rose-600">
                        <span>Balance Due:</span>
                        <span>{formatINR(completedSale.balance_due)}</span>
                      </div>
                    )}
                    {completedSale.emi_duration && (
                      <div className="mt-2 p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-900">
                        <div className="font-bold">EMI Plan: {completedSale.emi_duration} months x {formatINR(completedSale.emi_amount)}</div>
                        <div>Down payment: {formatINR(completedSale.emi_down_payment)} | Total payable: {formatINR(completedSale.emi_total_repayable)}</div>
                      </div>
                    )}
                  </div>

                  <div className="text-center text-[9px] space-y-1 pt-1">
                    <p>Scan to Pay / Check Bill Online</p>
                    <div className="w-16 h-16 bg-slate-100 border border-slate-300 mx-auto flex items-center justify-center font-bold text-[8px]">
                      UPI QR
                    </div>
                    <p className="text-slate-600">UPI ID: {business.upi_id}</p>
                    <p className="italic mt-1">Thank you for your visit! Goods once sold will not be returned without warranty card.</p>
                  </div>
                </div>
              )}

              {/* Format 2: Full A4 / A5 GST Tax Invoice */}
              {printFormat === 'a4' && (
                <div id="printable-receipt" className="w-full max-w-xl bg-white p-6 shadow-md border border-slate-200 text-xs text-slate-800 space-y-4">
                  <div className="flex items-start justify-between border-b pb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{business.name}</h2>
                      <p className="text-slate-600">{business.address}</p>
                      <p className="text-slate-600">Phone: {business.phone} | Email: {business.email}</p>
                      <p className="font-bold text-emerald-700">GSTIN: {business.gstin}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold uppercase px-2 py-0.5 bg-slate-900 text-white rounded">
                        TAX INVOICE
                      </span>
                      <p className="font-mono font-bold mt-2">Inv #{completedSale.invoice_number}</p>
                      <p className="text-slate-500">Date: {completedSale.invoice_date}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <p className="font-bold text-slate-700">Billed To (Customer):</p>
                      <p className="font-semibold text-slate-900">{completedSale.customer_name}</p>
                      <p className="text-slate-600">Phone: {completedSale.customer_phone}</p>
                      {completedSale.customer_gstin && <p className="text-slate-600">GSTIN: {completedSale.customer_gstin}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-700">Payment Summary:</p>
                      <p>Mode: <span className="font-semibold">{completedSale.payment_type}</span></p>
                      <p>Status: <span className="font-bold text-emerald-700">{completedSale.payment_status}</span></p>
                      {completedSale.emi_duration && <p>EMI: <span className="font-semibold">{completedSale.emi_duration} months x {formatINR(completedSale.emi_amount)}</span></p>}
                    </div>
                  </div>

                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 text-left">
                        <th className="p-2">Item & Device IMEI</th>
                        <th className="p-2">HSN</th>
                        <th className="p-2 text-right">Price</th>
                        <th className="p-2 text-right">Taxable</th>
                        <th className="p-2 text-right">GST</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {completedSale.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <p className="font-bold text-slate-900">{it.product_name}</p>
                            {it.imei1 && <p className="font-mono text-[11px] text-slate-500">IMEI: {it.imei1}</p>}
                          </td>
                          <td className="p-2 font-mono">{it.hsn_code}</td>
                          <td className="p-2 text-right">{formatINR(it.unit_price)}</td>
                          <td className="p-2 text-right">{formatINR(it.taxable_value)}</td>
                          <td className="p-2 text-right">{formatINR(it.cgst + it.sgst)}</td>
                          <td className="p-2 text-right font-bold">{formatINR(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-between items-end pt-4 border-t border-slate-300">
                    <div className="text-[11px] text-slate-500 space-y-1">
                      <p className="font-bold text-slate-700">Terms & Warranty Conditions:</p>
                      <p>1. Warranty handled exclusively by brand service centers.</p>
                      <p>2. Physical or water damage voids all claims.</p>
                    </div>
                    <div className="w-64 space-y-1 text-right">
                      <div className="flex justify-between"><span>Taxable Value:</span><span>{formatINR(completedSale.taxable_amount)}</span></div>
                      <div className="flex justify-between"><span>CGST (9%):</span><span>{formatINR(completedSale.cgst_amount)}</span></div>
                      <div className="flex justify-between"><span>SGST (9%):</span><span>{formatINR(completedSale.sgst_amount)}</span></div>
                      <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t">
                        <span>Invoice Total:</span>
                        <span className="text-emerald-700 font-display">{formatINR(completedSale.final_payable)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar: Print & WhatsApp */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Print Receipt
                </button>
                {completedSale.whatsapp_link && (
                  <a
                    href={completedSale.whatsapp_link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" /> Share on WhatsApp
                  </a>
                )}
              </div>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close & Next Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
