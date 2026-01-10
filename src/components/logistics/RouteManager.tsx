import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Route, RouteStop, Vehicle, RouteMaterial } from '../../types/database';
import { Modal } from '../ui/Modal';
import { Truck, Plus, Calendar, Clock, MapPin, Users, Printer, FileText, Trash2, X, ChevronRight, CheckCircle, Package, User, Camera, PenTool, ClipboardList } from 'lucide-react';
import ProofOfDelivery from './ProofOfDelivery';

export default function RouteManager() {
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [installers, setInstallers] = useState<any[]>([]);
    const [pendingOrders, setPendingOrders] = useState<any[]>([]);
    const [materialsMap, setMaterialsMap] = useState<Map<string, string>>(new Map());

    // Editor State
    const [editingRoute, setEditingRoute] = useState<any | null>(null);
    const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [selectedInstallers, setSelectedInstallers] = useState<string[]>([]);
    const [routeStops, setRouteStops] = useState<any[]>([]);
    const [routeMaterials, setRouteMaterials] = useState<RouteMaterial[]>([]); // New: General Materials
    const [notes, setNotes] = useState('');

    // Execution State
    const [podStop, setPodStop] = useState<any | null>(null); // Stop being 'completed'

    const [availableTools, setAvailableTools] = useState<any[]>([]);

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

        const { data: opData } = await supabase.from('operators').select('*').eq('is_active', true);
        setInstallers(opData || []);

        const { data: tData } = await supabase.from('tools').select('*').eq('is_active', true);
        setAvailableTools(tData || []);
    };

    const fetchPendingOrders = async () => {
        const { data } = await supabase
            .from('orders')
            .select('*')
            .in('status', ['Cut', 'Ready for Cutting', 'Pending', 'In Progress'])
            .order('created_at', { ascending: true });

        setPendingOrders(data || []);
    };

    // Helper
    const fetchMaterialNames = async (usageData: any[]) => {
        if (!usageData || usageData.length === 0) return;
        const materialIds = [...new Set(usageData.map((u: any) => u.material_id))];
        if (materialIds.length === 0) return;
        const missingIds = materialIds.filter(id => !materialsMap.has(id));
        if (missingIds.length === 0) return;

        const { data } = await supabase.from('v_material_info').select('id, display_name').in('id', missingIds);
        if (data) {
            setMaterialsMap(prev => {
                const next = new Map(prev);
                data.forEach((m: any) => next.set(m.id, m.display_name));
                return next;
            });
        }
    };

    const handleOpenModal = async (route?: any) => {
        await fetchPendingOrders();

        if (route) {
            setEditingRoute(route);
            setRouteDate(route.date);
            setSelectedVehicle(route.vehicle_id || '');
            setSelectedInstallers(route.installer_ids || []);
            setNotes(route.notes || '');

            // Stops
            const { data: stops } = await supabase
                .from('route_stops')
                .select('*, order:orders(*, order_cuts(*, glass_types(code)), material_usage(*))')
                .eq('route_id', route.id)
                .order('arrival_time');

            if (stops) {
                setRouteStops(stops);
                const allUsage = stops.flatMap((s: any) => s.order?.material_usage || []);
                await fetchMaterialNames(allUsage);
            } else {
                setRouteStops([]);
            }

            // Route Materials
            const { data: routeMats } = await supabase
                .from('route_materials')
                .select('*')
                .eq('route_id', route.id);
            setRouteMaterials(routeMats || []);

        } else {
            setEditingRoute(null);
            setRouteDate(new Date().toISOString().split('T')[0]);
            setSelectedVehicle('');
            setSelectedInstallers([]);
            setRouteStops([]);
            setRouteMaterials([]);
            setNotes('');
        }
        setIsModalOpen(true);
    };

    const handleAddOrder = async (order: any) => {
        if (routeStops.some(s => s.order_id === order.id)) return;
        const { data: usage } = await supabase.from('material_usage').select('*').eq('order_id', order.id);
        if (usage) {
            order.material_usage = usage;
            await fetchMaterialNames(usage);
        }
        if (!order.order_cuts) {
            const { data: cuts } = await supabase.from('order_cuts').select('*, glass_types(code)').eq('order_id', order.id);
            order.order_cuts = cuts || [];
        }

        const newStop = {
            id: 'temp-' + Date.now(),
            order_id: order.id,
            arrival_time: '09:00',
            installers_required: 2,
            items_to_deliver: '',
            delivery_contact: '',
            order: order
        };
        setRouteStops([...routeStops, newStop]);
    };

    const handleRemoveStop = (orderId: string) => {
        setRouteStops(routeStops.filter(s => s.order_id !== orderId));
    };

    const handleAddRouteMaterial = () => {
        setRouteMaterials([...routeMaterials, {
            id: 'temp-mat-' + Date.now(),
            route_id: '',
            description: '',
            quantity: 1,
            order_id: null,
            receiver_operator_id: null,

            tool_id: null,
            aluminum_accessory_id: null,
            glass_accessory_id: null,
            is_returnable: false,
            returned_at: null,
            returned_by_id: null,

            created_at: new Date().toISOString()
        }]);
    };

    const handleUpdateRouteMaterial = (id: string, field: keyof RouteMaterial, value: any) => {
        setRouteMaterials(routeMaterials.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    const handleRemoveRouteMaterial = (id: string) => {
        setRouteMaterials(routeMaterials.filter(m => m.id !== id));
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
            if (editingRoute) await supabase.from('route_stops').delete().eq('route_id', routeId);
            if (routeStops.length > 0) {
                const stopsPayload = routeStops.map(s => ({
                    route_id: routeId,
                    order_id: s.order_id,
                    arrival_time: s.arrival_time,
                    installers_required: s.installers_required,
                    items_to_deliver: s.items_to_deliver || null,
                    delivery_contact: s.delivery_contact || null,
                    // Preserve PoD data if re-saving
                    photos_before: s.photos_before,
                    photos_after: s.photos_after,
                    signature_data: s.signature_data,
                    signed_at: s.signed_at,
                    signed_by_name: s.signed_by_name
                }));
                const { error } = await supabase.from('route_stops').insert(stopsPayload);
                if (error) throw error;
            }

            // Sync Route Materials
            if (editingRoute) await supabase.from('route_materials').delete().eq('route_id', routeId);
            if (routeMaterials.length > 0) {
                const matsPayload = routeMaterials.map(m => ({
                    route_id: routeId,
                    description: m.description,
                    quantity: m.quantity,
                    order_id: m.order_id || null,
                    receiver_operator_id: m.receiver_operator_id || null,
                    tool_id: m.tool_id || null,
                    is_returnable: m.is_returnable || false
                }));
                const { error } = await supabase.from('route_materials').insert(matsPayload);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchRoutes();
        } catch (err: any) {
            alert("Error saving route: " + err.message);
        }
    };

    // PoD Save Handler
    const handleSavePoD = async (podData: any) => {
        if (!podStop) return;

        // Update local state first
        setRouteStops(routeStops.map(s => s.id === podStop.id ? { ...s, ...podData } : s));

        // In this 'document-based' save style (user clicks big save button), we might strictly rely on handleSavePrimary,
        // BUT for PoD usually we want immediate persistence. Let's do partial update if route exists.
        if (editingRoute?.id && podStop.id && !podStop.id.startsWith('temp-')) {
            const { error } = await supabase
                .from('route_stops')
                .update(podData)
                .eq('id', podStop.id);

            if (error) {
                alert('Error saving PoD directly: ' + error.message);
            }
        }
    };

    const toggleInstaller = (id: string) => {
        if (selectedInstallers.includes(id)) {
            setSelectedInstallers(selectedInstallers.filter(i => i !== id));
        } else {
            setSelectedInstallers([...selectedInstallers, id]);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const getVehicleDetails = () => vehicles.find(v => v.id === selectedVehicle);
    const getInstallerNames = () => selectedInstallers.map(id => installers.find(i => i.id === id)?.full_name).join(', ');

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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 text-slate-800 backdrop-blur-sm print:bg-white print:static print:h-auto print:block overflow-y-auto">
                    <div className="bg-white w-full max-w-6xl min-h-[90vh] md:h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden print:shadow-none print:h-auto print:rounded-none">

                        {/* Header Editor - Hidden on Print */}
                        <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50 print:hidden">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Hoja de Ruta de Logística</h2>
                                <div className="mt-2 flex gap-6 text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        <span>{routeDate}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Truck className="w-4 h-4" />
                                        <span>
                                            {getVehicleDetails()?.brand} {getVehicleDetails()?.model}
                                            <span className="ml-2 font-mono font-bold bg-white px-1 border border-slate-300 rounded">
                                                {getVehicleDetails()?.license_plate}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
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

                        {/* PRINT HEADER - Only visible on print */}
                        <div className="hidden print:block p-8 border-b-2 border-black mb-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-4xl font-bold mb-2">HOJA DE RUTA</h1>
                                    <div className="text-lg">
                                        <span className="font-bold">FECHA:</span> {routeDate}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold">{getVehicleDetails()?.brand} {getVehicleDetails()?.model}</div>
                                    <div className="text-2xl font-mono borber border-black px-2 inline-block mt-1">{getVehicleDetails()?.license_plate}</div>
                                </div>
                            </div>
                            <div className="mt-4 border-t border-black pt-2 flex gap-8">
                                <div>
                                    <span className="font-bold uppercase text-sm">Equipo:</span> {getInstallerNames()}
                                </div>
                                <div>
                                    <span className="font-bold uppercase text-sm">Notas:</span> {notes}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto flex flex-col md:flex-row print:overflow-visible print:block">

                            {/* Left: Stop List (Editor View) - Hidden on Print */}
                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 print:hidden">

                                {/* Route Materials Section */}
                                <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                            <Package className="w-5 h-5 text-amber-500" />
                                            Materiales Generales / Herramientas
                                        </h3>
                                        <button onClick={handleAddRouteMaterial} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">
                                            + Agregar Item
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {routeMaterials.map(mat => (
                                            <div key={mat.id} className="flex gap-2 items-center text-sm border-b border-slate-50 pb-2 mb-2">
                                                <input
                                                    type="number"
                                                    value={mat.quantity}
                                                    onChange={e => handleUpdateRouteMaterial(mat.id, 'quantity', parseInt(e.target.value))}
                                                    className="w-16 border rounded px-2 py-1"
                                                />

                                                {/* Tool Selection */}
                                                <select
                                                    value={mat.tool_id || ''}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (val) {
                                                            const tool = availableTools.find(t => t.id === val);
                                                            // Auto-fill description if tool selected and description is empty or matches previous
                                                            handleUpdateRouteMaterial(mat.id, 'tool_id', val);
                                                            handleUpdateRouteMaterial(mat.id, 'description', tool ? tool.name : '');
                                                            handleUpdateRouteMaterial(mat.id, 'is_returnable', true);
                                                        } else {
                                                            handleUpdateRouteMaterial(mat.id, 'tool_id', null);
                                                        }
                                                    }}
                                                    className="w-40 border rounded px-2 py-1 text-xs"
                                                >
                                                    <option value="">(Manual / Texto)</option>
                                                    {availableTools.filter(t => t.quantity_available > 0 || mat.tool_id === t.id).map(t => (
                                                        <option key={t.id} value={t.id}>{t.name} (Disp: {t.quantity_available})</option>
                                                    ))}
                                                </select>

                                                <input
                                                    type="text"
                                                    placeholder="Descripción"
                                                    value={mat.description}
                                                    onChange={e => handleUpdateRouteMaterial(mat.id, 'description', e.target.value)}
                                                    className="flex-1 border rounded px-2 py-1"
                                                />

                                                <select
                                                    value={mat.receiver_operator_id || ''}
                                                    onChange={e => handleUpdateRouteMaterial(mat.id, 'receiver_operator_id', e.target.value || null)}
                                                    className="w-32 border rounded px-2 py-1 text-xs"
                                                >
                                                    <option value="">(Sin Resp.)</option>
                                                    {installers.map(op => <option key={op.id} value={op.id}>{op.full_name}</option>)}
                                                </select>

                                                <button
                                                    title={mat.is_returnable ? "Devolución Pendiente" : "Consumible"}
                                                    onClick={() => handleUpdateRouteMaterial(mat.id, 'is_returnable', !mat.is_returnable)}
                                                    className={`p-1 rounded ${mat.is_returnable ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}
                                                >
                                                    <ClipboardList className="w-4 h-4" />
                                                </button>

                                                <button onClick={() => handleRemoveRouteMaterial(mat.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                        {routeMaterials.length === 0 && <div className="text-xs text-slate-400 italic">No hay materiales de ruta asignados.</div>}
                                    </div>
                                </div>

                                {/* Stops Section */}
                                <div className="space-y-6">
                                    {routeStops.sort((a, b) => a.arrival_time.localeCompare(b.arrival_time)).map((stop) => (
                                        <div key={stop.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
                                            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="text-2xl font-bold font-mono bg-slate-100 text-slate-800 px-3 py-1 rounded">
                                                        {stop.arrival_time}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-lg text-slate-900">{stop.order.client_name}</h3>
                                                        <p className="text-sm text-slate-500 font-mono">{stop.order.address || 'Sin dirección'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setPodStop(stop)}
                                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${stop.signature_data
                                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700'
                                                            }`}
                                                    >
                                                        {stop.signature_data ? <CheckCircle className="w-3 h-3" /> : <PenTool className="w-3 h-3" />}
                                                        {stop.signature_data ? 'Firmado' : 'Firmar / Fotos'}
                                                    </button>
                                                    <button onClick={() => handleRemoveStop(stop.order_id)} className="text-red-400 hover:text-red-600 p-1">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <div className="flex gap-4">
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
                                                    </div>

                                                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 space-y-3">
                                                        <div>
                                                            <label className="block text-[10px] font-bold uppercase text-blue-700 mb-1 flex items-center gap-1">
                                                                <User className="w-3 h-3" /> Recibe / Contacto
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder={stop.order.client_name}
                                                                value={stop.delivery_contact || ''}
                                                                onChange={(e) => {
                                                                    setRouteStops(routeStops.map(s => s.id === stop.id ? { ...s, delivery_contact: e.target.value } : s));
                                                                }}
                                                                className="w-full border border-blue-200 rounded px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold uppercase text-blue-700 mb-1 flex items-center gap-1">
                                                                <Package className="w-3 h-3" /> Items Adicionales
                                                            </label>
                                                            <textarea
                                                                rows={2}
                                                                placeholder="EJ: 2 Siliconas, 10 Tornillos..."
                                                                value={stop.items_to_deliver || ''}
                                                                onChange={(e) => {
                                                                    setRouteStops(routeStops.map(s => s.id === stop.id ? { ...s, items_to_deliver: e.target.value } : s));
                                                                }}
                                                                className="w-full border border-blue-200 rounded px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                        </div>
                                                    </div>

                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-1">Cortes: {stop.order.order_cuts?.length || 0}</h4>
                                                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-1">Materiales: {stop.order.material_usage?.length || 0} items</h4>
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

                            {/* PRINT TABLE VIEW - Only visible on print */}
                            <div className="hidden print:block w-full">
                                {/* Route Materials Table if any */}
                                {routeMaterials.length > 0 && (
                                    <div className="mb-6 break-inside-avoid">
                                        <h3 className="font-bold text-lg mb-2 uppercase border-b border-black inline-block">Materiales Generales / Herramientas</h3>
                                        <table className="w-full text-sm border-collapse border border-black">
                                            <thead>
                                                <tr className="bg-slate-100">
                                                    <th className="border border-black p-1 w-16 text-center">CANT</th>
                                                    <th className="border border-black p-1 text-left">DESCRIPCIÓN</th>
                                                    <th className="border border-black p-1 w-48 text-left">RESPONSABLE</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {routeMaterials.map((mat, idx) => (
                                                    <tr key={idx}>
                                                        <td className="border border-black p-1 text-center font-bold">{mat.quantity}</td>
                                                        <td className="border border-black p-1">{mat.description}</td>
                                                        <td className="border border-black p-1 text-xs">
                                                            {installers.find(i => i.id === mat.receiver_operator_id)?.full_name || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <table className="w-full text-sm border-collapse border border-black">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="border border-black p-2 w-20 text-center">HORA</th>
                                            <th className="border border-black p-2 w-64 text-left">CLIENTE / DIRECCIÓN</th>
                                            <th className="border border-black p-2 text-left">DETALLES (CORTES Y MATERIALES)</th>
                                            <th className="border border-black p-2 w-48 text-left">NOTAS / FIRMA</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {routeStops.sort((a, b) => a.arrival_time.localeCompare(b.arrival_time)).map((stop) => (
                                            <tr key={stop.id} className="break-inside-avoid">
                                                <td className="border border-black p-3 text-center align-top font-bold text-lg">
                                                    {stop.arrival_time}
                                                </td>
                                                <td className="border border-black p-3 align-top">
                                                    <div className="font-bold text-lg">
                                                        {stop.delivery_contact || stop.order.client_name}
                                                    </div>
                                                    <div className="font-mono text-sm mt-1">{stop.order.address}</div>
                                                    <div className="text-xs mt-2">Orden #{stop.order.order_number}</div>
                                                </td>
                                                <td className="border border-black p-3 align-top">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <div className="font-bold text-xs uppercase mb-1 border-b border-black pb-0.5">Cortes de Vidrio</div>
                                                            <ul className="list-disc pl-4 space-y-0.5 text-xs">
                                                                {stop.order.order_cuts && stop.order.order_cuts.map((cut: any, idx: number) => (
                                                                    <li key={idx}>
                                                                        <span className="font-bold">{cut.quantity}x</span> {cut.glass_types?.code} ({cut.width_mm}x{cut.height_mm})
                                                                    </li>
                                                                ))}
                                                                {(!stop.order.order_cuts || stop.order.order_cuts.length === 0) && <li>-</li>}
                                                            </ul>
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-xs uppercase mb-1 border-b border-black pb-0.5">Insumos / Materiales</div>
                                                            <ul className="list-disc pl-4 space-y-0.5 text-xs">
                                                                {/* Manual items */}
                                                                {stop.items_to_deliver && (
                                                                    <li className="font-bold text-blue-900 whitespace-pre-line mb-1">
                                                                        {stop.items_to_deliver}
                                                                    </li>
                                                                )}

                                                                {stop.order.material_usage && stop.order.material_usage.map((u: any, idx: number) => (
                                                                    <li key={idx}>
                                                                        <span className="font-bold">{u.quantity}</span> {materialsMap.get(u.material_id) || 'Item'} <span className="text-[10px] opacity-75">({u.material_type})</span>
                                                                    </li>
                                                                ))}
                                                                {(!stop.order.material_usage || stop.order.material_usage.length === 0) && !stop.items_to_deliver && <li>-</li>}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="border border-black p-3 align-top">
                                                    <div className="text-xs italic mb-8">{stop.order.description}</div>

                                                    {/* Signature Area */}
                                                    <div className="border-t border-black pt-1 mt-auto">
                                                        {stop.signature_data ? (
                                                            <div className="text-center">
                                                                <img src={stop.signature_data} className="max-h-12 block mx-auto" />
                                                                <div className="text-[10px] uppercase font-bold mt-1">
                                                                    {stop.signed_by_name || 'Firmado Digitalmente'}
                                                                </div>
                                                                <div className="text-[8px] text-slate-500">
                                                                    {new Date(stop.signed_at).toLocaleString()}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="h-12">
                                                                <div className="text-[10px] uppercase">Firma / Conformidad</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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

                        {/* PoD Modal */}
                        {podStop && (
                            <ProofOfDelivery
                                stop={podStop}
                                onSave={handleSavePoD}
                                onClose={() => setPodStop(null)}
                            />
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}
