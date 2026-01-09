import React, { useState } from 'react';
import { Edit2, Trash2, AlertTriangle, ArrowUpDown, Search } from 'lucide-react';

export interface Column<T> {
    key: keyof T;
    label: string;
    render?: (value: any, item: T) => React.ReactNode;
}

interface StockTableProps<T> {
    data: T[];
    columns: Column<T>[];
    onEdit: (item: T) => void;
    onDelete: (item: T) => void;
    isLoading?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function StockTable<T extends { id: string; min_stock?: number; quantity: number }>({
    data, columns, onEdit, onDelete, isLoading, canEdit = true, canDelete = true
}: StockTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);

    // Filter
    const filteredData = data.filter(item =>
        Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    // Sort
    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig) return 0;
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: keyof T) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">Cargando inventario...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="text-sm text-slate-500">
                    Mostrando {sortedData.length} items
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={String(col.key)}
                                    className="px-6 py-3 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                    onClick={() => handleSort(col.key)}
                                >
                                    <div className="flex items-center gap-2">
                                        {col.label}
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                            ))}
                            {(canEdit || canDelete) && <th className="px-6 py-3 text-right">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedData.map(item => {
                            const isLowStock = item.min_stock !== undefined && item.quantity <= item.min_stock;
                            return (
                                <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isLowStock ? 'bg-red-50/50 hover:bg-red-50' : ''}`}>
                                    {columns.map(col => (
                                        <td key={String(col.key)} className="px-6 py-4 text-slate-700">
                                            {col.render ? col.render(item[col.key], item) : String(item[col.key] ?? '')}
                                            {col.key === 'quantity' && isLowStock && (
                                                <span className="ml-2 inline-flex items-center text-red-600 text-xs font-medium" title="Stock Bajo">
                                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                                    Bajo Min
                                                </span>
                                            )}
                                        </td>
                                    ))}
                                    {(canEdit || canDelete) && (
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            {canEdit && (
                                                <button onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button onClick={() => onDelete(item)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {sortedData.length === 0 && (
                            <tr>
                                <td colSpan={columns.length + ((canEdit || canDelete) ? 1 : 0)} className="px-6 py-8 text-center text-slate-500">
                                    No se encontraron resultados
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
