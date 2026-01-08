import React, { useState } from "react";
import {
    LayoutDashboard,
    Package,
    Shield,
    Users,
    Box,
    Scissors,
    ChevronDown,
    Settings,
    FileText,
    X,
} from "lucide-react";
import { useStore } from "@nanostores/react";
import { isMobileMenuOpen, closeMobileMenu } from "../../stores/uiStore";

interface SidebarProps {
    currentPath: string;
}

interface NavItem {
    label: string;
    href: string;
    icon: any;
}

interface NavCategory {
    label: string;
    icon: any;
    items: NavItem[];
}

export default function Sidebar({ currentPath }: SidebarProps) {
    // Categories and Items
    const categories: NavCategory[] = [
        {
            label: "Principal",
            icon: LayoutDashboard,
            items: [
                { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                { label: "Ordenes", href: "/orders", icon: Box },
            ]
        },
        {
            label: "Inventario",
            icon: Package,
            items: [
                { label: "Accesorios", href: "/inventory/accessories", icon: Package },
                { label: "Perfiles", href: "/inventory/profiles", icon: Package },
                { label: "Vidrios", href: "/inventory/glass", icon: Package },
                { label: "Insumos Vidrio", href: "/inventory/glass-accessories", icon: Package },
            ]
        },
        {
            label: "Cortes",
            icon: Scissors,
            items: [
                { label: "Optimizar Cortes", href: "/inventory/optimizer", icon: Scissors },
                { label: "Plan de Cortes", href: "/inventory/cuts", icon: Scissors },
            ]
        },
        {
            label: "Administración",
            icon: Shield,
            items: [
                { label: "Cuentas de Usuario", href: "/admin/users", icon: Users },
                { label: "Operarios", href: "/admin/operators", icon: Users },
                { label: "Roles", href: "/admin/roles", icon: Shield },
                { label: "Permisos", href: "/admin/permissions", icon: Shield },
                { label: "Auditoría", href: "/admin/audit", icon: FileText },
            ]
        }
    ];

    // State to track expanded categories
    // Initialize with all expanded or only the one containing the current path
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        const initialState: Record<string, boolean> = {};
        categories.forEach(cat => {
            const hasActiveItem = cat.items.some(item => currentPath.startsWith(item.href));
            initialState[cat.label] = hasActiveItem || cat.label === "Principal";
        });
        return initialState;
    });

    const toggleCategory = (label: string) => {
        setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const $isOpen = useStore(isMobileMenuOpen);

    return (
        <>
            {/* Backdrop for mobile */}
            {$isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
                    onClick={closeMobileMenu}
                />
            )}

            <div className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 transform transition-transform duration-300 ease-in-out flex flex-col h-full
                md:relative md:translate-x-0 md:w-64
                ${$isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Box className="w-5 h-5 text-white" />
                        </div>
                        <span>Orsi <span className="text-blue-400">Stock</span></span>
                    </h1>
                    <button
                        onClick={closeMobileMenu}
                        className="p-2 -mr-2 text-slate-400 hover:text-white md:hidden transition-colors rounded-lg hover:bg-slate-800"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700">
                    <div className="px-3 space-y-2">
                        {categories.map((category) => {
                            const isExpanded = expanded[category.label];
                            const hasActiveItem = category.items.some(item => currentPath.startsWith(item.href));

                            return (
                                <div key={category.label} className="space-y-1">
                                    <button
                                        onClick={() => toggleCategory(category.label)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all
                                        ${hasActiveItem ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <category.icon className="w-4 h-4" />
                                            <span className="text-xs uppercase tracking-wider font-bold">{category.label}</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>

                                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <ul className="pl-4 mt-1 space-y-1 border-l border-slate-700/50 ml-5">
                                            {category.items.map((item) => {
                                                const isActive = currentPath === item.href || currentPath.startsWith(item.href + "/");
                                                return (
                                                    <li key={item.href}>
                                                        <a
                                                            href={item.href}
                                                            onClick={() => closeMobileMenu()}
                                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                                                            ${isActive
                                                                    ? 'bg-blue-600/10 text-blue-400 font-semibold'
                                                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                                        >
                                                            <item.icon className="w-4 h-4" />
                                                            <span>{item.label}</span>
                                                        </a>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-700/50">
                    <a
                        href="/dashboard"
                        className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all group"
                    >
                        <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                        <div className="flex flex-col">
                            <span className="text-sm font-bold">Configuración</span>
                            <span className="text-[10px] opacity-50">v0.0.1 ALPHA</span>
                        </div>
                    </a>
                </div>
            </div>
        </>
    );
}
