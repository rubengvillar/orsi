import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, FileText, Calendar, User } from 'lucide-react';
import type { CarpentryProject } from '../../types/database';
import { Modal } from '../ui/Modal';

export default function ProjectList() {
    const [projects, setProjects] = useState<CarpentryProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newProject, setNewProject] = useState<Partial<CarpentryProject>>({ status: 'draft' });

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('carpentry_projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching projects:', error);
        else setProjects(data || []);
        setLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const maxNum = projects.length > 0 ? Math.max(...projects.map(p => p.project_number)) : 0;

        const { data, error } = await supabase
            .from('carpentry_projects')
            .insert([{ ...newProject, project_number: maxNum + 1 }])
            .select() // Select to get the ID for redirection
            .single();

        if (error) {
            alert('Error al crear proyecto');
        } else {
            setIsCreateModalOpen(false);
            // Redirect to detail
            window.location.href = `/carpentry/projects/${data.id}`;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar proyectos..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Proyecto
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Cargando proyectos...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <a
                            key={project.id}
                            href={`/carpentry/projects/${project.id}`}
                            className="block bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${project.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                                        project.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                            'bg-blue-100 text-blue-700'
                                    }`}>
                                    {project.status.toUpperCase()}
                                </span>
                            </div>
                            <h3 className="font-bold text-lg text-slate-800 mb-1">{project.name}</h3>
                            <p className="text-sm text-slate-500 mb-4">#{project.project_number.toString().padStart(4, '0')}</p>

                            <div className="space-y-2 text-sm text-slate-600">
                                {project.client_name && (
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-slate-400" />
                                        <span>{project.client_name}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </a>
                    ))}
                    {projects.length === 0 && (
                        <div className="col-span-full text-center py-12 lg:py-24 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                            <p className="text-slate-500">No hay proyectos creados aún.</p>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Nuevo Proyecto"
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Proyecto *</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ej: Residencia Gómez"
                            value={newProject.name || ''}
                            onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Nombre del cliente"
                            value={newProject.client_name || ''}
                            onChange={e => setNewProject({ ...newProject, client_name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dirección (Obra)</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={newProject.client_address || ''}
                            onChange={e => setNewProject({ ...newProject, client_address: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Crear Proyecto
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
