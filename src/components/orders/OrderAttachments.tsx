import React, { useState, useEffect } from "react";
import { FileText, Image as ImageIcon, Trash2, Upload, Download, X, Paperclip } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Attachment {
    id: string;
    file_name: string;
    file_path: string;
    file_type: string;
    file_size: number;
    created_at: string;
    uploaded_by: string;
}

import { useStore } from "@nanostores/react";
import { userPermissions, userRole } from "../../stores/authStore";
import { PERMISSIONS } from "../../lib/permissions";

interface OrderAttachmentsProps {
    orderId: string;
}

export default function OrderAttachments({ orderId }: OrderAttachmentsProps) {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const $permissions = useStore(userPermissions);
    const $role = useStore(userRole);

    const hasPermission = (perm: string) => {
        if ($role === 'Admin' || $role === 'Administrador') return true;
        return $permissions.includes(perm);
    };

    const canView = hasPermission(PERMISSIONS.ORDERS_ATTACHMENTS_VIEW);
    const canUpload = hasPermission(PERMISSIONS.ORDERS_ATTACHMENTS_UPLOAD);
    const canDelete = hasPermission(PERMISSIONS.ORDERS_ATTACHMENTS_DELETE);

    useEffect(() => {
        fetchAttachments();
    }, [orderId]);

    const fetchAttachments = async () => {
        try {
            const { data, error } = await supabase
                .from("order_attachments")
                .select("*")
                .eq("order_id", orderId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setAttachments(data || []);
        } catch (err: any) {
            console.error("Error fetching attachments:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const file = files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${orderId}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = fileName;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from("order_attachments")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Save Metadata to DB
            const { error: dbError } = await supabase
                .from("order_attachments")
                .insert({
                    order_id: orderId,
                    file_name: file.name,
                    file_path: filePath,
                    file_type: file.type,
                    file_size: file.size
                });

            if (dbError) throw dbError;

            fetchAttachments();
        } catch (err: any) {
            alert("Error uploading file: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (attachment: Attachment) => {
        if (!canDelete) return;
        if (!confirm("¿Estás seguro de eliminar este archivo?")) return;

        try {
            // 1. Delete from Storage
            const { error: storageError } = await supabase.storage
                .from("order_attachments")
                .remove([attachment.file_path]);

            if (storageError) {
                console.error("Storage delete error:", storageError);
                // Continue to delete db record anyway for consistency if file is gone or specific error
            }

            // 2. Delete from DB
            const { error: dbError } = await supabase
                .from("order_attachments")
                .delete()
                .eq("id", attachment.id);

            if (dbError) throw dbError;

            setAttachments(attachments.filter(a => a.id !== attachment.id));
        } catch (err: any) {
            alert("Error deleting file: " + err.message);
        }
    };

    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-purple-500" />;
        if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
        return <FileText className="w-5 h-5 text-slate-400" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files);
        }
    };

    const getSignedUrl = async (path: string) => {
        const { data } = await supabase.storage.from('order_attachments').createSignedUrl(path, 60 * 60); // 1 hour
        if (data?.signedUrl) {
            window.open(data.signedUrl, '_blank');
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" /> Adjuntos
                </h3>
                <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200">
                    {attachments.length}
                </span>
            </div>

            <div className="p-4">
                {/* Custom Upload Area */}
                <div
                    className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors
                        ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        accept="image/*,.pdf"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        disabled={uploading}
                    />

                    {uploading ? (
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm font-medium">Subiendo...</span>
                        </div>
                    ) : (
                        <>
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                <Upload className="w-5 h-5 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-700">Explorar o arrastrar archivo</p>
                            <p className="text-xs text-slate-400 mt-1">Soporta Imágenes y PDF</p>
                        </>
                    )}
                </div>

                {/* File List */}
                {loading ? (
                    <div className="text-center py-4 text-slate-400 text-sm">Cargando adjuntos...</div>
                ) : attachments.length > 0 ? (
                    <div className="mt-4 space-y-2">
                        {attachments.map((file) => (
                            <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg group hover:border-blue-300 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                                        {getFileIcon(file.file_type)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-700 truncate">{file.file_name}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <span>{formatFileSize(file.file_size)}</span>
                                            <span>•</span>
                                            <span>{new Date(file.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white pl-2">
                                    <button
                                        onClick={() => getSignedUrl(file.file_path)}
                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                        title="Descargar/Ver"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(file)}
                                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-4 text-center py-4 rounded-lg border border-slate-100 bg-slate-50/50">
                        <p className="text-slate-400 text-sm italic">No hay archivos adjuntos</p>
                    </div>
                )}
            </div>
        </div>
    );
}
