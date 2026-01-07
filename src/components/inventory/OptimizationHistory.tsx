import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Download, Calendar, User, Search, Loader2, Trash2, Eye } from 'lucide-react';

export default function OptimizationHistory() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    async function fetchLogs() {
        setLoading(true);
        const { data, error } = await supabase
            .from('optimization_logs')
            .select(`
                *,
                glass_types (code, color, thickness_mm)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching logs:', error);
        } else {
            setLogs(data || []);
        }
        setLoading(false);
    }

    const downloadPDF = (base64: string, filename: string) => {
        const link = document.createElement('a');
        link.href = base64;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const [showPreview, setShowPreview] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const handlePreview = (base64: string) => {
        setPdfUrl(base64);
        setShowPreview(true);
    };

    const filteredLogs = logs.filter(log =>
        log.glass_types?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.metadata?.total_cuts?.toString().includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            {/* Preview Modal */}
            {showPreview && pdfUrl && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPreview(false)}></div>
                    <div className="relative bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" /> Vista Previa del Plan de Corte
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = pdfUrl;
                                        link.download = `plan-corte-${Date.now()}.pdf`;
                                        link.click();
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm shadow-sm"
                                >
                                    Descargar PDF
                                </button>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden">
                            <iframe src={pdfUrl} className="w-full h-full border-none" title="PDF Preview"></iframe>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-600" />
                        Historial de Plan de Cortes
                    </h2>
                    <p className="text-sm text-slate-500">Consulta y descarga optimizaciones realizadas anteriormente.</p>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                    <p className="text-slate-500 font-medium">Cargando historial...</p>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No se encontraron registros de optimización.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredLogs.map((log) => (
                        <div key={log.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="font-bold text-slate-900">{log.glass_types?.code}</span>
                                    </div>
                                    <span className="text-xs text-slate-500">
                                        {log.glass_types?.thickness_mm}mm {log.glass_types?.color}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handlePreview(log.pdf_base64)}
                                        className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                        title="Previsualizar"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => downloadPDF(log.pdf_base64, `plan-corte-${log.glass_types?.code}-${new Date(log.created_at).getTime()}.pdf`)}
                                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all transform group-hover:scale-110 shadow-sm"
                                        title="Descargar PDF"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="p-2 bg-slate-50 rounded-lg">
                                        <p className="text-slate-500 uppercase font-bold mb-1">Cortes</p>
                                        <p className="text-lg font-mono font-bold text-slate-800">{log.metadata?.total_cuts}</p>
                                    </div>
                                    <div className="p-2 bg-slate-50 rounded-lg">
                                        <p className="text-slate-500 uppercase font-bold mb-1">Piezas Origen</p>
                                        <p className="text-lg font-mono font-bold text-slate-800">{log.metadata?.total_pieces}</p>
                                    </div>
                                </div>

                                <div className="pt-2 flex flex-col gap-1.5 border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Calendar className="w-3 h-3" />
                                        <span>{new Date(log.created_at).toLocaleString('es-AR')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <User className="w-3 h-3" />
                                        <span>ID Usuario: {log.user_id?.substring(0, 8) || 'Sistema'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
