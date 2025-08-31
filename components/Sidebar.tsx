import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store';
import { ViewType } from '../types';
import { 
    DashboardIcon, TodoListIcon, WarMapIcon, UsersIcon, KnowledgeIcon, 
    BookmarksIcon, MoneyboxIcon, CurrencyIcon, PasswordIcon, SettingsIcon, 
    LogOutIcon, BrainIcon 
} from './Icons';

const Sidebar: React.FC<{ onLogout: () => void; }> = ({ onLogout }) => {
    const { currentView, isSidebarOpen, setCurrentView, setSidebarOpen } = useAppStore();
    
    const menuItems: { id: ViewType; label: string; icon: React.FC<any>; }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
        { id: 'todolist', label: 'Task Master', icon: TodoListIcon },
        { id: 'war_planner', label: 'War Planner', icon: WarMapIcon },
        { id: 'crm', label: 'CRM', icon: UsersIcon },
        { id: 'knowledge', label: 'Knowledge Base', icon: KnowledgeIcon },
        { id: 'bookmarks', label: 'Bookmarks', icon: BookmarksIcon },
        { id: 'moneybox', label: 'Moneybox', icon: MoneyboxIcon },
        { id: 'valuta', label: 'Valuta', icon: CurrencyIcon },
        { id: 'passwords', label: 'Passwords', icon: PasswordIcon },
    ];

    const handleNavigate = (view: ViewType) => {
        setCurrentView(view);
        setSidebarOpen(false);
    };
    
    return (
        <>
            <div 
                className={`fixed inset-0 bg-black/30 z-30 lg:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={() => setSidebarOpen(false)}
            ></div>
            <nav className={`fixed lg:relative z-40 w-64 h-full bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="h-[var(--topbar-h)] flex-shrink-0 flex items-center px-4 border-b border-slate-200">
                     <BrainIcon className="w-8 h-8 text-indigo-600" />
                     <h1 className="ml-2 text-xl font-bold text-slate-800 tracking-tight">Brain Damage</h1>
                </div>
                <div className="flex-grow p-3 space-y-1 overflow-y-auto">
                     {menuItems.map(item => (
                        <SidebarItem
                            key={item.id}
                            icon={<item.icon className="w-6 h-6" />}
                            label={item.label}
                            isActive={currentView === item.id}
                            onClick={() => handleNavigate(item.id)}
                        />
                    ))}
                </div>
                <div className="p-3 border-t border-slate-200">
                    <SidebarItem icon={<SettingsIcon className="w-6 h-6" />} label="Settings" isActive={currentView === 'settings'} onClick={() => handleNavigate('settings')} />
                    <SidebarItem icon={<LogOutIcon className="w-6 h-6" />} label="Logout" onClick={onLogout} />
                </div>
            </nav>
        </>
    );
};

const SidebarItem: React.FC<{ label: string; icon: React.ReactNode; isActive?: boolean; onClick: () => void; }> = ({ label, icon, isActive = false, onClick }) => (
    <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`flex items-center w-full px-3 py-2.5 text-base font-semibold rounded-lg text-left gap-3 transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
    >
        {icon}
        <span className="truncate">{label}</span>
    </motion.button>
);

export default Sidebar;