import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Plus, Settings, Box, Ruler, Calculator } from 'lucide-react';
import type { CarpentryProject, CarpentryUnit } from '../../types/database';
import { Modal } from '../ui/Modal';
import WindowDesigner from './WindowDesigner';

interface Props {
    projectId: string;
}

export default function ProjectDetail({ projectId }: Props) {
    const [project, setProject] = useState<CarpentryProject | null>(null);
    const [units, setUnits] = useState<CarpentryUnit[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDesignerOpen, setIsDesignerOpen] = useState(false);
    const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

    useEffect(() => {
        if (projectId) fetchProjectData();
    }, [projectId]);

    const fetchProjectData = async () => {
        setLoading(true);
        // Fetch Project
        const { data: proj, error: projError } = await supabase
            .from('carpentry_projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projError) {
            console.error('Error fetching project:', projError);
        } else {
            setProject(proj);
        }

        // Fetch Units
        if (proj) {
            const { data: u, error: uError } = await supabase
                .from('carpentry_units')
                .select('*, system:carpentry_systems(name)')
                .eq('project_id', projectId)
                .order('created_at');

            if (uError) console.error('Error fetching units:', uError);
            else setUnits(u || []);
        }
        setLoading(false);
    };

    import { GlassCalculator } from '../../lib/carpentry/GlassCalculator';

    const handleGenerateOrder = async () => {
        if (!project || units.length === 0) return alert("No hay unidades para procesar.");
        if (!confirm("¿Generar Orden de Producción basada en este proyecto? Esto creará una nueva orden con los vidrios necesarios.")) return;

        setLoading(true);
        try {
            // 1. Create the Order
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert([{
                    client_name: project.client_name || `Proyecto ${project.name}`,
                    description: `Generado desde Carpintería: ${project.name}`,
                    status: 'Pending',
                    address: project.client_address
                }])
                .select()
                .single();

            if (orderError) throw orderError;
            const newOrderId = orderData.id;

            // 2. Calculate and Prepare Cuts
            const cutsPayload: any[] = [];

            // We need to fetch system configuration for deductions first
            // Optimization: Fetch all unique systems used
            const systemIds = [...new Set(units.map(u => u.system_id).filter(Boolean))];
            const { data: systems } = await supabase
                .from('carpentry_systems')
                .select('id, configuration')
                .in('id', systemIds);

            const systemsMap = new Map(systems?.map(s => [s.id, s.configuration]) || []);

            units.forEach(unit => {
                if (!unit.glass_type_id) return; // Skip if no glass selected

                // Get Rules (Default to some standard if missing)
                const config = systemsMap.get(unit.system_id) || {};
                const rules = {
                    glass_deduction_w: config.glass_deduction_w || 0, // Fallback 0 if not set
                    glass_deduction_h: config.glass_deduction_h || 0
                };

                // Calculate Glass Size
                // Assuming simple rectangular shape for now (GlassCalculator supports polygon but unit stores w/h)
                const glassResult = GlassCalculator.calculateSimpleGlass(
                    Number(unit.width),
                    Number(unit.height),
                    rules,
                    unit.glass_composition as 'simple' | 'dvh'
                );

                cutsPayload.push({
                    order_id: newOrderId,
                    cut_type: unit.glass_composition || 'simple',
                    glass_type_id: unit.glass_composition === 'simple' ? unit.glass_type_id : null,
                    // For DVH we would need outer/inner/chamber selections. 
                    // Current Unit schema has only 'glass_type_id' which is ambiguous for DVH. 
                    // Assuming 'glass_type_id' is the main glass for now.
                    // If DVH, we might leave inner/chamber null or infer.
                    // TODO: Improve Unit Schema for DVH specifics.
                    width_mm: glassResult.width_mm,
                    height_mm: glassResult.height_mm,
                    quantity: unit.quantity * glassResult.quantity,
                    status: 'pending',
                    notes: `${unit.name} (${project.name})`
                });
            });

            if (cutsPayload.length > 0) {
                const { error: cutsError } = await supabase.from('order_cuts').insert(cutsPayload);
                if (cutsError) throw cutsError;
            }

            alert("Orden de Producción generada exitosamente!");
            window.location.href = `/orders/${newOrderId}`;

        } catch (err: any) {
            console.error(err);
            alert("Error al generar orden: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando detalles del proyecto...</div>;
    if (!project) return <div className="p-8 text-center text-red-500">Proyecto no encontrado</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <a href="/carpentry" className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </a>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">
                                {project.status.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm">#{project.project_number} — {project.client_name || 'Sin Cliente'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleGenerateOrder}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                        title="Enviar requerimientos de vidrio a Producción"
                    >
                        <Box className="w-4 h-4 text-orange-500" />
                        Enviar a Producción
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">
                        <Calculator className="w-4 h-4" />
                        Ver Costos
                    </button>
                    <button
                        onClick={() => {
                            setEditingUnitId(null);
                            setIsDesignerOpen(true);
                        }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Abertura
                    </button>
                </div>
            </div>

            {/* Units Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {units.map(unit => (
                    <div key={unit.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                            <h3 className="font-semibold text-slate-800">{unit.name}</h3>
                            <span className="text-xs bg-white border px-2 py-1 rounded text-slate-500">
                                {unit.system?.name || 'Sistema Generico'}
                            </span>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-slate-500 text-xs">Medidas</p>
                                <p className="font-medium flex items-center gap-1">
                                    <Ruler className="w-3 h-3 text-slate-400" />
                                    {unit.width}mm x {unit.height}mm
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs">Cantidad</p>
                                <p className="font-medium flex items-center gap-1">
                                    <Box className="w-3 h-3 text-slate-400" />
                                    {unit.quantity} u.
                                </p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-slate-500 text-xs">Configuración</p>
                                <p className="text-slate-700">{unit.opening_type || 'Estándar'} - {unit.glass_composition?.toUpperCase() || 'Sin Vidrio'}</p>
                            </div>
                        </div>
                        <div className="px-4 py-3 bg-slate-50 border-t flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setEditingUnitId(unit.id);
                                    setIsDesignerOpen(true);
                                }}
                                className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded"
                            >
                                Editar
                            </button>
                        </div>
                    </div>
                ))}
                {units.length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-400 bg-slate-50 rounded-xl border-dashed border-2 border-slate-200">
                        No hay aberturas diseñadas en este proyecto.
                    </div>
                )}
            </div>

            {/* Designer Modal */}
            {isDesignerOpen && (
                <WindowDesigner
                    projectId={projectId}
                    unitId={editingUnitId}
                    onClose={() => {
                        setIsDesignerOpen(false);
                        fetchProjectData();
                    }}
                />
            )}
        </div>
    );
}
