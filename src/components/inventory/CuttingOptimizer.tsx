import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Scissors, Box, Layers, Play, CheckCircle2, AlertCircle, FileText, Trash2, Calendar, LayoutGrid } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { hasPermission } from "../../stores/authStore";
import { PERMISSIONS } from "../../lib/permissions";

export default function CuttingOptimizer() {
    const [glassTypes, setGlassTypes] = useState<any[]>([]);
    const [pendingCuts, setPendingCuts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [excludedCuts, setExcludedCuts] = useState<any[]>([]);

    // Optimization State
    const [selectedCuts, setSelectedCuts] = useState<string[]>([]);
    const [optimizationResult, setOptimizationResult] = useState<any>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const canRun = hasPermission(PERMISSIONS.OPTIMIZER_RUN);

    useEffect(() => {
        fetchTypes();
        fetchData();
    }, []);

    const fetchTypes = async () => {
        const { data } = await supabase.from('glass_types').select('*').order('code');
        setGlassTypes(data || []);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Types (Ensure we have them for manual join)
            const { data: typesData } = await supabase.from('glass_types').select('*');
            const typesMap = new Map((typesData || []).map(t => [t.id, t]));
            // Also update the state for other usages
            setGlassTypes(typesData || []);

            // 2. Fetch ALL pending or optimized cuts (WITHOUT the failing glass_types join)
            const { data: cuts, error } = await supabase
                .from("order_cuts")
                .select("*, orders(client_name, order_number, legacy_order_number, created_at)")
                .in("status", ["pending", "Pending"]);

            if (error) {
                console.error("Error fetching order_cuts:", error);
                throw error;
            }

            // 3. Manual Client-Side Join
            const joinedCuts = (cuts || []).map((cut: any) => ({
                ...cut,
                glass_types: typesMap.get(cut.glass_type_id) || null
            }));

            console.log("CuttingOptimizer fetch result:", { cuts: joinedCuts });
            if (!joinedCuts.length) console.warn("CuttingOptimizer: No cuts found.");

            // 4. Sort
            const sortedCuts = joinedCuts.sort((a: any, b: any) => {
                const dateA = new Date(a.orders?.created_at || 0).getTime();
                const dateB = new Date(b.orders?.created_at || 0).getTime();
                return dateA - dateB;
            });

            setPendingCuts(sortedCuts);
        } catch (err: any) {
            console.error("CuttingOptimizer Data Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleCutSelection = (id: string) => {
        setSelectedCuts(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const selectAllCuts = () => {
        if (selectedCuts.length === pendingCuts.length) {
            setSelectedCuts([]);
        } else {
            setSelectedCuts(pendingCuts.map(c => c.id));
        }
    };

    // --- WASTE CALCULATION HELPER ---
    const calculateWastes = (piece: any) => {
        const sortedCuts = [...piece.cuts].sort((a, b) => a.posY - b.posY || a.posX - b.posX);
        // Identify Shelves
        const shelves: any[] = [];
        let currentY = -1;
        let currentShelf: any = null;

        sortedCuts.forEach(cut => {
            if (!currentShelf || Math.abs(cut.posY - currentY) > 1) {
                currentY = cut.posY;
                currentShelf = { y: currentY, h: 0, cuts: [] };
                shelves.push(currentShelf);
            }
            currentShelf.cuts.push(cut);
            currentShelf.h = Math.max(currentShelf.h, cut.height_mm);
        });

        const wastes: any[] = []; // {x, y, w, h, label, type, saved}
        const sheetW = piece.dimensions.w;
        const sheetH = piece.dimensions.h;
        let lastShelfBottom = 0;

        shelves.forEach(shelf => {
            let currentX = 0;
            shelf.cuts.forEach((cut: any) => {
                // Top Waste
                if (shelf.h - cut.height_mm > 5) {
                    wastes.push({
                        id: `W-${Math.random().toString(36).substr(2, 5)}`,
                        x: cut.posX,
                        y: cut.posY + cut.height_mm,
                        w: cut.width_mm,
                        h: shelf.h - cut.height_mm,
                        label: "DESPERDICIO",
                        type: 'DESPERDICIO',
                        saved: false
                    });
                }
                currentX = cut.posX + cut.width_mm;
            });
            // Right Waste
            if (sheetW - currentX > 5) {
                wastes.push({
                    id: `W-${Math.random().toString(36).substr(2, 5)}`,
                    x: currentX,
                    y: shelf.y,
                    w: sheetW - currentX,
                    h: shelf.h,
                    label: "DESPERDICIO",
                    type: 'DESPERDICIO',
                    saved: false
                });
            }
            lastShelfBottom = shelf.y + shelf.h;
        });

        // Bottom Waste
        if (sheetH - lastShelfBottom > 5) {
            const isBigEnough = (sheetH - lastShelfBottom) > 50;
            wastes.push({
                id: `W-${Math.random().toString(36).substr(2, 5)}`,
                x: 0,
                y: lastShelfBottom,
                w: sheetW,
                h: sheetH - lastShelfBottom,
                label: isBigEnough ? "REZAGO" : "DESPERDICIO",
                type: isBigEnough ? "REZAGO" : "DESPERDICIO",
                saved: isBigEnough // Default clean waste > 50mm to saved
            });
        }
        return wastes;
    };

    // --- 2D PACKING LOGIC (MULTI-TYPE) ---
    const runOptimizer = async () => {
        const expandedCuts: any[] = [];
        pendingCuts
            .filter(c => selectedCuts.includes(c.id))
            .forEach(c => {
                for (let i = 0; i < c.quantity; i++) {
                    expandedCuts.push({ ...c, original_id: c.id, instance: i + 1 });
                }
            });

        if (expandedCuts.length === 0) return alert("Selecciona al menos un corte.");

        setLoading(true);
        setExcludedCuts([]);

        // Group by Glass Type
        const cutsByType: Record<string, any[]> = {};
        expandedCuts.forEach(c => {
            if (!cutsByType[c.glass_type_id]) cutsByType[c.glass_type_id] = [];
            cutsByType[c.glass_type_id].push(c);
        });

        const finalResults: any[] = [];
        const allSkippedCuts: any[] = [];

        try {
            // Process each type
            for (const typeId of Object.keys(cutsByType)) {
                const typeCuts = cutsByType[typeId];
                const glassType = glassTypes.find(t => t.id === typeId);

                // Fetch STOCK for this type
                const { data: sheets } = await supabase.from('glass_sheets').select('*').eq('glass_type_id', typeId).gt('quantity', 0);
                const { data: remnants } = await supabase.from('glass_remnants').select('*').eq('glass_type_id', typeId).order('width_mm', { ascending: false });

                const stock = {
                    sheets: (sheets || []).sort((a, b) => (b.width_mm * b.height_mm) - (a.width_mm * a.height_mm)), // Largest sheets first
                    remnants: (remnants || []).sort((a, b) => (a.width_mm * a.height_mm) - (b.width_mm * b.height_mm)) // Smallest remnants first? Original code was sorting by Area a-b (Ascending? So smallest first).
                };

                // Sort by height descending
                typeCuts.sort((a, b) => b.height_mm - a.height_mm);

                // FILTER: Exclude cuts that are definitely too big for ANY stock (sheet or largest remnant)
                const maxSheetW = stock.sheets.length > 0 ? Math.max(...stock.sheets.map((s: any) => s.width_mm)) : 0;
                const maxSheetH = stock.sheets.length > 0 ? Math.max(...stock.sheets.map((s: any) => s.height_mm)) : 0;

                const maxRemnantW = stock.remnants.length > 0 ? Math.max(...stock.remnants.map((r: any) => r.width_mm)) : 0;
                const maxRemnantH = stock.remnants.length > 0 ? Math.max(...stock.remnants.map((r: any) => r.height_mm)) : 0;

                const maxStockW = Math.max(maxSheetW, maxRemnantW);
                const maxStockH = Math.max(maxSheetH, maxRemnantH);

                let remainingCuts: any[] = [];
                const skippedCuts: any[] = [];

                for (const c of typeCuts) {
                    // Check if fit in normal orientation OR rotated
                    const fitsStandard = c.width_mm <= maxStockW && c.height_mm <= maxStockH;
                    const fitsRotated = c.height_mm <= maxStockW && c.width_mm <= maxStockH;

                    if (fitsStandard || fitsRotated) {
                        remainingCuts.push(c);
                    } else {
                        skippedCuts.push(c);
                    }
                }

                if (skippedCuts.length > 0) {
                    // alert(`Atención: ${skippedCuts.length} cortes de ${glassType.code} fueron excluidos...`);
                    // Now we collect them silently
                }

                // Add skipped to list
                allSkippedCuts.push(...skippedCuts);

                let usedPieces: any[] = [];

                // 1. Try Remnants First
                for (const rem of stock.remnants) {
                    if (remainingCuts.length === 0) break;
                    let remWidth = rem.width_mm;
                    let remHeight = rem.height_mm;
                    let currentRemCuts: any[] = [];
                    let x = 0, y = 0, shelfH = 0;
                    const tempRemaining = [...remainingCuts];

                    for (const cut of tempRemaining) {
                        if (x + cut.width_mm <= remWidth && y + cut.height_mm <= remHeight) {
                            currentRemCuts.push({ ...cut, posX: x, posY: y });
                            x += cut.width_mm;
                            shelfH = Math.max(shelfH, cut.height_mm);
                            remainingCuts = remainingCuts.filter(c => c !== cut);
                        } else if (y + shelfH + cut.height_mm <= remHeight) {
                            y += shelfH; x = 0; shelfH = cut.height_mm;
                            if (x + cut.width_mm <= remWidth) {
                                currentRemCuts.push({ ...cut, posX: x, posY: y });
                                x += cut.width_mm;
                                remainingCuts = remainingCuts.filter(c => c !== cut);
                            }
                        }
                    }
                    if (currentRemCuts.length > 0) {
                        const pieceObj = {
                            type: 'Rezago',
                            glassType: glassType,
                            id: rem.id,
                            location: rem.location || 'Sin ubicación',
                            dimensions: { w: remWidth, h: remHeight },
                            dimText: `${remWidth}x${remHeight}`,
                            cuts: currentRemCuts,
                            wastes: [] as any[] // Placeholder
                        };
                        pieceObj.wastes = calculateWastes(pieceObj);
                        usedPieces.push(pieceObj);
                    }
                }

                // 2. Use Full Sheets (Iterate available stock)
                // We track local quantity consumption of stock.sheets
                const availableSheets = stock.sheets.map(s => ({ ...s })); // Clone to track current qty usage

                while (remainingCuts.length > 0) {
                    // Find a sheet that can fit at least the first cut (which is largest height)
                    let selectedSheet: any = null;

                    // Simple Strategy: Find first available sheet type that fits the first cut
                    // Since specific size matching is complex, we iterate available types
                    for (const sheet of availableSheets) {
                        if (sheet.quantity > 0) {
                            // Check potential fit (rough check)
                            const cut = remainingCuts[0];
                            const fits = (cut.width_mm <= sheet.width_mm && cut.height_mm <= sheet.height_mm) ||
                                (cut.height_mm <= sheet.width_mm && cut.width_mm <= sheet.height_mm);

                            if (fits) {
                                selectedSheet = sheet;
                                break;
                            }
                        }
                    }

                    if (!selectedSheet) {
                        // No sheet found that fits the next cut
                        console.warn("No stock sheet fits remaining cuts.");
                        // Move all remaining to skipped? Or break to avoid infinite loop
                        if (remainingCuts.length > 0) {
                            allSkippedCuts.push(...remainingCuts);
                            remainingCuts = [];
                        }
                        break;
                    }

                    // Use the selected sheet
                    const sheetW = selectedSheet.width_mm;
                    const sheetH = selectedSheet.height_mm;
                    let currentSheetCuts: any[] = [];
                    let x = 0, y = 0, shelfH = 0;

                    const tempRemaining = [...remainingCuts];
                    for (const cut of tempRemaining) {
                        if (x + cut.width_mm <= sheetW && y + cut.height_mm <= sheetH) {
                            currentSheetCuts.push({ ...cut, posX: x, posY: y });
                            x += cut.width_mm;
                            shelfH = Math.max(shelfH, cut.height_mm);
                            remainingCuts = remainingCuts.filter(c => c !== cut);
                        } else if (y + shelfH + cut.height_mm <= sheetH) {
                            y += shelfH; x = 0; shelfH = cut.height_mm;
                            if (x + cut.width_mm <= sheetW) {
                                currentSheetCuts.push({ ...cut, posX: x, posY: y });
                                x += cut.width_mm;
                                remainingCuts = remainingCuts.filter(c => c !== cut);
                            }
                        }
                    }

                    if (currentSheetCuts.length === 0) {
                        // Fit failed despite pre-check? (e.g. rotation issue logic in loop vs fit check)
                        // Force skip first cut to avoid infinite loop
                        const badCut = remainingCuts.shift();
                        if (badCut) allSkippedCuts.push(badCut);
                        continue;
                    }

                    // Decrement stock
                    selectedSheet.quantity--;

                    const pieceObj = {
                        type: 'Hoja Entera',
                        glassType: glassType,
                        id: selectedSheet.id, // We now have a specific Sheet ID
                        dimensions: { w: sheetW, h: sheetH },
                        dimText: `${sheetW}x${sheetH}`,
                        cuts: currentSheetCuts,
                        wastes: [] as any[]
                    };
                    pieceObj.wastes = calculateWastes(pieceObj);
                    usedPieces.push(pieceObj);
                }
                finalResults.push(...usedPieces);
            }

            setOptimizationResult(finalResults);
            setExcludedCuts(allSkippedCuts);
        } catch (error) {
            console.error(error);
            alert("Error running optimizer: " + error);
        } finally {
            setLoading(false);
        }
    };

    const updateRemnantSetting = (pieceIdx: number, wasteId: string, field: string, value: any) => {
        setOptimizationResult((prev: any) => {
            if (!prev) return prev;
            const newResult = [...prev];
            const waste = newResult[pieceIdx].wastes.find((w: any) => w.id === wasteId);
            if (waste) {
                waste[field] = value;
                // Auto-update label/type if saved status changes
                if (field === 'saved') {
                    waste.label = value ? 'REZAGO' : 'DESPERDICIO';
                    waste.type = value ? 'REZAGO' : 'DESPERDICIO';
                }
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
                    p_glass_type_id: piece.glassType.id,
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
            const pdfOutput = generatePDF('base64'); // Return as base64 string
            const metadata = {
                total_pieces: optimizationResult.length,
                sheets_used: optimizationResult.filter((p: any) => p.type === 'Hoja Entera').length,
                remnants_used: optimizationResult.filter((p: any) => p.type === 'Rezago').length,
                total_cuts: optimizationResult.reduce((sum: any, p: any) => sum + p.cuts.length, 0)
            };

            await supabase.from('optimization_logs').insert({
                glass_type_id: null, // Global log for multi-type batch
                pdf_base64: pdfOutput,
                metadata
            });

            // 3. Trigger automatic download for the user
            generatePDF('download');

            alert("¡Optimización procesada, PDF guardado y stock actualizado!");
            setOptimizationResult(null);
            setSelectedCuts([]);
            fetchData();
        } catch (err: any) {
            alert("Error: " + err.message);
        }
        setLoading(false);
    };

    const generatePDF = (action: 'base64' | 'blob' | 'download' = 'download') => {
        try {
            if (!optimizationResult || optimizationResult.length === 0) return;
            const doc = new jsPDF('p', 'mm', 'a4');

            // Group results by Glass Type
            const resultsByType: Record<string, any[]> = {};
            optimizationResult.forEach((p: any) => {
                const typeCode = p.glassType.code;
                if (!resultsByType[typeCode]) resultsByType[typeCode] = [];
                resultsByType[typeCode].push(p);
            });

            const typeCodes = Object.keys(resultsByType);
            typeCodes.forEach((typeCode, typeIdx) => {
                const typePieces = resultsByType[typeCode];
                const type = typePieces[0].glassType; // Info from first piece

                if (typeIdx > 0) doc.addPage();

                // --- HEADER CONSTANTS ---
                const pageWidth = 210;
                const pageHeight = 297;
                const accentColor = [37, 99, 235]; // Blue 600
                const darkColor = [30, 41, 59];

                // Color Definitions
                const colDesperdicio = [241, 245, 249]; // Slate 100
                const colRezago = [220, 252, 231]; // Emerald 100

                // --- 1. HEADER ---
                doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.rect(0, 0, pageWidth, 35, 'F');

                doc.setTextColor(255, 255, 255);
                doc.setFontSize(22);
                doc.setFont("helvetica", "bold");
                doc.text("Plan de Corte", 14, 18);

                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 14, 26);
                doc.text(`Vidrio: ${type?.code} - ${type?.thickness_mm}mm ${type?.color}`, 14, 31);

                // --- 2. PIECES ITERATION ---
                // We create a new page for each SHEET/REMNANT used to maximize clarity

                typePieces.forEach((piece: any, index: number) => {
                    if (index > 0) doc.addPage();

                    // -- A. Piece Header
                    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    // removed ID display from header label
                    const originText = piece.type === 'Rezago' ? `REZAGO` : `HOJA ENTERA`;
                    const locationText = piece.location ? ` @ ${piece.location}` : '';
                    doc.text(`${index + 1}. ${originText} - ${piece.dimText} mm${locationText}`, 14, 45); // Moved down

                    // -- B. Reconstruct Geometry (Shelves & Waste)
                    // 1. Sort cuts by Y then X
                    const sortedCuts = [...piece.cuts].sort((a, b) => a.posY - b.posY || a.posX - b.posX);

                    // 2. Identify Shelves
                    const shelves: any[] = [];
                    let currentY = -1;
                    let currentShelf: any = null;

                    sortedCuts.forEach(cut => {
                        // Simple heuristic: if Y is significantly different, new shelf
                        if (!currentShelf || Math.abs(cut.posY - currentY) > 1) {
                            currentY = cut.posY;
                            currentShelf = { y: currentY, h: 0, cuts: [] };
                            shelves.push(currentShelf);
                        }
                        currentShelf.cuts.push(cut);
                        currentShelf.h = Math.max(currentShelf.h, cut.height_mm);
                    });

                    // 3. Wastes are now from STATE (piece.wastes)
                    const wastes = piece.wastes || []; // Use stored wastes
                    const sheetW = piece.dimensions.w;
                    const sheetH = piece.dimensions.h;

                    // -- C. DRAW DIAGRAM (Scaled to fit page width)
                    const diagramTopY = 55; // Increased margin
                    const diagramMaxH = 120; // Decreased height
                    const diagramMaxW = 160; // margins

                    const scaleX = diagramMaxW / sheetW;
                    const scaleY = diagramMaxH / sheetH;
                    const scale = Math.min(scaleX, scaleY);

                    // Draw Sheet Boundary
                    doc.setDrawColor(0, 0, 0);
                    doc.setLineWidth(0.5);
                    doc.rect(14, diagramTopY, sheetW * scale, sheetH * scale); // Outer frame

                    // Draw Cuts and Cut Lines
                    doc.setFontSize(8);

                    // 1. Draw Wastes (Light Grey)
                    wastes.forEach((w: any) => {
                        const wx = 14 + w.x * scale;
                        const wy = diagramTopY + w.y * scale;
                        const ww = w.w * scale;
                        const wh = w.h * scale;

                        const [r, g, b] = w.saved ? colRezago : colDesperdicio;
                        doc.setFillColor(r, g, b);
                        doc.rect(wx, wy, ww, wh, 'F');

                        // Label waste dimensions if big enough
                        if (ww > 15 && wh > 8) {
                            doc.setTextColor(150, 150, 150);
                            doc.setFont("helvetica", "italic");
                            doc.setFontSize(6);
                            doc.text(`${Math.round(w.w)}x${Math.round(w.h)}`, wx + ww / 2, wy + wh / 2, { align: 'center' });

                            if (ww > 30 && wh > 15 && w.saved) {
                                doc.setTextColor(22, 163, 74); // Green Text
                                doc.text("[REZAGO]", wx + ww / 2, wy + wh / 2 + 3, { align: 'center' });
                            }
                        }
                    });

                    // 2. Draw Cuts (Blueish)
                    piece.cuts.forEach((cut: any) => {
                        const cx = 14 + cut.posX * scale;
                        const cy = diagramTopY + cut.posY * scale;
                        const cw = cut.width_mm * scale;
                        const ch = cut.height_mm * scale;

                        doc.setFillColor(230, 240, 255);
                        doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]); // Blue border for cuts
                        doc.setLineWidth(0.3);
                        doc.rect(cx, cy, cw, ch, 'FD'); // Fill and Draw

                        // Text
                        if (cw > 10 && ch > 6) {
                            doc.setTextColor(0, 0, 0);
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(cw > 25 ? 9 : 7);
                            doc.text(`${cut.width_mm}x${cut.height_mm}`, cx + cw / 2, cy + ch / 2 + 1, { align: 'center' });

                            // Client Name & Legacy
                            if (cw > 30 && ch > 12) {
                                doc.setFontSize(6);
                                doc.setFont("helvetica", "normal");
                                const legacy = cut.orders?.legacy_order_number ? ` / L:${cut.orders.legacy_order_number}` : '';
                                doc.text((cut.orders?.client_name?.substring(0, 15) || '') + legacy, cx + cw / 2, cy + ch / 2 + 4, { align: 'center' });
                            }
                        }
                    });

                    // 3. Draw CUT LINES (Red/Bold/Dashed to indicate guillotine)
                    // H-Cuts (Shelf bottoms)
                    doc.setDrawColor(220, 50, 50); // Red
                    doc.setLineWidth(0.2);
                    doc.setLineDashPattern([2, 2], 0); // Dashed

                    shelves.forEach(shelf => {
                        // Line across the whole meaningful width (or full sheet for first cut)
                        // Usually guillotine cuts horizontal first across whole sheet.
                        const y = diagramTopY + (shelf.y + shelf.h) * scale;
                        if (y < diagramTopY + sheetH * scale) { // Don't draw if it's the bottom edge
                            doc.line(14, y, 14 + sheetW * scale, y);
                        }

                        // Vertical cuts (within shelf)
                        let cx = 0;
                        shelf.cuts.forEach((cut: any, idx: number) => {
                            cx = cut.posX + cut.width_mm;
                            // Don't draw if it's the right edge of sheet
                            if (cx < sheetW) {
                                const vx = 14 + cx * scale;
                                const vy_start = diagramTopY + shelf.y * scale;
                                const vy_end = diagramTopY + (shelf.y + shelf.h) * scale;
                                doc.line(vx, vy_start, vx, vy_end);
                            }
                        });
                    });
                    doc.setLineDashPattern([], 0); // Reset dash

                    // -- D. TABLES
                    let tableY = diagramTopY + (sheetH * scale) + 10;

                    // Table 1: Cuts List
                    const cutsData = piece.cuts.map((c: any, i: number) => {
                        const legacy = c.orders?.legacy_order_number ? `(${c.orders.legacy_order_number})` : '';
                        return [
                            i + 1,
                            `${c.width_mm} x ${c.height_mm}`,
                            c.quantity || 1,
                            c.orders?.client_name || '-',
                            `${c.orders?.order_number || '-'} ${legacy}`
                        ];
                    });

                    autoTable(doc, {
                        startY: tableY,
                        head: [['#', 'Medida', 'Cant', 'Cliente', 'Orden']],
                        body: cutsData,
                        theme: 'grid',
                        styles: { fontSize: 8, cellPadding: 2 },
                        headStyles: { fillColor: [50, 50, 50] },
                        columnStyles: { 0: { cellWidth: 10 }, 1: { fontStyle: 'bold' } }
                    });

                    // Table 2: Waste List (wastes from state)
                    // "listar todos los rezago" => users want to see everything?
                    // "dejar decidir al usuario cuales son reutilizables"
                    // We list all wastes that are somewhat significant > 50x50
                    const reportableWastes = wastes.filter((w: any) => w.w > 50 && w.h > 50);

                    if (reportableWastes.length > 0) {
                        const remData = reportableWastes.map((r: any) => [
                            // `R-${i+1}`, // ID removed as per request "No mostrar el id"
                            `${Math.round(r.w)} x ${Math.round(r.h)}`,
                            r.label
                        ]);

                        autoTable(doc, {
                            startY: (doc as any).lastAutoTable.finalY + 8,
                            head: [['Medida', 'Clasificación']], // Removed ID header
                            body: remData,
                            theme: 'striped',
                            styles: { fontSize: 8, cellPadding: 2, textColor: [50, 50, 50] },
                            headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
                            didParseCell: (data) => {
                                if (data.section === 'body' && data.column.index === 1) { // Index 1 is now Classification
                                    if (data.cell.raw === 'REZAGO') { // Simplified label
                                        data.cell.styles.textColor = [22, 163, 74]; // Green
                                        data.cell.styles.fontStyle = 'bold';
                                    } else {
                                        data.cell.styles.textColor = [150, 150, 150]; // Light Grey
                                    }
                                }
                            }
                        });
                    }
                });
            });



            // --- 3. EXCLUDED CUTS PAGE (If any) ---
            if (excludedCuts && excludedCuts.length > 0) {
                doc.addPage();
                doc.setTextColor(220, 38, 38); // Red
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text("Cortes No Optimizados / Faltante de Material", 14, 20);

                doc.setFontSize(10);
                doc.setTextColor(50, 50, 50);
                doc.setFont("helvetica", "normal");
                doc.text("Los siguientes cortes no pudieron ser ubicados en ninguna hoja o rezago disponible debido a su tamaño o falta de stock.", 14, 28);

                const excludedData = excludedCuts.map((c: any) => [
                    `${c.glass_types?.code} - ${c.glass_types?.color}`,
                    `${c.width_mm} x ${c.height_mm}`,
                    c.orders?.client_name || '-',
                    `#${c.orders?.order_number || '-'}`,
                    c.orders?.legacy_order_number || '-'
                ]);

                autoTable(doc, {
                    startY: 35,
                    head: [['Vidrio', 'Medida', 'Cliente', 'Orden', 'Orden Ant.']],
                    body: excludedData,
                    theme: 'grid',
                    styles: { fontSize: 10, cellPadding: 3 },
                    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255] }
                });
            }

            if (action === 'base64') {
                return doc.output('datauristring');
            } else if (action === 'blob') {
                return doc.output('bloburl');
            } else {
                doc.save(`plan-corte-${Date.now()}.pdf`);
            }

        } catch (error) {
            console.error("PDF Generation Error:", error);
            alert("Error generando el PDF. Revisa la consola.");
        }
    };

    const handlePreview = () => {
        const url = generatePDF('blob') as string;
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
                    <p className="text-sm text-slate-500">Combina pedidos para minimizer desperdicio en múltiples tipos de vidrio.</p>
                </div>
                <button
                    onClick={fetchData}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                    Actualizar
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Pending Cuts */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-blue-600" /> Cortes Pendientes
                            </h3>
                            <div className="flex-1"></div>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold mr-2">
                                {pendingCuts.length}
                            </span>
                            <button
                                onClick={selectAllCuts}
                                className="text-xs text-blue-600 hover:underline font-medium"
                            >
                                {selectedCuts.length === pendingCuts.length ? "Deseleccionar" : "Seleccionar Todo"}
                            </button>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 sticky top-0 border-b z-10">
                                    <tr>
                                        <th className="px-4 py-3 w-8"><input type="checkbox" checked={selectedCuts.length > 0 && selectedCuts.length === pendingCuts.length} onChange={selectAllCuts} /></th>
                                        <th className="px-4 py-3">Vidrio</th>
                                        <th className="px-4 py-3">Cliente / Obra</th>
                                        <th className="px-4 py-3">Medidas</th>
                                        <th className="px-4 py-3 text-center">Cant</th>
                                        <th className="px-4 py-3">Fecha</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading && pendingCuts.length === 0 ? (
                                        <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Cargando...</td></tr>
                                    ) : pendingCuts.map(cut => (
                                        <tr
                                            key={cut.id}
                                            className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedCuts.includes(cut.id) ? 'bg-blue-50' : ''}`}
                                            onClick={() => toggleCutSelection(cut.id)}
                                        >
                                            <td className="px-4 py-3">
                                                <input type="checkbox" checked={selectedCuts.includes(cut.id)} readOnly />
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${cut.glass_types?.color?.includes('Incoloro') ? 'bg-slate-100 border-slate-300 text-slate-600' :
                                                    cut.glass_types?.color?.includes('Bronce') ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                                        cut.glass_types?.color?.includes('Gris') ? 'bg-gray-200 border-gray-300 text-gray-700' :
                                                            'bg-blue-50 border-blue-200 text-blue-700'
                                                    }`}>
                                                    {cut.glass_types?.thickness_mm}mm - {cut.glass_types?.color}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                <div className="flex flex-col">
                                                    <span>{cut.orders?.client_name}</span>
                                                    <span className="text-[10px] text-slate-400">
                                                        #{cut.orders?.order_number}
                                                        {cut.orders?.legacy_order_number && <span className="text-slate-500"> (L: {cut.orders.legacy_order_number})</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-slate-600">{cut.width_mm} x {cut.height_mm}</td>
                                            <td className="px-4 py-3 text-center font-bold px-4">{cut.quantity}</td>
                                            <td className="px-4 py-3 text-xs text-slate-400">
                                                {new Date(cut.orders?.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {pendingCuts.length === 0 && !loading && (
                                        <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No hay cortes pendientes.</td></tr>
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
                        <Play className="w-5 h-5" /> {canRun ? 'Calcular Optimización' : 'Sin Permiso para Calcular'}
                    </button>

                    {selectedCuts.length > 0 && (
                        <div className="flex justify-end pt-2">
                            <span className="text-sm text-slate-500">{selectedCuts.length} cortes seleccionados</span>
                        </div>
                    )}
                </div>

                {/* Right: Results Preview */}
                <div className="space-y-6">
                    {/* Results Card */}
                    {optimizationResult && (
                        <div className="bg-white rounded-xl border-2 border-blue-500 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sticky top-6">
                            <div className="p-4 bg-blue-500 text-white flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <h3 className="font-bold">Plan Generado</h3>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePreview}
                                        className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                                    >
                                        <FileText className="w-4 h-4" /> VER PDF
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                                {excludedCuts && excludedCuts.length > 0 && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
                                        <div className="flex items-center gap-2 text-red-700 font-bold text-xs mb-1">
                                            <AlertCircle className="w-4 h-4" />
                                            <span>{excludedCuts.length} Cortes Excluidos</span>
                                        </div>
                                        <p className="text-[10px] text-red-600 mb-2">
                                            Exceden el tamaño del stock disponible.
                                        </p>
                                        <div className="max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                            <ul className="space-y-1">
                                                {excludedCuts.map((c: any, i: number) => (
                                                    <li key={i} className="text-[10px] text-red-600 flex justify-between border-b border-red-100 last:border-0 pb-1">
                                                        <span>{c.glass_types?.code} - {c.glass_types?.color}</span>
                                                        <span className="font-mono">{c.width_mm}x{c.height_mm}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                                <p className="text-xs text-slate-500 italic text-center mb-2">
                                    Se han generado {optimizationResult.length} piezas de corte.
                                </p>
                                {optimizationResult.map((piece: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-2">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${piece.type === 'Rezago' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {piece.type}
                                            </span>
                                            <span className="text-xs font-bold text-slate-700">{piece.glassType.code}</span>
                                        </div>
                                        <div className="text-xs mb-2 text-center text-slate-500">
                                            {piece.dimText}
                                        </div>

                                        <div className="space-y-1">
                                            {piece.cuts.slice(0, 3).map((c: any, cidx: number) => (
                                                <div key={cidx} className="text-xs flex justify-between text-slate-600">
                                                    <span>{c.orders?.client_name.substring(0, 15)}</span>
                                                    <span className="font-mono">{c.width_mm}x{c.height_mm}</span>
                                                </div>
                                            ))}
                                            {piece.cuts.length > 3 && (
                                                <div className="text-[10px] text-center text-slate-400 italic">
                                                    + {piece.cuts.length - 3} cortes más...
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 pt-2 border-t border-dashed border-slate-300 space-y-2">
                                            {piece.wastes.map((waste: any) => (
                                                <div key={waste.id} className="flex flex-col text-[10px]">
                                                    <div className="flex items-center justify-between">
                                                        <span className={`font-bold ${waste.saved ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                            {waste.saved ? 'REZAGO' : 'D'}: {Math.round(waste.w)}x{Math.round(waste.h)}
                                                        </span>
                                                        <input
                                                            type="checkbox"
                                                            checked={waste.saved}
                                                            onChange={(e) => updateRemnantSetting(idx, waste.id, 'saved', e.target.checked)}
                                                            className={`w-3 h-3 rounded ${waste.saved ? 'text-emerald-600' : 'text-slate-300'}`}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            {piece.wastes.length === 0 && (
                                                <p className="text-[10px] text-slate-400 italic text-center">Sin desperdicios utilizables.</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
                                <button
                                    onClick={handleConfirmCuts}
                                    disabled={loading || !canRun}
                                    className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 font-bold shadow-sm transition-all disabled:opacity-50"
                                >
                                    {loading ? "Procesando..." : (canRun ? "Confirmar y Descontar" : "Solo Lectura")}
                                </button>
                                <button
                                    onClick={() => setOptimizationResult(null)}
                                    className="w-full text-slate-500 text-xs py-1 hover:underline text-center"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {!optimizationResult && selectedCuts.length > 0 && (
                        <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 flex gap-3 text-amber-700 animate-pulse">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm">
                                Tienes <b>{selectedCuts.length}</b> cortes seleccionados. Presiona "Calcular".
                            </p>
                        </div>
                    )}
                    {!optimizationResult && selectedCuts.length === 0 && (
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-slate-400">
                            <LayoutGrid className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Selecciona cortes de la lista para comenzar una optimización.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
