import { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Camera, Save, X, Trash2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProofOfDeliveryProps {
    stop: any;
    onSave: (data: any) => Promise<void>;
    onClose: () => void;
}

export default function ProofOfDelivery({ stop, onSave, onClose }: ProofOfDeliveryProps) {
    const [tab, setTab] = useState<'photos' | 'signature'>('photos');
    const [photosBefore, setPhotosBefore] = useState<any[]>(stop.photos_before || []);
    const [photosAfter, setPhotosAfter] = useState<any[]>(stop.photos_after || []);
    const [signature, setSignature] = useState<string | null>(stop.signature_data || null);
    const [signedBy, setSignedBy] = useState(stop.signed_by_name || '');
    const sigPad = useRef<any>(null);
    const [saving, setSaving] = useState(false);

    // Mock Upload for now -- In real prod, upload to storage bucket
    // Here we'll just read into Base64 for simplicity if small, or pretend URL
    // For this prototype, let's use data URLs so it works immediately without bucket config
    const handleFileSelect = async (e: any, type: 'before' | 'after') => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const newItem = {
                url: ev.target?.result as string,
                timestamp: new Date().toISOString()
            };
            if (type === 'before') setPhotosBefore([...photosBefore, newItem]);
            else setPhotosAfter([...photosAfter, newItem]);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({
                photos_before: photosBefore,
                photos_after: photosAfter,
                signature_data: signature,
                signed_by_name: signedBy,
                signed_at: signature ? (stop.signed_at || new Date().toISOString()) : null
            });
            onClose();
        } catch (err) {
            console.error(err);
            alert('Error saving proof');
        } finally {
            setSaving(false);
        }
    };

    const clearSignature = () => {
        sigPad.current?.clear();
        setSignature(null);
    };

    const saveSignature = () => {
        if (sigPad.current) {
            setSignature(sigPad.current.getTrimmedCanvas().toDataURL('image/png'));
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-bold text-lg">Comprobante de Entrega</h3>
                        <p className="text-xs text-slate-500">{stop.order.client_name} - {stop.arrival_time}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-2 flex gap-2 border-b bg-white">
                    <button
                        onClick={() => setTab('photos')}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'photos' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Fotos
                    </button>
                    <button
                        onClick={() => setTab('signature')}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'signature' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Firma
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {tab === 'photos' && (
                        <div className="space-y-6">
                            {/* Photos Before */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <Camera className="w-4 h-4" /> Antes (Llegada)
                                </h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {photosBefore.map((p, idx) => (
                                        <div key={idx} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden group">
                                            <img src={p.url} className="w-full h-full object-cover" />
                                            <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[10px] p-1 truncate">
                                                {new Date(p.timestamp).toLocaleTimeString()}
                                            </div>
                                            <button
                                                onClick={() => setPhotosBefore(photosBefore.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                        <Plus className="w-6 h-6 text-slate-400" />
                                        <span className="text-[10px] text-slate-400 mt-1">Agregar</span>
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileSelect(e, 'before')} />
                                    </label>
                                </div>
                            </div>

                            {/* Photos After */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4" /> Después (Terminado)
                                </h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {photosAfter.map((p, idx) => (
                                        <div key={idx} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden group">
                                            <img src={p.url} className="w-full h-full object-cover" />
                                            <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[10px] p-1 truncate">
                                                {new Date(p.timestamp).toLocaleTimeString()}
                                            </div>
                                            <button
                                                onClick={() => setPhotosAfter(photosAfter.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                        <Plus className="w-6 h-6 text-slate-400" />
                                        <span className="text-[10px] text-slate-400 mt-1">Agregar</span>
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileSelect(e, 'after')} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'signature' && (
                        <div className="flex flex-col h-full">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Firma del Cliente</label>

                            {signature ? (
                                <div className="flex-1 bg-white border border-slate-200 rounded-lg flex items-center justify-center relative bg-slate-50">
                                    <img src={signature} alt="Firma" className="max-h-40" />
                                    <button
                                        onClick={clearSignature}
                                        className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="border border-slate-300 rounded-lg bg-white touch-none">
                                    <SignatureCanvas
                                        ref={sigPad}
                                        penColor="black"
                                        canvasProps={{ className: 'signature-canvas w-full h-48' }}
                                        onEnd={saveSignature}
                                    />
                                </div>
                            )}

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Aclaración / Nombre</label>
                                <input
                                    type="text"
                                    value={signedBy}
                                    onChange={(e) => setSignedBy(e.target.value)}
                                    placeholder="Nombre de quien recibe..."
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                />
                            </div>
                            <div className="mt-2 text-xs text-slate-400 text-center">
                                Usa el dedo o mouse para firmar en el recuadro.
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Confirmar y Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Simple usage of Plus icon
function Plus({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
    )
}
