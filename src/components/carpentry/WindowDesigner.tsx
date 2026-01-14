import React, { useState, useEffect } from 'react';
import { Save, X, RotateCcw, Box, Layers, Maximize, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CarpentrySystem, GlassType } from '../../types/database';
import { GeometryEngine } from '../../lib/carpentry/GeometryEngine';
import { CostCalculator } from '../../lib/carpentry/CostCalculator';
import { CutCalculator } from '../../lib/carpentry/CutCalculator';
import { GlassCalculator } from '../../lib/carpentry/GlassCalculator';

interface Props {
    projectId: string;
    unitId?: string | null;
    onClose: () => void;
}

export default function WindowDesigner({ projectId, unitId, onClose }: Props) {
    // Data Sources
    const [systems, setSystems] = useState<CarpentrySystem[]>([]);
    const [glassTypes, setGlassTypes] = useState<GlassType[]>([]);

    // Form State
    const [name, setName] = useState('Nueva Abertura');
    const [systemId, setSystemId] = useState('');
    const [width, setWidth] = useState(1500);
    const [height, setHeight] = useState(1200);
    const [quantity, setQuantity] = useState(1);
    const [openingType, setOpeningType] = useState('corrediza'); // corrediza, paño_fijo, batiente
    const [glassTypeId, setGlassTypeId] = useState('');
    const [glassComposition, setGlassComposition] = useState<'simple' | 'dvh'>('simple');

    // Results
    const [costResult, setCostResult] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (unitId) loadUnit(unitId);
    }, [unitId]);

    useEffect(() => {
        calculate();
    }, [systemId, width, height, quantity, openingType, glassTypeId, glassComposition]);

    const loadData = async () => {
        const { data: s } = await supabase.from('carpentry_systems').select('*');
        const { data: g } = await supabase.from('glass_types').select('*');
        setSystems(s || []);
        setGlassTypes(g || []);
        setLoading(false);
    };

    const loadUnit = async (id: string) => {
        const { data } = await supabase.from('carpentry_units').select('*').eq('id', id).single();
        if (data) {
            setName(data.name);
            setSystemId(data.system_id || '');
            setWidth(data.width);
            setHeight(data.height);
            setQuantity(data.quantity);
            setOpeningType(data.opening_type || 'corrediza');
            setGlassTypeId(data.glass_type_id || '');
            setGlassComposition(data.glass_composition as any || 'simple');
        }
    };

    const calculate = () => {
        if (!systemId) return;

        // 1. Geometry (Simple Rect for now)
        // const polygon = GeometryEngine.createRectangle(width, height);

        // 2. Cuts
        // Mocking system config for now
        const systemConfig = { frame_joint: 45 };
        const cuts = CutCalculator.calculateFrameCuts(width, height, systemConfig);

        // 3. Glass
        const glass = GlassCalculator.calculateSimpleGlass(width, height, { glass_deduction_w: 100, glass_deduction_h: 100 }, glassComposition);

        // 4. Cost
        // Needs profile prices - mocking for V0
        const mockPrices = {
            'FRAME_PROFILE': { price: 15, weight: 1.2, isByWeight: true } // $15/kg
        };
        const glassPrice = 45; // $45/m2

        const result = CostCalculator.calculateTotal(cuts, glass, mockPrices, glassPrice);
        setCostResult(result);
    };

    const handleSave = async () => {
        const unitData = {
            project_id: projectId,
            name,
            system_id: systemId,
            width,
            height,
            quantity,
            opening_type: openingType,
            glass_type_id: glassTypeId || null,
            glass_composition: glassComposition,
            estimated_cost: costResult?.total_cost || 0,
            cost_breakdown: costResult,
            updated_at: new Date().toISOString()
        };

        if (unitId) {
            await supabase.from('carpentry_units').update(unitData).eq('id', unitId);
        } else {
            await supabase.from('carpentry_units').insert([unitData]);
        }
        onClose();
    };

    if (loading) return <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">Cargando diseñador...</div>;

    return (
        <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col">
            {/* Toolbar */}
            <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm">
                <div>
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Box className="w-5 h-5 text-blue-600" />
                        Diseñador de Aberturas
                    </h2>
                    <p className="text-xs text-slate-500">Proyecto: {projectId}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-600">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                        <Save className="w-4 h-4" /> Guardar Diseño
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Config Panel */}
                <div className="w-80 bg-white border-r overflow-y-auto p-4 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre / Identificador</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                            <Layers className="w-4 h-4" /> Sistema y Tipología
                        </h3>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Línea (Sistema)</label>
                            <select value={systemId} onChange={e => setSystemId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50">
                                <option value="">Seleccionar Sistema...</option>
                                {systems.map(s => <option key={s.id} value={s.id}>{s.name} ({s.brand})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Apertura</label>
                            <select value={openingType} onChange={e => setOpeningType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="corrediza">Corrediza</option>
                                <option value="paño_fijo">Paño Fijo</option>
                                <option value="batiente">Batiente / Oscilobatiente</option>
                                <option value="proyectante">Proyectante</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                            <Maximize className="w-4 h-4" /> Dimensiones
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Ancho (mm)</label>
                                <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Alto (mm)</label>
                                <input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Cantidad</label>
                            <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                            <Box className="w-4 h-4" /> Vidrio
                        </h3>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de Vidrio</label>
                            <select value={glassTypeId} onChange={e => setGlassTypeId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="">Sin Vidrio / A definir</option>
                                {glassTypes.map(g => <option key={g.id} value={g.id}>{g.code} - {g.description}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Composición</label>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                {['simple', 'dvh'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setGlassComposition(t as any)}
                                        className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${glassComposition === t ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {t.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 bg-slate-200 relative items-center justify-center flex p-8">
                    <div className="bg-white shadow-lg relative transition-all duration-300" style={{
                        width: width / 5, // Scale down visualization
                        height: height / 5,
                        border: '4px solid #334155'
                    }}>
                        {/* Simple visualization of frame */}
                        <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-6xl font-thin select-none pointer-events-none">
                            {width} x {height}
                        </div>

                        {/* Dimensions Labels */}
                        <div className="absolute -top-8 left-0 right-0 text-center text-xs font-mono bg-slate-800 text-white py-1 rounded">{width} mm</div>
                        <div className="absolute -left-8 top-0 bottom-0 flex items-center">
                            <div className="text-xs font-mono bg-slate-800 text-white py-1 px-1 rounded [writing-mode:vertical-lr]">{height} mm</div>
                        </div>
                    </div>
                </div>

                {/* Info / Cost Panel */}
                <div className="w-80 bg-slate-50 border-l p-4 flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Estimación de Costos
                    </h3>

                    {costResult ? (
                        <div className="space-y-4 flex-1 overflow-y-auto">
                            <div className="bg-white p-3 rounded-lg border shadow-sm">
                                <p className="text-sm text-slate-500 mb-1">Costo Total Estimado</p>
                                <p className="text-2xl font-bold text-green-600">${costResult.total_cost.toFixed(2)}</p>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Desglose</p>
                                {costResult.items.map((item: any, idx: number) => (
                                    <div key={idx} className="bg-white p-2 rounded border text-sm flex justify-between">
                                        <div>
                                            <p className="font-medium text-slate-700">{item.description}</p>
                                            <p className="text-xs text-slate-400">{item.quantity} u. x ${item.unit_cost.toFixed(2)}</p>
                                        </div>
                                        <div className="font-semibold text-slate-700">
                                            ${item.total_cost.toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10 text-slate-400 text-sm">
                            Configure el sistema y las medidas para calcular costos.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
