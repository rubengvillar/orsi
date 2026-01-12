
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Assuming lib/supabase exists
import { Modal } from '../ui/Modal';
import { Plus, Edit, Trash2, Search, Phone, Mail, MapPin, Building2, Upload, List, Save, X } from 'lucide-react';
import type { Supplier, SupplierProduct } from '../../types/database';

const CATEGORIES = [
    { id: 'aluminum_profile', label: 'Perfiles de Aluminio' },
    { id: 'aluminum_accessory', label: 'Accesorios de Aluminio' },
    { id: 'glass_type', label: 'Hojas de Vidrio' },
    { id: 'glass_accessory', label: 'Accesorios de Vidrio' },
    { id: 'tool', label: 'Herramientas' }
];

export default function SupplierManager() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSupplier, setCurrentSupplier] = useState<Partial<Supplier>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [priceListData, setPriceListData] = useState('');
    const [uploadingPrices, setUploadingPrices] = useState(false);

    // Price Management State
    const [isViewPricesModalOpen, setIsViewPricesModalOpen] = useState(false);
    const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [editPriceValue, setEditPriceValue] = useState<number>(0);

    // Individual Price Add State
    const [showIndividualAdd, setShowIndividualAdd] = useState(false);
    const [searchType, setSearchType] = useState('aluminum_profile');
    const [productSearch, setProductSearch] = useState('');
    const [productResults, setProductResults] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [individualPrice, setIndividualPrice] = useState<number>(0);

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching suppliers:', error);
        } else {
            setSuppliers(data || []);
        }
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && currentSupplier.id) {
                const { error } = await supabase
                    .from('suppliers')
                    .update(currentSupplier)
                    .eq('id', currentSupplier.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('suppliers')
                    .insert([currentSupplier]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            setCurrentSupplier({});
            fetchSuppliers();
        } catch (error) {
            console.error('Error saving supplier:', error);
            alert('Error al crear/actualizar el proveedor');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de que desea eliminar este proveedor?')) return;

        try {
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchSuppliers();
        } catch (error) {
            console.error('Error deleting supplier:', error);
            alert('Error al eliminar el proveedor');
        }
    };

    const openEditModal = (supplier: Supplier) => {
        setCurrentSupplier(supplier);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const openAddModal = () => {
        setCurrentSupplier({ provided_categories: [] });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const toggleCategory = (categoryId: string) => {
        const current = currentSupplier.provided_categories || [];
        if (current.includes(categoryId)) {
            setCurrentSupplier({ ...currentSupplier, provided_categories: current.filter(id => id !== categoryId) });
        } else {
            setCurrentSupplier({ ...currentSupplier, provided_categories: [...current, categoryId] });
        }
    };

    const handlePriceListUpload = async () => {
        if (!currentSupplier.id || !priceListData.trim()) return;
        setUploadingPrices(true);
        try {
            const lines = priceListData.split('\n').filter(l => l.trim());
            const items = [];

            for (const line of lines) {
                const parts = line.split(/[;,]/).map(p => p.trim());
                if (parts.length >= 2) {
                    const code = parts[0];
                    const price = parseFloat(parts[1]);
                    if (!isNaN(price)) {
                        items.push({ code, price });
                    }
                }
            }

            if (items.length === 0) {
                alert('No se encontraron datos válidos. Formato: CODIGO, PRECIO');
                setUploadingPrices(false);
                return;
            }

            let updatedCount = 0;
            for (const item of items) {
                const tables = [
                    { name: 'aluminum_profiles', type: 'aluminum_profile' },
                    { name: 'aluminum_accessories', type: 'aluminum_accessory' },
                    { name: 'glass_types', type: 'glass_type' },
                    { name: 'glass_accessories', type: 'glass_accessory' },
                    { name: 'tools', type: 'tool', codeCol: 'name' }
                ];

                for (const table of tables) {
                    const { data } = await supabase
                        .from(table.name)
                        .select('id')
                        .eq(table.codeCol || 'code', item.code)
                        .maybeSingle();

                    if (data) {
                        const { error } = await supabase
                            .from('supplier_products')
                            .upsert({
                                supplier_id: currentSupplier.id,
                                product_type: table.type,
                                product_id: data.id,
                                price: item.price,
                                updated_at: new Date().toISOString()
                            }, { onConflict: 'supplier_id,product_type,product_id' });

                        if (!error) {
                            updatedCount++;
                            break;
                        }
                    }
                }
            }

            alert(`Se actualizaron ${updatedCount} productos.`);
            setIsPriceModalOpen(false);
            setPriceListData('');
            if (isViewPricesModalOpen && currentSupplier.id) fetchSupplierProducts(currentSupplier.id);
        } catch (error) {
            console.error('Error uploading prices:', error);
            alert('Error al cargar la lista de precios');
        } finally {
            setUploadingPrices(false);
        }
    };

    const fetchSupplierProducts = async (supplierId: string) => {
        setLoadingPrices(true);
        const { data, error } = await supabase
            .from('supplier_products')
            .select('*')
            .eq('supplier_id', supplierId);

        if (error) {
            console.error('Error fetching prices:', error);
            setLoadingPrices(false);
            return;
        }

        const enriched = await Promise.all((data || []).map(async (sp) => {
            const name = await fetchProductName(sp.product_type, sp.product_id);
            return { ...sp, _productName: name };
        }));

        setSupplierProducts(enriched);
        setLoadingPrices(false);
    };

    const fetchProductName = async (type: string, id: string) => {
        let table = '';
        let col = 'code';
        if (type === 'aluminum_profile') table = 'aluminum_profiles';
        if (type === 'aluminum_accessory') table = 'aluminum_accessories';
        if (type === 'glass_type') table = 'glass_types';
        if (type === 'glass_accessory') table = 'glass_accessories';
        if (type === 'tool') { table = 'tools'; col = 'name'; }

        const { data } = await supabase.from(table).select(`${col}, description`).eq('id', id).maybeSingle();
        if (data) {
            const item = data as any;
            return `${item[col]} ${item.description ? `- ${item.description}` : ''}`;
        }
        return 'Producto desconocido';
    };

    const handleDeletePrice = async (priceId: string) => {
        if (!confirm('¿Eliminar este precio?')) return;
        const { error } = await supabase.from('supplier_products').delete().eq('id', priceId);
        if (error) alert('Error al eliminar');
        else if (currentSupplier.id) fetchSupplierProducts(currentSupplier.id);
    };

    const handleUpdatePrice = async (priceId: string) => {
        const { error } = await supabase
            .from('supplier_products')
            .update({ price: editPriceValue, updated_at: new Date().toISOString() })
            .eq('id', priceId);

        if (error) alert('Error al actualizar');
        else {
            setEditingPriceId(null);
            if (currentSupplier.id) fetchSupplierProducts(currentSupplier.id);
        }
    };

    const executeProductSearch = async () => {
        if (!productSearch) return;
        let query = supabase.from('aluminum_profiles').select('id, code, description');
        if (searchType === 'aluminum_profile') query = supabase.from('aluminum_profiles').select('id, code, description');
        if (searchType === 'aluminum_accessory') query = supabase.from('aluminum_accessories').select('id, code, description');
        if (searchType === 'glass_accessory') query = supabase.from('glass_accessories').select('id, code, description');
        if (searchType === 'glass_type') query = supabase.from('glass_types').select('id, code, description');
        if (searchType === 'tool') query = supabase.from('tools').select('id, name, description');

        if (searchType === 'tool') {
            query = query.ilike('name', `%${productSearch}%`);
        } else {
            query = query.ilike('code', `%${productSearch}%`);
        }

        const { data } = await query.limit(5);
        setProductResults(data || []);
    };

    const handleSaveIndividualPrice = async () => {
        if (!currentSupplier.id || !selectedProduct || !individualPrice) return;

        const { error } = await supabase
            .from('supplier_products')
            .upsert({
                supplier_id: currentSupplier.id,
                product_type: searchType as any,
                product_id: selectedProduct.id,
                price: individualPrice,
                updated_at: new Date().toISOString()
            }, { onConflict: 'supplier_id,product_type,product_id' });

        if (error) {
            alert('Error al guardar el precio');
        } else {
            setShowIndividualAdd(false);
            setSelectedProduct(null);
            setProductSearch('');
            setIndividualPrice(0);
            fetchSupplierProducts(currentSupplier.id);
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar proveedores..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Agregar Proveedor
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Cargando proveedores...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSuppliers.map((supplier) => (
                        <div key={supplier.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{supplier.name}</h3>
                                        <p className="text-sm text-slate-500">{supplier.contact_name || 'Sin contacto'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setCurrentSupplier(supplier);
                                            fetchSupplierProducts(supplier.id);
                                            setIsViewPricesModalOpen(true);
                                        }}
                                        className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600 transition-colors"
                                        title="Gestionar precios"
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCurrentSupplier(supplier);
                                            setIsPriceModalOpen(true);
                                        }}
                                        className="p-1.5 hover:bg-green-50 rounded-lg text-slate-400 hover:text-green-600 transition-colors"
                                        title="Carga masiva de precios"
                                    >
                                        <Upload className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => openEditModal(supplier)}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(supplier.id)}
                                        className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm text-slate-600">
                                {supplier.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <a href={`mailto:${supplier.email}`} className="hover:text-blue-600">
                                            {supplier.email}
                                        </a>
                                    </div>
                                )}
                                {supplier.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-slate-400" />
                                        <span>{supplier.phone}</span>
                                    </div>
                                )}
                                {supplier.address && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        <span>{supplier.address}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredSuppliers.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
                            No se encontraron proveedores.
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={isEditing ? 'Editar Proveedor' : 'Agregar Nuevo Proveedor'}
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Empresa *</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value={currentSupplier.name || ''}
                            onChange={e => setCurrentSupplier({ ...currentSupplier, name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de Contacto</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                value={currentSupplier.contact_name || ''}
                                onChange={e => setCurrentSupplier({ ...currentSupplier, contact_name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">CUIT / ID Fiscal</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                value={currentSupplier.tax_id || ''}
                                onChange={e => setCurrentSupplier({ ...currentSupplier, tax_id: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input
                                type="email"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                value={currentSupplier.email || ''}
                                onChange={e => setCurrentSupplier({ ...currentSupplier, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                            <input
                                type="tel"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                value={currentSupplier.phone || ''}
                                onChange={e => setCurrentSupplier({ ...currentSupplier, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                        <textarea
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            rows={2}
                            value={currentSupplier.address || ''}
                            onChange={e => setCurrentSupplier({ ...currentSupplier, address: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Categorías de Productos Proveídos</label>
                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            {CATEGORIES.map(cat => (
                                <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                        checked={(currentSupplier.provided_categories || []).includes(cat.id)}
                                        onChange={() => toggleCategory(cat.id)}
                                    />
                                    <span className="text-sm text-slate-600 group-hover:text-slate-900">{cat.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                        <textarea
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            rows={3}
                            value={currentSupplier.notes || ''}
                            onChange={e => setCurrentSupplier({ ...currentSupplier, notes: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            {isEditing ? 'Actualizar Proveedor' : 'Crear Proveedor'}
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                isOpen={isPriceModalOpen}
                onClose={() => setIsPriceModalOpen(false)}
                title={`Cargar Precios: ${currentSupplier.name}`}
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">
                        Pegue aquí la lista de precios. Formato: <strong>Código, Precio</strong> (uno por línea).
                        El sistema buscará el producto por su código y actualizará el precio para este proveedor.
                    </p>
                    <textarea
                        className="w-full h-64 p-3 font-mono text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="AL-001, 1250.00&#10;ACC-05, 450.00"
                        value={priceListData}
                        onChange={(e) => setPriceListData(e.target.value)}
                    />
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            onClick={() => setIsPriceModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handlePriceListUpload}
                            disabled={uploadingPrices || !priceListData.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {uploadingPrices ? 'Cargando...' : 'Cargar Precios'}
                        </button>
                    </div>
                </div>
            </Modal>
            <Modal
                isOpen={isViewPricesModalOpen}
                onClose={() => setIsViewPricesModalOpen(false)}
                title={`Precios: ${currentSupplier.name}`}
                size="lg"
            >
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm text-slate-500">Lista detallada de precios acordados con este proveedor.</p>
                        <button
                            onClick={() => setIsPriceModalOpen(true)}
                            className="text-xs flex items-center gap-1 text-blue-600 hover:underline"
                        >
                            <Upload className="w-3 h-3" /> Carga Masiva
                        </button>
                    </div>

                    <div className={`p-4 bg-slate-50 rounded-lg border transition-all ${showIndividualAdd ? 'mb-4 shadow-inner' : 'mb-0 border-transparent h-0 overflow-hidden'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-semibold text-slate-700">Agregar Precio Individual</h4>
                            <button onClick={() => setShowIndividualAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1 font-medium italic">Categoría</label>
                                <select
                                    className="w-full text-sm border rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={searchType}
                                    onChange={(e) => {
                                        setSearchType(e.target.value);
                                        setSelectedProduct(null);
                                        setProductResults([]);
                                    }}
                                >
                                    {CATEGORIES.filter(c => (currentSupplier.provided_categories || []).includes(c.id)).map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1 font-medium italic">Precio</label>
                                <input
                                    type="number"
                                    className="w-full text-sm border rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                    placeholder="0.00"
                                    value={individualPrice || ''}
                                    onChange={(e) => setIndividualPrice(Number(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="mt-3 relative">
                            <label className="block text-xs text-slate-500 mb-1 font-medium italic">Buscar Producto (Código/Nombre)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 text-sm border rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                    placeholder="Ingrese código o nombre..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && executeProductSearch()}
                                />
                                <button
                                    onClick={executeProductSearch}
                                    className="bg-slate-200 px-3 rounded hover:bg-slate-300 text-slate-700"
                                >
                                    <Search className="w-4 h-4" />
                                </button>
                            </div>
                            {productResults.length > 0 && !selectedProduct && (
                                <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-40 overflow-y-auto">
                                    {productResults.map(p => (
                                        <button
                                            key={p.id}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
                                            onClick={() => {
                                                setSelectedProduct(p);
                                                setProductSearch(p.code || p.name);
                                                setProductResults([]);
                                            }}
                                        >
                                            <span className="font-semibold">{p.code || p.name}</span>
                                            {p.description && <span className="text-slate-500 ml-2 italic text-xs">- {p.description}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={handleSaveIndividualPrice}
                                disabled={!selectedProduct || !individualPrice}
                                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Guardar Precio
                            </button>
                        </div>
                    </div>

                    {!showIndividualAdd && (
                        <button
                            onClick={() => setShowIndividualAdd(true)}
                            className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-blue-300 hover:text-blue-600 flex items-center justify-center gap-2 transition-all mb-4"
                        >
                            <Plus className="w-4 h-4" /> Agregar Precio Manual
                        </button>
                    )}

                    {loadingPrices ? (
                        <div className="text-center py-8 text-slate-500 italic">Cargando precios...</div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600 font-medium border-b">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Producto</th>
                                        <th className="px-4 py-2 text-right">Precio</th>
                                        <th className="px-4 py-2 text-center w-24">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {supplierProducts.map(sp => (
                                        <tr key={sp.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-2 text-slate-800">
                                                <div className="font-medium">{sp._productName}</div>
                                                <div className="text-[10px] text-slate-400 uppercase">{sp.product_type}</div>
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {editingPriceId === sp.id ? (
                                                    <input
                                                        type="number"
                                                        className="w-24 px-2 py-1 border rounded text-right"
                                                        value={editPriceValue}
                                                        onChange={(e) => setEditPriceValue(Number(e.target.value))}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className="font-semibold text-slate-700 font-mono">${sp.price}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <div className="flex justify-center gap-1">
                                                    {editingPriceId === sp.id ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleUpdatePrice(sp.id)}
                                                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                            >
                                                                <Save className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingPriceId(null)}
                                                                className="p-1 text-slate-400 hover:bg-slate-50 rounded"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingPriceId(sp.id);
                                                                    setEditPriceValue(sp.price);
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeletePrice(sp.id)}
                                                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {supplierProducts.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">
                                                No hay precios registrados para este proveedor.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t">
                        <button
                            onClick={() => setIsViewPricesModalOpen(false)}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
