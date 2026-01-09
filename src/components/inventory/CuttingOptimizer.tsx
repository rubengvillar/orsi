import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Scissors, Box, Layers, Play, CheckCircle2, AlertCircle, FileText, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { hasPermission } from "../../stores/authStore";
import { PERMISSIONS } from "../../lib/permissions";

export default function CuttingOptimizer() {
    const [glassTypes, setGlassTypes] = useState<any[]>([]);
    const [selectedType, setSelectedType] = useState<string>("");
    const [pendingCuts, setPendingCuts] = useState<any[]>([]);
    const [availableStock, setAvailableStock] = useState<{ sheets: number, remnants: any[] }>({ sheets: 0, remnants: [] });
    const [loading, setLoading] = useState(false);
    const [pendingCutsCounts, setPendingCutsCounts] = useState<Record<string, number>>({});

    // Optimization State
    const [selectedCuts, setSelectedCuts] = useState<string[]>([]);
    const [optimizationResult, setOptimizationResult] = useState<any>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const canRun = hasPermission(PERMISSIONS.OPTIMIZER_RUN);

    useEffect(() => {
        fetchTypes();
    }, []);

    useEffect(() => {
        if (selectedType) {
            fetchData();
        }
    }, [selectedType]);

    const fetchTypes = async () => {
        const { data } = await supabase.from('glass_types').select('*').order('code');
        setGlassTypes(data || []);
        if (data?.length) setSelectedType(data[0].id);

        // Fetch pending cuts count for all types
        const { data: allCuts } = await supabase
            .from('order_cuts')
            .select('glass_type_id')
            .eq('status', 'pending');

        const counts: Record<string, number> = {};
        allCuts?.forEach(cut => {
            counts[cut.glass_type_id] = (counts[cut.glass_type_id] || 0) + 1;
        });
        setPendingCutsCounts(counts);
    };

    const fetchData = async () => {
        setLoading(true);
        // 1. Fetch pending cuts for this type
        const { data: cuts } = await supabase
            .from("order_cuts")
            .select("*, orders(client_name, order_number, old_order_number)")
            .eq("glass_type_id", selectedType)
            .eq("status", "pending");
        setPendingCuts(cuts || []);

        // 2. Fetch available stock
        const { data: sheets } = await supabase.from('glass_sheets').select('quantity').eq('glass_type_id', selectedType).single();
        const { data: remnants } = await supabase.from('glass_remnants').select('*').eq('glass_type_id', selectedType).order('width_mm', { ascending: false });

        setAvailableStock({
            sheets: sheets?.quantity || 0,
            remnants: (remnants || []).sort((a, b) => (a.width_mm * a.height_mm) - (b.width_mm * b.height_mm)) // Priority: Smallest Area
        });
        setLoading(false);
    };

    const toggleCutSelection = (id: string) => {
        setSelectedCuts(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // --- 2D PACKING LOGIC ---
    const runOptimizer = () => {
        // Expand cuts based on quantity
        const expandedCuts: any[] = [];
        pendingCuts
            .filter(c => selectedCuts.includes(c.id))
            .forEach(c => {
                for (let i = 0; i < c.quantity; i++) {
                    expandedCuts.push({ ...c, original_id: c.id, instance: i + 1 });
                }
            });

        if (expandedCuts.length === 0) return alert("Selecciona al menos un corte.");

        // Sort by height descending (Better for shelf packing)
        expandedCuts.sort((a, b) => b.height_mm - a.height_mm);

        const glassType = glassTypes.find(t => t.id === selectedType);
        let remainingCuts = [...expandedCuts];
        let usedPieces: any[] = [];

        // 1. Try Remnants First (Smallest to Largest Area)
        for (const rem of availableStock.remnants) {
            if (remainingCuts.length === 0) break;

            let remWidth = rem.width_mm;
            let remHeight = rem.height_mm;

            // Simplified: One or more cuts in a remnant using shelf packing
            let currentRemCuts: any[] = [];
            let x = 0, y = 0, shelfH = 0;

            const tempRemaining = [...remainingCuts];
            for (const cut of tempRemaining) {
                // Try normal orientation
                if (x + cut.width_mm <= remWidth && y + cut.height_mm <= remHeight) {
                    currentRemCuts.push({
                        ...cut,
                        posX: x,
                        posY: y
                    });
                    x += cut.width_mm;
                    shelfH = Math.max(shelfH, cut.height_mm);
                    remainingCuts = remainingCuts.filter(c => c !== cut);
                } else if (y + shelfH + cut.height_mm <= remHeight) {
                    // Try next shelf
                    y += shelfH;
                    x = 0;
                    shelfH = cut.height_mm;
                    if (x + cut.width_mm <= remWidth) {
                        currentRemCuts.push({
                            ...cut,
                            posX: x,
                            posY: y
                        });
                        x += cut.width_mm;
                        remainingCuts = remainingCuts.filter(c => c !== cut);
                    }
                }
            }

            if (currentRemCuts.length > 0) {
                usedPieces.push({
                    type: 'Rezago',
                    id: rem.id,
                    location: rem.location || 'Sin ubicación',
                    dimensions: { w: remWidth, h: remHeight },
                    dimText: `${remWidth}x${remHeight}`,
                    cuts: currentRemCuts,
                    newRemnant: (remHeight - (y + shelfH)) > 50 ? {
                        width_mm: remWidth,
                        height_mm: remHeight - (y + shelfH),
                        saveAsRemnant: true,
                        location: ""
                    } : null
                });
            }
        }

        // 2. Use Full Sheets if cuts remain
        while (remainingCuts.length > 0) {
            const sheetW = glassType.std_width_mm;
            const sheetH = glassType.std_height_mm;

            let currentSheetCuts: any[] = [];
            let x = 0, y = 0, shelfH = 0;

            const tempRemaining = [...remainingCuts];
            for (const cut of tempRemaining) {
                if (x + cut.width_mm <= sheetW && y + cut.height_mm <= sheetH) {
                    currentSheetCuts.push({
                        ...cut,
                        posX: x,
                        posY: y
                    });
                    x += cut.width_mm;
                    shelfH = Math.max(shelfH, cut.height_mm);
                    remainingCuts = remainingCuts.filter(c => c !== cut);
                } else if (y + shelfH + cut.height_mm <= sheetH) {
                    y += shelfH;
                    x = 0;
                    shelfH = cut.height_mm;
                    if (x + cut.width_mm <= sheetW) {
                        currentSheetCuts.push({
                            ...cut,
                            posX: x,
                            posY: y
                        });
                        x += cut.width_mm;
                        remainingCuts = remainingCuts.filter(c => c !== cut);
                    }
                }
            }

            if (currentSheetCuts.length === 0) {
                alert(`Corte fallido: El pedido ${remainingCuts[0].width_mm}x${remainingCuts[0].height_mm} es mayor que una hoja estándar.`);
                return;
            }

            usedPieces.push({
                type: 'Hoja Entera',
                id: null,
                dimensions: { w: sheetW, h: sheetH },
                dimText: `${sheetW}x${sheetH}`,
                cuts: currentSheetCuts,
                newRemnant: (sheetH - (y + shelfH)) > 50 ? {
                    width_mm: sheetW,
                    height_mm: sheetH - (y + shelfH),
                    saveAsRemnant: true,
                    location: ""
                } : null
            });
        }

        setOptimizationResult(usedPieces);
    };

    const updateRemnantSetting = (pieceIdx: number, field: string, value: any) => {
        setOptimizationResult((prev: any) => {
            if (!prev) return prev;
            const newResult = [...prev];
            if (newResult[pieceIdx].newRemnant) {
                newResult[pieceIdx].newRemnant = {
                    ...newResult[pieceIdx].newRemnant,
                    [field]: value
                };
            }
            return newResult;
        });
    };

    const handleConfirmCuts = async () => {
        if (!optimizationResult) return;
        setLoading(true);

        try {
            // 1. Execute SQL updates for each piece
            for (const piece of optimizationResult) {
                const uniqueCutsIds = [...new Set(piece.cuts.map((c: any) => c.original_id))];

                const payload = {
                    p_glass_type_id: selectedType,
                    p_source_type: piece.type === 'Rezago' ? 'remnant' : 'sheet',
                    p_source_id: piece.id,
                    p_cuts_ids: uniqueCutsIds,
                    p_new_remnants: (piece.newRemnant && piece.newRemnant.saveAsRemnant) ? [
                        {
                            width_mm: piece.newRemnant.width_mm,
                            height_mm: piece.newRemnant.height_mm,
                            quantity: 1,
                            location: piece.newRemnant.location || 'Auto-Optimizer'
                        }
                    ] : []
                };

                const { error } = await supabase.rpc('execute_cut_confirmation', payload);
                if (error) throw error;
            }

            // 2. Save PDF Log to Database
            const pdfOutput = generatePDF(true); // Return as base64
            const metadata = {
                total_pieces: optimizationResult.length,
                sheets_used: optimizationResult.filter(p => p.type === 'Hoja Entera').length,
                remnants_used: optimizationResult.filter(p => p.type === 'Rezago').length,
                total_cuts: optimizationResult.reduce((sum, p) => sum + p.cuts.length, 0)
            };

            await supabase.from('optimization_logs').insert({
                glass_type_id: selectedType,
                pdf_base64: pdfOutput,
                metadata
            });

            // 3. Trigger automatic download for the user
            generatePDF();

            alert("¡Optimización procesada, PDF guardado y stock actualizado!");
            setOptimizationResult(null);
            setSelectedCuts([]);
            fetchData();
        } catch (err: any) {
            alert("Error: " + err.message);
        }
        setLoading(false);
    };

    const generatePDF = (returnBase64 = false) => {
        if (!optimizationResult || optimizationResult.length === 0) return;
        const doc = new jsPDF('p', 'mm', 'a4');
        const type = glassTypes.find(t => t.id === selectedType);

        // --- CONSTANTS ---
        const pageWidth = 210;
        const accentColor = [37, 99, 235]; // Blue 600
        const darkColor = [30, 41, 59];

        // Group identical pieces
        const groupedPieces = optimizationResult.reduce((acc: any[], piece: any) => {
            const key = `${piece.type}-${piece.dimText}-${JSON.stringify(piece.cuts.map((c: any) => ({ w: c.width_mm, h: c.height_mm, client: c.orders?.client_name })))}`;
            const existing = acc.find(p => p.key === key);
            if (existing) {
                existing.count++;
                existing.pieces.push(piece);
            } else {
                acc.push({ key, count: 1, pieces: [piece], representative: piece });
            }
            return acc;
        }, []);

        // --- 1. HEADER ---
        doc.setFillColor(...accentColor);
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("Plan de Optimización de Corte", 14, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 14, 28);
        doc.text(`Vidrio: ${type?.code} - ${type?.thickness_mm}mm ${type?.color}`, 14, 33);

        // Global Stats Summary
        const totalCuts = optimizationResult.reduce((sum, p) => sum + p.cuts.length, 0);
        const sheetsUsed = optimizationResult.filter(p => p.type === 'Hoja Entera').length;
        const remnantsUsed = optimizationResult.filter(p => p.type === 'Rezago').length;

        // Area Calculations
        let totalAreaAvailable = 0;
        let totalAreaUsed = 0;
        optimizationResult.forEach((p: any) => {
            totalAreaAvailable += p.dimensions.w * p.dimensions.h;
            p.cuts.forEach((c: any) => {
                totalAreaUsed += c.width_mm * c.height_mm;
            });
        });
        const wasteArea = totalAreaAvailable - totalAreaUsed;
        const efficiency = ((totalAreaUsed / totalAreaAvailable) * 100).toFixed(1);

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 45, pageWidth - 28, 32, 3, 3, 'F');
        doc.setTextColor(...darkColor);
        doc.setFontSize(9);
        doc.text("Resumen de Recursos y Eficiencia:", 20, 52);

        doc.setDrawColor(226, 232, 240);
        doc.line(20, 54, pageWidth - 20, 54);

        doc.setFont("helvetica", "bold");
        doc.text(`Cortes Totales: ${totalCuts}`, 20, 62);
        doc.text(`Hojas Utilizadas: ${sheetsUsed}`, 75, 62);
        doc.text(`Rezagos Utilizados: ${remnantsUsed}`, 130, 62);

        doc.setFont("helvetica", "normal");
        doc.text(`Área Total: ${(totalAreaAvailable / 1000000).toFixed(2)} m²`, 20, 70);
        doc.text(`Área Utilizada: ${(totalAreaUsed / 1000000).toFixed(2)} m² (${efficiency}%)`, 75, 70);
        doc.text(`Área Desperdicio: ${(wasteArea / 1000000).toFixed(2)} m²`, 130, 70);

        let yOffset = 90;

        // Find max dimensions for uniform scaling
        const maxWidth = Math.max(...optimizationResult.map((p: any) => p.dimensions.w));
        const maxHeight = Math.max(...optimizationResult.map((p: any) => p.dimensions.h));
        const diagramW = 130;
        const diagramH = 90;
        const globalScaleX = diagramW / maxWidth;
        const globalScaleY = diagramH / maxHeight;
        const globalScale = Math.min(globalScaleX, globalScaleY);

        // --- 2. PIECES (GROUPED) ---
        groupedPieces.forEach((group: any, index: number) => {
            const piece = group.representative;
            if (yOffset > 220) {
                doc.addPage();
                yOffset = 20;
            }

            // Piece Title (no enumeration, show count and location)
            doc.setFillColor(248, 250, 252);
            doc.rect(14, yOffset - 5, pageWidth - 28, 12, 'F');
            doc.setTextColor(...darkColor);
            doc.setFontSize(13);
            doc.setFont("helvetica", "bold");
            const location = piece.type === 'Rezago' && piece.location ? ` - Ubicación: ${piece.location}` : '';
            doc.text(`ORIGEN: ${piece.type.toUpperCase()}${location}`, 14, yOffset + 2);
            doc.setFontSize(11);
            doc.text(`${piece.dimText} mm`, pageWidth - 60, yOffset + 2);
            if (group.count > 1) {
                doc.setFontSize(10);
                doc.setTextColor(220, 38, 38); // Red for count
                doc.text(`x${group.count}`, pageWidth - 20, yOffset + 2);
                doc.setTextColor(...darkColor);
            }

            yOffset += 12;

            // DRAW DIAGRAM with uniform scale
            const startX = 14;
            const startY = yOffset;

            // Use uniform scale for all pieces
            const scaledW = piece.dimensions.w * globalScale;
            const scaledH = piece.dimensions.h * globalScale;

            // Outer Container Rect
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.3);
            doc.rect(startX, startY, scaledW, scaledH);

            piece.cuts.forEach((cut: any) => {
                const cw = cut.width_mm * globalScale;
                const ch = cut.height_mm * globalScale;
                const cx = startX + (cut.posX * globalScale);
                const cy = startY + (cut.posY * globalScale);

                // Draw Cut Rect
                doc.setDrawColor(37, 99, 235);
                doc.setFillColor(239, 246, 255);
                doc.setLineWidth(0.4);
                doc.rect(cx, cy, cw, ch, 'FD');

                // Draw Inner Labels with better visibility
                if (cw > 12 && ch > 6) {
                    doc.setFontSize(7);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...accentColor);
                    doc.text(`${cut.width_mm}x${cut.height_mm}`, cx + 1, cy + 4);
                    if (cw > 20 && ch > 10) {
                        doc.setFontSize(6);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(100, 116, 139);
                        doc.text(cut.orders?.client_name?.substring(0, 12) || 'Stock', cx + 1, cy + 8);
                    }
                }
            });

            // Summary Table next to diagram (no enumeration, with order numbers)
            const tableData = piece.cuts.map((c: any) => [
                c.width_mm + "x" + c.height_mm,
                c.quantity || 1,
                c.orders?.client_name || '-',
                c.orders?.order_number || c.orders?.old_order_number || '-'
            ]);

            autoTable(doc, {
                startY: yOffset,
                margin: { left: startX + scaledW + 5 },
                tableWidth: pageWidth - (startX + scaledW + 20),
                head: [['Medidas', 'Cant', 'Cliente', 'N° Orden']],
                body: tableData,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1.5, font: 'helvetica' },
                headStyles: { fillColor: [71, 85, 105], fontStyle: 'bold', fontSize: 9 },
                columnStyles: {
                    0: { fontStyle: 'bold', halign: 'center' },
                    1: { halign: 'center', fontStyle: 'bold' },
                    3: { halign: 'center' }
                }
            });

            yOffset = Math.max((doc as any).lastAutoTable.finalY + 15, startY + scaledH + 15);
        });

        if (returnBase64) {
            return doc.output('datauristring');
        } else {
            const pdfBlob = doc.output('bloburl');
            if (!returnBase64 && typeof window !== 'undefined') {
                window.open(pdfBlob, '_blank');
            }
            return pdfBlob;
        }
    };

    const handlePreview = () => {
        const url = generatePDF(true) as string;
        setPdfUrl(url);
        setShowPreview(true);
    };

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
                                    <Trash2 className="w-5 h-5 rotate-45" />
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
                        <Scissors className="w-6 h-6 text-blue-600" />
                        Optimizador de Cortes
                    </h2>
                    <p className="text-sm text-slate-500">Combina pedidos para minimizar desperdicio.</p>
                </div>

                <select
                    value={selectedType}
                    onChange={e => setSelectedType(e.target.value)}
                    className="w-full md:w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                    {glassTypes.map(t => {
                        const pendingCount = pendingCutsCounts[t.id] || 0;
                        return (
                            <option key={t.id} value={t.id}>
                                {t.code} - {t.thickness_mm}mm {t.color}
                                {pendingCount > 0 ? ` (${pendingCount} pendientes)` : ''}
                            </option>
                        );
                    })}
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Pending Cuts */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-blue-600" /> Cortes Pendientes
                            </h3>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                {pendingCuts.length}
                            </span>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 sticky top-0 border-b">
                                    <tr>
                                        <th className="px-4 py-3"><input type="checkbox" disabled /></th>
                                        <th className="px-4 py-3">Cliente / Obra</th>
                                        <th className="px-4 py-3">Medidas</th>
                                        <th className="px-4 py-3 text-center">Cant</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading && pendingCuts.length === 0 ? (
                                        <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400">Cargando...</td></tr>
                                    ) : pendingCuts.map(cut => (
                                        <tr
                                            key={cut.id}
                                            className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedCuts.includes(cut.id) ? 'bg-blue-50' : ''}`}
                                            onClick={() => toggleCutSelection(cut.id)}
                                        >
                                            <td className="px-4 py-3">
                                                <input type="checkbox" checked={selectedCuts.includes(cut.id)} readOnly />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{cut.orders?.client_name}</td>
                                            <td className="px-4 py-3 font-mono text-slate-600">{cut.width_mm} x {cut.height_mm}</td>
                                            <td className="px-4 py-3 text-center font-bold">{cut.quantity}</td>
                                        </tr>
                                    ))}
                                    {pendingCuts.length === 0 && !loading && (
                                        <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400">No hay cortes pendientes para este tipo.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <button
                        onClick={runOptimizer}
                        disabled={selectedCuts.length === 0 || loading || !canRun}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all font-semibold shadow-md"
                    >
                        <Play className="w-5 h-5" /> {canRun ? 'Calcular Corte Óptimo' : 'Sin Permiso para Calcular'}
                    </button>
                </div>

                {/* Right: Stock & Result */}
                <div className="space-y-6">
                    {/* Stock Info */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <Box className="w-4 h-4 text-emerald-600" /> Stock Disponible
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                <span className="text-sm">Hojas Enteras</span>
                                <span className="font-bold text-lg">{availableStock.sheets}</span>
                            </div>
                            <div className="space-y-2">
                                <span className="text-xs font-medium text-slate-500 block uppercase">Rezagos compatibles</span>
                                {availableStock.remnants.slice(0, 3).map(r => (
                                    <div key={r.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-100 flex justify-between">
                                        <span>{r.width_mm} x {r.height_mm}mm</span>
                                        <span className="text-slate-400">Cant: {r.quantity}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Results Card */}
                    {optimizationResult && (
                        <div className="bg-white rounded-xl border-2 border-blue-500 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                            <div className="p-4 bg-blue-500 text-white flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <h3 className="font-bold">Plan de Optimización</h3>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePreview}
                                        className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                                    >
                                        <FileText className="w-4 h-4" /> VER PREVIA
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                                {optimizationResult.map((piece: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold uppercase text-slate-500">{idx + 1}. {piece.type}</span>
                                            <span className="text-xs font-mono bg-white px-2 py-1 rounded border">{piece.dimText}</span>
                                        </div>
                                        <div className="space-y-1">
                                            {piece.cuts.map((c: any, cidx: number) => (
                                                <div key={cidx} className="text-sm flex justify-between">
                                                    <span className="text-slate-700">{c.orders?.client_name}</span>
                                                    <span className="font-mono text-slate-500">{c.width_mm}x{c.height_mm}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {piece.newRemnant && piece.newRemnant.height_mm > 50 && (
                                            <div className="mt-3 pt-3 border-t border-dashed border-slate-300 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] text-emerald-600 font-bold uppercase">Sobrante ({piece.newRemnant.width_mm}x{piece.newRemnant.height_mm}):</p>
                                                        <label className="flex items-center gap-2 mt-1 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={piece.newRemnant.saveAsRemnant}
                                                                onChange={(e) => updateRemnantSetting(idx, 'saveAsRemnant', e.target.checked)}
                                                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                                            />
                                                            <span className="text-xs font-semibold text-slate-700">Guardar como Rezago</span>
                                                        </label>
                                                    </div>
                                                </div>
                                                {piece.newRemnant.saveAsRemnant && (
                                                    <div className="animate-in fade-in slide-in-from-top-1">
                                                        <input
                                                            type="text"
                                                            placeholder="Estiva / Ubicación (opcional)"
                                                            value={piece.newRemnant.location}
                                                            onChange={(e) => updateRemnantSetting(idx, 'location', e.target.value)}
                                                            className="w-full text-[11px] px-2 py-1.5 border rounded bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                                        />
                                                    </div>
                                                )}
                                                {!piece.newRemnant.saveAsRemnant && (
                                                    <p className="text-[11px] text-slate-400 italic">Será descartado como desperdicio.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
                                <button
                                    onClick={handleConfirmCuts}
                                    disabled={loading || !canRun}
                                    className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 font-bold shadow-sm transition-all disabled:opacity-50"
                                >
                                    {loading ? "Procesando..." : (canRun ? "Confirmar y Descontar Todo" : "Solo Lectura")}
                                </button>
                                <button
                                    onClick={() => setOptimizationResult(null)}
                                    className="w-full text-slate-500 text-xs py-1 hover:underline text-center"
                                >
                                    Cancelar y Volver
                                </button>
                            </div>
                        </div>
                    )}

                    {!optimizationResult && selectedCuts.length > 0 && (
                        <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 flex gap-3 text-amber-700">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm">
                                Seleccionaste <b>{selectedCuts.length}</b> cortes. Haz clic en "Calcular" para ver cómo distribuirlos.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
