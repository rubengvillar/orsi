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
    Truck,
    X,
} from "lucide-react";
import { useStore } from "@nanostores/react";
import { isMobileMenuOpen, closeMobileMenu } from "../../stores/uiStore";
import { userPermissions, userRole } from "../../stores/authStore";
import { PERMISSIONS } from "../../lib/permissions";

interface SidebarProps {
    currentPath: string;
}

interface NavItem {
    label: string;
    href: string;
    icon: any;
    permission?: string;
}

interface NavCategory {
    label: string;
    icon: any;
    items: NavItem[];
}

export default function Sidebar({ currentPath }: SidebarProps) {
    const $permissions = useStore(userPermissions);
    const $role = useStore(userRole);

    const hasPermission = (perm?: string) => {
        if (!perm) return true;
        if ($role === 'Admin' || $role === 'Administrador') return true;
        return $permissions.includes(perm);
    };

    // Categories and Items
    const categories: NavCategory[] = [
        {
            label: "Principal",
            icon: LayoutDashboard,
            items: [
                { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD },
                { label: "Ordenes", href: "/orders", icon: Box, permission: PERMISSIONS.ORDERS_VIEW },
            ]
        },
        {
            label: "Inventario",
            icon: Package,
            items: [
                { label: "Accesorios", href: "/inventory/accessories", icon: Package, permission: PERMISSIONS.INVENTORY_ACCESSORIES_VIEW },
                { label: "Perfiles", href: "/inventory/profiles", icon: Package, permission: PERMISSIONS.INVENTORY_PROFILES_VIEW },
                { label: "Vidrios", href: "/inventory/glass", icon: Package, permission: PERMISSIONS.INVENTORY_GLASS_VIEW },
                { label: "Insumos Vidrio", href: "/inventory/glass-accessories", icon: Package, permission: PERMISSIONS.INVENTORY_GLASS_ACCESSORIES_VIEW },
            ]
        },
        {
            label: "Cortes",
            icon: Scissors,
            items: [
                { label: "Optimizar Cortes", href: "/inventory/optimizer", icon: Scissors, permission: PERMISSIONS.OPTIMIZER_VIEW },
                { label: "Plan de Cortes", href: "/inventory/cuts", icon: Scissors, permission: PERMISSIONS.CUTS_VIEW },
            ]
        },
        {
            label: "Administración",
            icon: Shield,
            items: [
                { label: "Cuentas de Usuario", href: "/admin/users", icon: Users, permission: PERMISSIONS.ADMIN_USERS_VIEW },
                { label: "Operarios", href: "/admin/operators", icon: Users, permission: PERMISSIONS.ADMIN_OPERATORS_VIEW },
                { label: "Roles", href: "/admin/roles", icon: Shield, permission: PERMISSIONS.ADMIN_ROLES_VIEW },
                { label: "Permisos", href: "/admin/permissions", icon: Shield, permission: PERMISSIONS.ADMIN_PERMISSIONS_VIEW },
                { label: "Estados de Orden", href: "/admin/order-statuses", icon: Box, permission: PERMISSIONS.ADMIN_ORDER_STATUSES_VIEW },
                { label: "Vehículos", href: "/admin/vehicles", icon: Truck, permission: PERMISSIONS.ADMIN_VEHICLES_VIEW },
                { label: "Auditoría", href: "/admin/audit", icon: FileText, permission: PERMISSIONS.ADMIN_AUDIT_VIEW },
            ]
        }
    ];

    // Filter categories and items
    const filteredCategories = categories.map(cat => ({
        ...cat,
        items: cat.items.filter(item => hasPermission(item.permission))
    })).filter(cat => cat.items.length > 0);

    // State to track expanded categories
    // Initialize with all expanded or only the one containing the current path
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        const initialState: Record<string, boolean> = {};
        filteredCategories.forEach(cat => {
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
                        {filteredCategories.map((category) => {
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
