import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Vehicle } from '../../types/database';
import { Modal } from '../ui/Modal';
import { Truck, Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';

export default function VehicleManager() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        brand: '',
        model: '',
        license_plate: '',
        max_passengers: 2,
        max_load_width_mm: 0,
        max_load_height_mm: 0,
        max_load_length_mm: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .order('brand', { ascending: true });

        if (error) {
            console.error('Error fetching vehicles:', error);
        } else {
            setVehicles(data || []);
        }
        setLoading(false);
    };

    const handleOpenModal = (vehicle?: Vehicle) => {
        if (vehicle) {
            setEditingId(vehicle.id);
            setFormData({
                brand: vehicle.brand,
                model: vehicle.model,
                license_plate: vehicle.license_plate,
                max_passengers: vehicle.max_passengers,
                max_load_width_mm: vehicle.max_load_width_mm,
                max_load_height_mm: vehicle.max_load_height_mm,
                max_load_length_mm: vehicle.max_load_length_mm
            });
        } else {
            setEditingId(null);
            setFormData({
                brand: '',
                model: '',
                license_plate: '',
                max_passengers: 2,
                max_load_width_mm: 2000,
                max_load_height_mm: 2000,
                max_load_length_mm: 4000
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('vehicles')
                    .update(formData)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('vehicles')
                    .insert(formData);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert('Error saving vehicle: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este vehículo?')) return;
        setLoading(true);
        const { error } = await supabase.from('vehicles').delete().eq('id', id);
        if (error) alert('Error deleting vehicle: ' + error.message);
        else fetchData();
        setLoading(false);
    };

    if (loading && vehicles.length === 0) return <div>Cargando vehículos...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Truck className="w-6 h-6 text-slate-600" />
                    Flota de Vehículos
                </h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Vehículo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vehicles.map(v => (
                    <div key={v.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{v.brand} {v.model}</h3>
                                <div className="inline-block bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-600 border border-slate-200 mt-1">
                                    {v.license_plate}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleOpenModal(v)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(v.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 text-sm text-slate-600">
                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                <span className="text-slate-400">Capacidad Personas:</span>
                                <span className="font-medium">{v.max_passengers}</span>
                            </div>

                            <div>
                                <span className="block text-slate-400 mb-1 text-xs uppercase font-bold">Capacidad de Carga Máxima</span>
                                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div>
                                        <div className="text-[10px] text-slate-400">ANCHO</div>
                                        <div className="font-mono font-bold">{v.max_load_width_mm} <span className="text-[10px] font-normal text-slate-400">mm</span></div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400">ALTO</div>
                                        <div className="font-mono font-bold">{v.max_load_height_mm} <span className="text-[10px] font-normal text-slate-400">mm</span></div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400">LARGO</div>
                                        <div className="font-mono font-bold">{v.max_load_length_mm} <span className="text-[10px] font-normal text-slate-400">mm</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Editar Vehículo' : 'Nuevo Vehículo'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                            <input
                                type="text"
                                required
                                value={formData.brand}
                                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Toyota"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                            <input
                                type="text"
                                required
                                value={formData.model}
                                onChange={e => setFormData({ ...formData, model: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Hilux"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Patente</label>
                            <input
                                type="text"
                                required
                                value={formData.license_plate}
                                onChange={e => setFormData({ ...formData, license_plate: e.target.value.toUpperCase() })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                                placeholder="AA123BB"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max. Personas</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={formData.max_passengers}
                                onChange={e => setFormData({ ...formData, max_passengers: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-2">
                        <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Dimensiones Máximas de Carga
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Ancho (mm)</label>
                                <input
                                    type="number"
                                    required
                                    value={formData.max_load_width_mm}
                                    onChange={e => setFormData({ ...formData, max_load_width_mm: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Alto (mm)</label>
                                <input
                                    type="number"
                                    required
                                    value={formData.max_load_height_mm}
                                    onChange={e => setFormData({ ...formData, max_load_height_mm: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Largo (mm)</label>
                                <input
                                    type="number"
                                    required
                                    value={formData.max_load_length_mm}
                                    onChange={e => setFormData({ ...formData, max_load_length_mm: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Estas dimensiones se utilizarán para advertir si los cortes de una orden exceden la capacidad del vehículo.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-6">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            {loading ? 'Guardando...' : 'Guardar Vehículo'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
