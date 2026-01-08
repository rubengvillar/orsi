import React, { useState, useEffect } from "react";
import { Save, User, Box, Search, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface MaterialUsageFormProps {
    orderId: string;
    onUsageRecorded: () => void;
}

interface MaterialItem {
    id: string;
    code: string;
    description: string;
    quantity: number; // Current stock
}

type MaterialType = 'aluminum_accessory' | 'aluminum_profile' | 'glass_sheet' | 'glass_accessory';

interface Operator {
    id: string;
    full_name: string;
}

export default function MaterialUsageForm({ orderId, onUsageRecorded }: MaterialUsageFormProps) {
    const [loading, setLoading] = useState(false);
    const [operators, setOperators] = useState<Operator[]>([]);

    // Selection State
    const [selectedOperator, setSelectedOperator] = useState<string>("");
    const [materialType, setMaterialType] = useState<MaterialType>('aluminum_accessory');
    const [searchQuery, setSearchQuery] = useState("");
    const [materials, setMaterials] = useState<MaterialItem[]>([]);
    const [selectedMaterial, setSelectedMaterial] = useState<string>("");
    const [quantity, setQuantity] = useState<number>(1);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchOperators();
    }, []);

    useEffect(() => {
        if (searchQuery.length > 2 || searchQuery === "") {
            fetchMaterials();
        }
    }, [materialType, searchQuery]);

    const fetchOperators = async () => {
        const { data } = await supabase.from('operators').select('id, full_name').eq('is_active', true);
        if (data) setOperators(data || []);
    };

    const fetchMaterials = async () => {
        let table = "";
        switch (materialType) {
            case 'aluminum_accessory': table = 'aluminum_accessories'; break;
            case 'aluminum_profile': table = 'aluminum_profiles'; break;
            case 'glass_sheet': table = 'glass_sheets'; break;
            case 'glass_accessory': table = 'glass_accessories'; break;
        }

        let query = supabase.from(table).select('id, description, quantity');

        if (materialType === 'glass_sheet') {
            const { data, error } = await supabase.from('glass_sheets').select('id, quantity, glass_types(code, description)');
            if (data && !error) {
                setMaterials(data.map((item: any) => ({
                    id: item.id,
                    code: item.glass_types?.code,
                    description: item.glass_types?.description,
                    quantity: item.quantity
                })).filter((item: any) =>
                    !searchQuery ||
                    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase()))
                ));
                return;
            }
        } else {
            query = query.select('id, code, description, quantity');
            if (searchQuery) query = query.or(`description.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`);
        }

        const { data, error } = await query.limit(20);
        if (!error && data) {
            setMaterials(data);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const workerId = session?.user?.id;

            if (!workerId || !selectedMaterial || quantity <= 0) {
                setError("Por favor complete todos los campos correctamente.");
                setLoading(false);
                return;
            }

            const { error: rpcError } = await supabase.rpc('register_material_usage', {
                p_order_id: orderId,
                p_worker_id: workerId,
                p_material_type: materialType,
                p_material_id: selectedMaterial,
                p_quantity: quantity,
                p_operator_id: selectedOperator || null
            });

            if (rpcError) throw rpcError;

            alert("¡Uso de material registrado!");
            setQuantity(1);
            setSelectedMaterial("");
            setSelectedOperator("");
            onUsageRecorded();

        } catch (err: any) {
            console.error(err);
            const msg = err.message || "Error al registrar uso";
            if (msg.includes("Material not found")) setError("Ítem no encontrado o problema de stock.");
            else setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Box className="w-5 h-5 text-blue-600" />
                Registrar Uso de Material
            </h3>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Operator Selection (Delivered to) */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Entregado a (Operario)</label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <select
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-sm"
                            value={selectedOperator}
                            onChange={(e) => setSelectedOperator(e.target.value)}
                        >
                            <option value="">Opcional...</option>
                            {operators.map(op => (
                                <option key={op.id} value={op.id}>{op.full_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Material Type */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={materialType}
                            onChange={(e) => setMaterialType(e.target.value as MaterialType)}
                        >
                            <option value="aluminum_accessory">Acc. Aluminio</option>
                            <option value="aluminum_profile">Perfil Aluminio</option>
                            <option value="glass_sheet">Hoja Vidrio</option>
                            <option value="glass_accessory">Acc. Vidrio</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
                        <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={quantity}
                            onChange={(e) => setQuantity(parseFloat(e.target.value))}
                        />
                    </div>
                </div>

                {/* Material Search & Select */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ítem / Material</label>
                    <div className="relative mb-2">
                        <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar material..."
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg shadow-inner bg-slate-50" style={{ scrollbarWidth: 'thin' }}>
                        {materials.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">No se encontraron ítems</div>
                        ) : (
                            materials.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedMaterial(item.id)}
                                    className={`p-2 text-sm cursor-pointer hover:bg-white flex justify-between items-center border-b border-slate-100 last:border-0 ${selectedMaterial === item.id ? 'bg-blue-50 border-blue-200' : ''}`}
                                >
                                    <div className="flex flex-col flex-1 truncate mr-2">
                                        <span className="font-semibold text-slate-800">{item.code}</span>
                                        <span className="text-[11px] text-slate-500 truncate">{item.description}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap">Stock: {item.quantity}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
                >
                    {loading ? "Registrando..." : <> <Save className="w-4 h-4" /> Registrar Uso </>}
                </button>
            </form>
        </div>
    );
}
