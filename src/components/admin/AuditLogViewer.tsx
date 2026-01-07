import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Search, RotateCcw, Filter, User, Calendar, Database } from "lucide-react";

interface AuditLog {
    id: string;
    table_name: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    old_data: any;
    new_data: any;
    changed_at: string;
    changed_by: string;
    user_email?: string;
    item_name?: string;
}

export default function AuditLogViewer() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterTable, setFilterTable] = useState("");
    const [filterUser, setFilterUser] = useState("");

    useEffect(() => {
        fetchLogs();
    }, [filterTable]);

    const fetchLogs = async () => {
        setLoading(true);
        let query = supabase
            .from("audit_logs")
            .select("*")
            .order("changed_at", { ascending: false })
            .limit(50); // Pagination needed for real production, simple limit for now

        if (filterTable) {
            query = query.eq("table_name", filterTable);
        }

        // Note: Filtering by user needs UUID, but for UI we might want email. 
        // We'll fetch profiles to map UUIDs or join if view exists.
        // For MVP, we just show raw logs and fetch user emails separately or in a loop.

        const { data: logsData, error } = await query;

        if (logsData) {
            // 1. Resolve user emails
            const userIds = [...new Set(logsData.map(l => l.changed_by).filter(Boolean))];
            let userMap = new Map();
            if (userIds.length > 0) {
                const { data: users } = await supabase.from('profiles').select('id, email').in('id', userIds);
                userMap = new Map(users?.map(u => [u.id, u.email]));
            }

            // 2. Resolve item names (Inventory/Orders)
            const recordIds = logsData.map(l => l.record_id).filter(Boolean);
            let nameMap = new Map();
            if (recordIds.length > 0) {
                const { data: names } = await supabase.from('v_material_info').select('id, display_name').in('id', recordIds);
                nameMap = new Map(names?.map(n => [n.id, n.display_name]));
            }

            const enhancedLogs = logsData.map(l => ({
                ...l,
                user_email: userMap.get(l.changed_by) || 'Unknown User',
                item_name: nameMap.get(l.record_id) || null
            }));
            setLogs(enhancedLogs);
        }
        setLoading(false);
    };

    const getOpColor = (op: string) => {
        switch (op) {
            case 'INSERT': return 'bg-green-100 text-green-700 border-green-200';
            case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const formatChanges = (log: AuditLog) => {
        if (log.operation === 'INSERT') {
            return <pre className="text-xs text-green-700 overflow-x-auto">{JSON.stringify(log.new_data, null, 2)}</pre>;
        }
        if (log.operation === 'DELETE') {
            return <pre className="text-xs text-red-700 overflow-x-auto">{JSON.stringify(log.old_data, null, 2)}</pre>;
        }
        // UPDATE: Show diff ideally, or just both
        return (
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-red-50 p-2 rounded">
                    <span className="font-semibold text-red-600 block mb-1">Old</span>
                    <pre className="overflow-x-auto">{JSON.stringify(log.old_data, null, 2)}</pre>
                </div>
                <div className="bg-green-50 p-2 rounded">
                    <span className="font-semibold text-green-600 block mb-1">New</span>
                    <pre className="overflow-x-auto">{JSON.stringify(log.new_data, null, 2)}</pre>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Database className="w-5 h-5 text-purple-600" />
                    System Audit Logs
                </h2>
                <div className="flex gap-2 w-full sm:w-auto">
                    <select
                        className="px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => setFilterTable(e.target.value)}
                        value={filterTable}
                    >
                        <option value="">All Tables</option>
                        <option value="aluminum_accessories">Alu Accessories</option>
                        <option value="aluminum_profiles">Alu Profiles</option>
                        <option value="glass_types">Glass Types</option>
                        <option value="glass_sheets">Glass Sheets</option>
                        <option value="glass_remnants">Glass Remnants</option>
                        <option value="orders">Orders</option>
                        <option value="material_usage">Usage</option>
                    </select>
                    <button
                        onClick={fetchLogs}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading audit trail...</div>
            ) : (
                <div className="space-y-4">
                    {logs.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed text-slate-500">
                            No audit records found.
                        </div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                                <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border-b border-slate-100 text-sm">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getOpColor(log.operation)}`}>
                                        {log.operation}
                                    </span>
                                    <span className="font-mono text-slate-600 font-medium">{log.table_name}</span>
                                    {log.item_name && (
                                        <span className="text-slate-800 font-medium px-2 py-0.5 bg-slate-100 rounded">
                                            {log.item_name}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1 text-slate-500 ml-auto">
                                        <User className="w-3.5 h-3.5" />
                                        <span>{log.user_email || log.changed_by}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-slate-500 border-l border-slate-200 pl-3">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>{new Date(log.changed_at).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="p-3">
                                    {formatChanges(log)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
