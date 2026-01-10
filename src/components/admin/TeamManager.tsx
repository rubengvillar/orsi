import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Team, TeamMember } from '../../types/database';
import { Modal } from '../ui/Modal';
import { Users, Plus, Edit2, Trash2, Check, X } from 'lucide-react';

export default function TeamManager() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [operators, setOperators] = useState<any[]>([]);

    // Editor State
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [formData, setFormData] = useState({ name: '', color: '#3b82f6' });
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    useEffect(() => {
        fetchTeams();
        fetchOperators();
    }, []);

    const fetchTeams = async () => {
        setLoading(true);
        // Fetch teams with members count?
        const { data } = await supabase.from('teams').select('*, team_members(count)').order('created_at');
        setTeams(data || []);
        setLoading(false);
    };

    const fetchOperators = async () => {
        const { data } = await supabase.from('operators').select('*').eq('is_active', true);
        setOperators(data || []);
    };

    const handleOpenModal = async (team?: Team) => {
        if (team) {
            setEditingTeam(team);
            setFormData({ name: team.name, color: team.color });

            // Fetch members
            const { data } = await supabase.from('team_members').select('*, operator:operators(*)').eq('team_id', team.id);
            setTeamMembers(data || []);
        } else {
            setEditingTeam(null);
            setFormData({ name: '', color: '#3b82f6' });
            setTeamMembers([]);
        }
        setIsModalOpen(true);
    };

    const handleSaveTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingTeam) {
                const { error } = await supabase.from('teams').update(formData).eq('id', editingTeam.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('teams').insert(formData);
                if (error) throw error;
            }
            setIsModalOpen(false);
            fetchTeams();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    // Member Management
    const handleAddMember = async (operatorId: string) => {
        if (!editingTeam) return;
        const { error } = await supabase.from('team_members').insert({
            team_id: editingTeam.id,
            operator_id: operatorId
        });
        if (error) alert('Error adding member: ' + error.message);
        else {
            const { data } = await supabase.from('team_members').select('*, operator:operators(*)').eq('team_id', editingTeam.id);
            setTeamMembers(data || []);
            fetchTeams();
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        const { error } = await supabase.from('team_members').delete().eq('id', memberId);
        if (error) alert('Error removing member: ' + error.message);
        else {
            setTeamMembers(teamMembers.filter(m => m.id !== memberId));
            fetchTeams();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Users className="w-6 h-6 text-slate-600" />
                    Equipos de Trabajo
                </h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Equipo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map(team => (
                    <div key={team.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: team.color }}>
                                    {team.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 leading-tight">{team.name}</h3>
                                    <p className="text-xs text-slate-500">{(team as any).team_members?.[0]?.count || 0} Miembros</p>
                                </div>
                            </div>
                            <button onClick={() => handleOpenModal(team)} className="text-slate-400 hover:text-blue-600">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTeam ? 'Editar Equipo' : 'Nuevo Equipo'}>
                <div className="space-y-6">
                    <form onSubmit={handleSaveTeam} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Equipo</label>
                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Color Identificativo</label>
                            <div className="flex gap-2">
                                {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map(c => (
                                    <button
                                        type="button"
                                        key={c}
                                        onClick={() => setFormData({ ...formData, color: c })}
                                        className={`w-8 h-8 rounded-full border-2 ${formData.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end">
                            {!editingTeam && <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Crear</button>}
                            {editingTeam && <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Guardar Cambios</button>}
                        </div>
                    </form>

                    {editingTeam && (
                        <div className="border-t pt-4">
                            <h4 className="font-bold text-sm text-slate-700 mb-2">Miembros del Equipo</h4>
                            <div className="space-y-2 mb-4">
                                {teamMembers.map(m => (
                                    <div key={m.id} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                                        <span className="text-sm font-medium">{m.operator?.full_name}</span>
                                        <button onClick={() => handleRemoveMember(m.id)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                {teamMembers.length === 0 && <div className="text-xs text-slate-400 italic">Sin miembros asignados.</div>}
                            </div>

                            <div className="flex gap-2">
                                <select
                                    className="flex-1 border rounded px-2 py-1 text-sm query-operator-select"
                                    id="add-member-select"
                                >
                                    <option value="">Agregar Operario...</option>
                                    {operators.filter(op => !teamMembers.some(m => m.operator_id === op.id)).map(op => (
                                        <option key={op.id} value={op.id}>{op.full_name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => {
                                        const select = document.getElementById('add-member-select') as HTMLSelectElement;
                                        if (select.value) {
                                            handleAddMember(select.value);
                                            select.value = '';
                                        }
                                    }}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded text-sm"
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
