import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Tool } from '../../types/database';
import { Modal } from '../ui/Modal';
import { Wrench, Plus, Edit2, Trash2, Search } from 'lucide-react';

export default function ToolsManager() {
    const [tools, setTools] = useState<Tool[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        quantity_total: 1,
        quantity_available: 1, // Only editable on create, otherwise computed/adjusted
        location: ''
    });

    useEffect(() => {
        fetchTools();
    }, []);

    const fetchTools = async () => {
        setLoading(true);
        const { data } = await supabase.from('tools').select('*').order('name');
        setTools(data || []);
        setLoading(false);
    };

    const handleOpenModal = (tool?: Tool) => {
        if (tool) {
            setEditingId(tool.id);
            setFormData({
                name: tool.name,
                description: tool.description || '',
                quantity_total: tool.quantity_total,
                quantity_available: tool.quantity_available,
                location: tool.location || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '',
                description: '',
                quantity_total: 1,
                quantity_available: 1,
                location: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingId) {
                // Determine Delta for Total
                // If editing total, we should probably adjust available by the same delta if logic permits
                // For simplicity here, we just update what user types, but user must be careful
                const { error } = await supabase.from('tools').update({
                    name: formData.name,
                    description: formData.description,
                    quantity_total: formData.quantity_total,
                    // Typically 'available' is managed by loans, but we allow manual override for corrections
                    quantity_available: formData.quantity_available,
                    location: formData.location
                }).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('tools').insert(formData);
                if (error) throw error;
            }
            setIsModalOpen(false);
            fetchTools();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar herramienta?')) return;
        const { error } = await supabase.from('tools').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else fetchTools();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Wrench className="w-6 h-6 text-slate-600" />
                    Inventario de Herramientas
                </h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Herramienta
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3">Nombre</th>
                            <th className="px-4 py-3">Descripción</th>
                            <th className="px-4 py-3 text-center">Total</th>
                            <th className="px-4 py-3 text-center">Disponible</th>
                            <th className="px-4 py-3">Ubicación</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tools.map(tool => (
                            <tr key={tool.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-800">{tool.name}</td>
                                <td className="px-4 py-3 text-slate-500">{tool.description || '-'}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded font-mono font-bold">
                                        {tool.quantity_total}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-1 rounded font-mono font-bold ${tool.quantity_available > 0
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}>
                                        {tool.quantity_available}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-500">{tool.location || '-'}</td>
                                <td className="px-4 py-3 text-right flex justify-end gap-2">
                                    <button onClick={() => handleOpenModal(tool)} className="p-1 text-slate-400 hover:text-blue-600">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(tool.id)} className="p-1 text-slate-400 hover:text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {tools.length === 0 && !loading && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                                    No hay herramientas registradas.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Editar Herramienta' : 'Nueva Herramienta'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            rows={2}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad Total</label>
                            <input
                                type="number"
                                required
                                min="0"
                                value={formData.quantity_total}
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    // Auto-adjust available if creating, or if simplistic logic desired
                                    if (!editingId) {
                                        setFormData(prev => ({ ...prev, quantity_total: val, quantity_available: val }));
                                    } else {
                                        setFormData(prev => ({ ...prev, quantity_total: val }));
                                    }
                                }}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Disponible Manual</label>
                            <input
                                type="number"
                                required
                                value={formData.quantity_available}
                                onChange={e => setFormData({ ...formData, quantity_available: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Ajustar solo si hay correcciones de stock.</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación</label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Estante A1"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
