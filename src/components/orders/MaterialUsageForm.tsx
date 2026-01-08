import React, { useState, useEffect } from "react";
import { Save, User, Box, Search, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface MaterialUsageFormProps {
    orderId: string;
    onUsageRecorded: () => void;
}

interface Worker {
    id: string;
    full_name: string;
    email: string;
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
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);

    // Selection State
    const [selectedWorker, setSelectedWorker] = useState<string>("");
    const [selectedOperator, setSelectedOperator] = useState<string>("");
    const [materialType, setMaterialType] = useState<MaterialType>('aluminum_accessory');
    const [searchQuery, setSearchQuery] = useState("");
    const [materials, setMaterials] = useState<MaterialItem[]>([]);
    const [selectedMaterial, setSelectedMaterial] = useState<string>("");
    const [quantity, setQuantity] = useState<number>(1);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchWorkers();
        fetchOperators();
    }, []);

    useEffect(() => {
        if (searchQuery.length > 2 || searchQuery === "") {
            fetchMaterials();
        }
    }, [materialType, searchQuery]);

    const fetchWorkers = async () => {
        // Ideally filter by role, but for now getting profiles is enough
        const { data } = await supabase.from('profiles').select('id, full_name, email');
        if (data) setWorkers(data);
    };

    const fetchOperators = async () => {
        const { data } = await supabase.from('operators').select('id, full_name').eq('is_active', true);
        if (data) setOperators(data || []);
    };

    const fetchMaterials = async () => {
        let table = "";
        switch (materialType) {
            case 'aluminum_accessory': table = 'aluminum_accessories'; break;
            case 'aluminum_profile': table = 'aluminum_profiles'; break;
            case 'glass_sheet': table = 'glass_sheets'; break; // Note: Joined with glass_types normally, keeping simple for now
            case 'glass_accessory': table = 'glass_accessories'; break;
        }

        let query = supabase.from(table).select('id, description, quantity');

        // Adjust query based on table structure (glass_sheets usually needs relation to glass_types for description)
        // For MVP/Robustness let's handle the glass_sheet special case or assume a view.
        // If table is glass_sheets, we select glass_types(code) etc.
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
                    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.code.toLowerCase().includes(searchQuery.toLowerCase())
                ));
                return;
            }
        } else {
            // Standard tables with code/description
            query = query.select('id, code, description, quantity');
            if (searchQuery) query = query.ilike('description', `%${searchQuery}%`);
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

        if (!selectedWorker || !selectedMaterial || quantity <= 0) {
            setError("Please fill all fields correctly");
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.rpc('register_material_usage', {
                p_order_id: orderId,
                p_worker_id: selectedWorker,
                p_material_type: materialType,
                p_material_id: selectedMaterial,
                p_quantity: quantity,
                p_operator_id: selectedOperator || null
            });

            if (error) throw error;

            alert("Material usage recorded!");
            setQuantity(1);
            setSelectedMaterial("");
            setSelectedOperator("");
            onUsageRecorded();

        } catch (err: any) {
            console.error(err);
            const msg = err.message || "Failed to record usage";
            if (msg.includes("Material not found")) setError("Item not found or stock issue.");
            else setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Box className="w-5 h-5 text-blue-600" />
                Register Material Usage
            </h3>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Worker (Recorded by)</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                            <select
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-sm"
                                value={selectedWorker}
                                onChange={(e) => setSelectedWorker(e.target.value)}
                                required
                            >
                                <option value="">Select...</option>
                                {workers.map(w => (
                                    <option key={w.id} value={w.id}>{w.full_name || w.email}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Operator (Delivered to)</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                            <select
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-sm"
                                value={selectedOperator}
                                onChange={(e) => setSelectedOperator(e.target.value)}
                            >
                                <option value="">Optional...</option>
                                {operators.map(op => (
                                    <option key={op.id} value={op.id}>{op.full_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Material Type */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={materialType}
                            onChange={(e) => setMaterialType(e.target.value as MaterialType)}
                        >
                            <option value="aluminum_accessory">Alu Accessory</option>
                            <option value="aluminum_profile">Alu Profile</option>
                            <option value="glass_sheet">Glass Sheet</option>
                            <option value="glass_accessory">Glass Accessory</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                        <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={quantity}
                            onChange={(e) => setQuantity(parseFloat(e.target.value))}
                        />
                    </div>
                </div>

                {/* Material Search & Select */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
                    <div className="relative mb-2">
                        <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search item..."
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg" style={{ scrollbarWidth: 'thin' }}>
                        {materials.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">No items found</div>
                        ) : (
                            materials.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedMaterial(item.id)}
                                    className={`p-2 text-sm cursor-pointer hover:bg-slate-50 flex justify-between items-center border-b border-slate-50 last:border-0 ${selectedMaterial === item.id ? 'bg-blue-50 border-blue-100' : ''}`}
                                >
                                    <span className="truncate flex-1 font-medium text-slate-700">{item.description || item.code}</span>
                                    <span className="text-xs text-slate-500 ml-2 bg-slate-100 px-1.5 py-0.5 rounded">Stock: {item.quantity}</span>
                                </div>
                            ))
                        )}
                    </div>
                    {selectedMaterial && <div className="text-xs text-blue-600 mt-1 font-medium">Selected ID: {selectedMaterial}</div>}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {loading ? "Recording..." : <> <Save className="w-4 h-4" /> Register Usage </>}
                </button>
            </form>
        </div>
    );
}
