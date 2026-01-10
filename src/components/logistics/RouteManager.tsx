import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Route, RouteStop, Vehicle } from '../../types/database';
import { Modal } from '../ui/Modal';
import { Truck, Plus, Calendar, Clock, MapPin, Users, Printer, FileText, Trash2, X, ChevronRight, CheckCircle } from 'lucide-react';

export default function RouteManager() {
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [installers, setInstallers] = useState<any[]>([]);
    const [pendingOrders, setPendingOrders] = useState<any[]>([]);

    // Editor State
    const [editingRoute, setEditingRoute] = useState<any | null>(null);
    const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [selectedInstallers, setSelectedInstallers] = useState<string[]>([]);
    const [routeStops, setRouteStops] = useState<any[]>([]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        fetchRoutes();
        fetchResources();
    }, []);

    const fetchRoutes = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('routes')
            .select(`
                *,
                vehicle:vehicle_id(brand, model, license_plate),
                stops:route_stops(count)
            `)
            .order('date', { ascending: false });
        setRoutes(data || []);
        setLoading(false);
    };

    const fetchResources = async () => {
        const { data: vData } = await supabase.from('vehicles').select('*').eq('is_active', true);
        setVehicles(vData || []);

        // Fetch Installers (assuming Role 'Installer' or generic Operators)
        // Adjust based on your role logic. For now getting all operators.
        const { data: opData } = await supabase.from('operators').select('*').eq('is_active', true);
        setInstallers(opData || []);
    };

    const fetchPendingOrders = async () => {
        // Fetch orders that are 'Cut' or 'Ready for Cutting' or 'Ready for Installation'
        // Assuming 'Cut' is ready for logistics.
        const { data } = await supabase
            .from('orders')
            .select('*')
            .in('status', ['Cut', 'Ready for Cutting', 'Pending', 'In Progress']) // Broad selection for now
            .order('created_at', { ascending: true });

        // Filter out orders that are already in THIS route (handled in UI)
        // or check against all active routes if needed. For now just show all not fully completed.
        setPendingOrders(data || []);
    };

    const handleOpenModal = async (route?: any) => {
        await fetchPendingOrders();

        if (route) {
            setEditingRoute(route);
            setRouteDate(route.date);
            setSelectedVehicle(route.vehicle_id || '');
            setSelectedInstallers(route.installer_ids || []);
            setNotes(route.notes || '');

            // Fetch detailed stops
            const { data: stops } = await supabase
                .from('route_stops')
                .select('*, order:orders(*, order_cuts(*, glass_types(code)))')
                .eq('route_id', route.id)
                .order('arrival_time');
            setRouteStops(stops || []);
        } else {
            setEditingRoute(null);
            setRouteDate(new Date().toISOString().split('T')[0]);
            setSelectedVehicle('');
            setSelectedInstallers([]);
            setRouteStops([]);
            setNotes('');
        }
        setIsModalOpen(true);
    };

    const handleAddOrder = (order: any) => {
        // Prevent duplicates
        if (routeStops.some(s => s.order_id === order.id)) return;

        const newStop = {
            id: 'temp-' + Date.now(),
            order_id: order.id,
            arrival_time: '09:00',
            installers_required: 2,
            order: order // Embed for display
        };
        setRouteStops([...routeStops, newStop]);
    };

    const handleRemoveStop = (orderId: string) => {
        setRouteStops(routeStops.filter(s => s.order_id !== orderId));
    };

    const handleSavePrimary = async () => {
        try {
            const payload = {
                date: routeDate,
                vehicle_id: selectedVehicle || null,
                installer_ids: selectedInstallers,
                notes: notes,
                status: 'confirmed'
            };

            let routeId = editingRoute?.id;

            if (routeId) {
                const { error } = await supabase.from('routes').update(payload).eq('id', routeId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('routes').insert(payload).select().single();
                if (error) throw error;
                routeId = data.id;
            }

            // Sync Stops
            // 1. Delete existing stops for this route (simplest sync)
            if (editingRoute) {
                await supabase.from('route_stops').delete().eq('route_id', routeId);
            }

            // 2. Insert new stops
            if (routeStops.length > 0) {
                const stopsPayload = routeStops.map(s => ({
                    route_id: routeId,
                    order_id: s.order_id,
                    arrival_time: s.arrival_time,
                    installers_required: s.installers_required
                }));
                const { error: stopsError } = await supabase.from('route_stops').insert(stopsPayload);
                if (stopsError) throw stopsError;
            }

            setIsModalOpen(false);
            fetchRoutes();
        } catch (err: any) {
            alert("Error saving route: " + err.message);
        }
    };

    const toggleInstaller = (id: string) => {
        if (selectedInstallers.includes(id)) {
            setSelectedInstallers(selectedInstallers.filter(i => i !== id));
        } else {
            setSelectedInstallers([...selectedInstallers, id]);
        }
    };

    // Print logic
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center print:hidden">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Truck className="w-6 h-6 text-slate-600" />
                    Hojas de Ruta
                </h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Hoja de Ruta
                </button>
            </div>

            {/* List of Routes */}
            <div className="grid grid-cols-1 gap-4 print:hidden">
                {routes.map(route => (
                    <div key={route.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-all">
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center justify-center bg-blue-50 text-blue-700 w-16 h-16 rounded-lg border border-blue-100">
                                <span className="text-xs font-bold uppercase">FECHA</span>
                                <span className="text-lg font-bold">{new Date(route.date).getDate()}</span>
                                <span className="text-xs">{new Date(route.date).toLocaleString('default', { month: 'short' })}</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    {route.vehicle?.brand} {route.vehicle?.model}
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs border border-slate-200 font-mono">
                                        {route.vehicle?.license_plate}
                                    </span>
                                </h3>
                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-4">
                                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {route.installer_ids?.length || 0} Colocadores</span>
                                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {route.stops?.[0]?.count || 0} Paradas</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenModal(route)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                <FileText className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal / Route Editor */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm print:bg-white print:static print:h-auto print:block">
                    <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden print:shadow-none print:h-auto print:rounded-none">

                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50 print:bg-white print:border-b-2 print:border-black">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 print:text-4xl">Hoja de Ruta de Logística</h2>
                                <div className="mt-2 flex gap-6 text-sm text-slate-600 print:mt-4 print:text-lg">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 print:w-6 print:h-6" />
                                        <span className="print:font-bold">{routeDate}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Truck className="w-4 h-4 print:w-6 print:h-6" />
                                        <span>
                                            {vehicles.find(v => v.id === selectedVehicle)?.brand}
                                            {' '}
                                            {vehicles.find(v => v.id === selectedVehicle)?.model}
                                            <span className="ml-2 font-mono font-bold bg-white px-1 border border-slate-300 rounded print:border-black">
                                                {vehicles.find(v => v.id === selectedVehicle)?.license_plate}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 print:w-6 print:h-6" />
                                        <span>
                                            {selectedInstallers.map(id => installers.find(i => i.id === id)?.full_name).join(', ')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 print:hidden">
                                <button
                                    onClick={handlePrint}
                                    className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    <Printer className="w-4 h-4" /> Imprimir
                                </button>
                                <button
                                    onClick={handleSavePrimary}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <CheckCircle className="w-4 h-4" /> Guardar
                                </button>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row print:overflow-visible print:block">

                            {/* Left: Stop List (The Route) */}
                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 print:p-0 print:bg-white">
                                <div className="space-y-6 print:space-y-8">
                                    {routeStops.sort((a, b) => a.arrival_time.localeCompare(b.arrival_time)).map((stop, index) => (
                                        <div key={stop.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border print:border-slate-800 print:break-inside-avoid">
                                            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4 print:border-slate-300">
                                                <div className="flex items-center gap-4">
                                                    <div className="text-2xl font-bold font-mono bg-slate-100 text-slate-800 px-3 py-1 rounded print:bg-white print:border print:border-black">
                                                        {stop.arrival_time}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-lg text-slate-900">{stop.order.client_name}</h3>
                                                        <p className="text-sm text-slate-500 font-mono">{stop.order.address || 'Sin dirección'}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">Orden #{stop.order.order_number} {stop.order.legacy_order_number && `(Ant: ${stop.order.legacy_order_number})`}</p>
                                                    </div>
                                                </div>
                                                <div className="print:hidden">
                                                    <button onClick={() => handleRemoveStop(stop.order_id)} className="text-red-400 hover:text-red-600">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Cuts List */}
                                                <div>
                                                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Cortes a Colocar</h4>
                                                    <ul className="text-sm space-y-1">
                                                        {/* If we have detailed cuts loaded, show them */}
                                                        {stop.order.order_cuts ? (
                                                            stop.order.order_cuts.map((cut: any, idx: number) => (
                                                                <li key={idx} className="flex justify-between border-b border-slate-50 pb-1">
                                                                    <span>{cut.quantity}x {cut.glass_types?.code}</span>
                                                                    <span className="font-mono text-xs">{cut.width_mm}x{cut.height_mm}mm</span>
                                                                </li>
                                                            ))
                                                        ) : (
                                                            <li className="text-slate-400 italic">Cargar detalles para ver cortes...</li>
                                                        )}
                                                    </ul>
                                                </div>

                                                {/* Info & Inputs */}
                                                <div className="space-y-4">
                                                    <div>
                                                        <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Materiales / Notas</h4>
                                                        <div className="bg-slate-50 p-2 rounded text-sm text-slate-600 min-h-[60px] border border-slate-100 print:bg-white print:border-slate-300">
                                                            {stop.order.description || 'Sin notas adicionales.'}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-4 print:hidden">
                                                        <div>
                                                            <label className="block text-[10px] font-bold uppercase text-slate-400">Hora</label>
                                                            <input
                                                                type="time"
                                                                value={stop.arrival_time}
                                                                onChange={(e) => {
                                                                    const newTime = e.target.value;
                                                                    setRouteStops(routeStops.map(s => s.id === stop.id ? { ...s, arrival_time: newTime } : s));
                                                                }}
                                                                className="border border-slate-300 rounded px-2 py-1 text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold uppercase text-slate-400">Colocadores</label>
                                                            <input
                                                                type="number"
                                                                value={stop.installers_required}
                                                                onChange={(e) => {
                                                                    const count = parseInt(e.target.value);
                                                                    setRouteStops(routeStops.map(s => s.id === stop.id ? { ...s, installers_required: count } : s));
                                                                }}
                                                                className="border border-slate-300 rounded px-2 py-1 text-sm w-16"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {routeStops.length === 0 && (
                                        <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                            Arrastra órdenes aquí o usa el panel derecho para agregar paradas.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Sidebar Editor (Hidden on Print) */}
                            <div className="w-full md:w-80 bg-white border-l border-slate-200 flex flex-col print:hidden overflow-hidden">
                                <div className="p-4 border-b border-slate-100 bg-slate-50">
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Configuración del Viaje</label>
                                    <div className="space-y-3">
                                        <input
                                            type="date"
                                            value={routeDate}
                                            onChange={e => setRouteDate(e.target.value)}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        />
                                        <select
                                            value={selectedVehicle}
                                            onChange={e => setSelectedVehicle(e.target.value)}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        >
                                            <option value="">Seleccionar Vehículo...</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</option>
                                            ))}
                                        </select>

                                        <div className="border border-slate-200 rounded-lg p-2 max-h-32 overflow-y-auto">
                                            <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Equipo de Colocación</div>
                                            {installers.map(op => (
                                                <label key={op.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedInstallers.includes(op.id)}
                                                        onChange={() => toggleInstaller(op.id)}
                                                        className="rounded text-blue-600"
                                                    />
                                                    <span className="text-sm text-slate-600">{op.full_name}</span>
                                                </label>
                                            ))}
                                        </div>

                                        <textarea
                                            placeholder="Notas generales del viaje..."
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm h-20"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4">
                                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        <ChevronRight className="w-4 h-4" /> Órdenes Disponibles
                                    </h4>
                                    <div className="space-y-2">
                                        {pendingOrders.filter(o => !routeStops.some(s => s.order_id === o.id)).map(order => (
                                            <div key={order.id} className="p-3 border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all bg-white cursor-pointer group" onClick={() => handleAddOrder(order)}>
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-slate-800 text-sm">{order.client_name}</span>
                                                    <Plus className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">{order.address}</div>
                                                <div className="mt-2 flex gap-2">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${order.status === 'Cut' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-500'
                                                        }`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
