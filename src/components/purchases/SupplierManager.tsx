
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Assuming lib/supabase exists
import { Modal } from '../ui/Modal';
import { Plus, Edit, Trash2, Search, Phone, Mail, MapPin, Building2 } from 'lucide-react';
import type { Supplier } from '../../types/database';

export default function SupplierManager() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSupplier, setCurrentSupplier] = useState<Partial<Supplier>>({});
    const [isEditing, setIsEditing] = useState(false);

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
        setCurrentSupplier({});
        setIsEditing(false);
        setIsModalOpen(true);
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
        </div>
    );
}
