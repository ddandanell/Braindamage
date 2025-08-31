

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { User, updateProfile, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { ViewType, KBFolder, KBNote, BookmarkFolder, Bookmark, StickyNote } from '../types';
import { 
    TodoListIcon, KnowledgeIcon, BookmarksIcon, LogOutIcon, 
    DashboardIcon, PasswordIcon, WarMapIcon, SettingsIcon, UsersIcon, CurrencyIcon,
    BrainIcon, MoneyboxIcon, FolderIcon, PlusIcon, EditIcon, TrashIcon,
    ChevronDownIcon, ChevronRightIcon, DocumentTextIcon, BoldIcon, ItalicIcon,
    UnderlineIcon, ListUlIcon, ListOlIcon, CodeIcon, QuoteIcon, XIcon, ExternalLinkIcon, StickyNoteIcon
} from './Icons';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, where, writeBatch, runTransaction, getDocs, getDoc } from 'firebase/firestore';

import Header from './Header';
import TaskMaster from './TaskMaster';
// fix: Changed to default import for WarPlanner as it will be default exported.
import WarPlanner from './WarPlanner';
import CRM from './CRM';


// #region VALUTA
const ValutaConverter: React.FC = () => {
    const [idrAmount, setIdrAmount] = useState<string>('2000000');
    const [rates, setRates] = useState<{ USD: number; EUR: number; DKK: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('https://api.exchangerate-api.com/v4/latest/IDR')
            .then(res => res.json())
            .then(data => {
                if (data.rates) {
                    setRates({
                        USD: data.rates.USD,
                        EUR: data.rates.EUR,
                        DKK: data.rates.DKK,
                    });
                } else {
                    setError('Could not fetch exchange rates.');
                }
            })
            .catch(() => setError('Failed to connect to the exchange rate service.'));
    }, []);

    const numericAmount = useMemo(() => parseFloat(idrAmount.replace(/,/g, '')) || 0, [idrAmount]);

    const formattedAmount = useMemo(() => {
        if (idrAmount === '') return '';
        return numericAmount.toLocaleString('en-US');
    }, [numericAmount, idrAmount]);

    const converted = useMemo(() => {
        if (!rates) return { usd: 0, eur: 0, dkk: 0 };
        return {
            usd: numericAmount * rates.USD,
            eur: numericAmount * rates.EUR,
            dkk: numericAmount * rates.DKK,
        };
    }, [numericAmount, rates]);

    return (
        <div>
            <Header title="Live Currency" subtitle="Live currency conversion from IDR." />
            {error && <p className="text-red-500 bg-red-100 p-3 rounded-lg mb-4">{error}</p>}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-2xl mx-auto">
                <div className="space-y-6">
                    <div>
                        <label htmlFor="idr-input" className="block text-sm font-medium text-slate-700 mb-1">Indonesian Rupiah (IDR)</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500">Rp</span>
                            <input
                                id="idr-input"
                                type="text"
                                value={formattedAmount}
                                onChange={e => setIdrAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="2,000,000"
                                className="w-full h-14 pl-10 pr-4 text-2xl font-semibold border border-slate-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <CurrencyDisplay currency="USD" value={converted.usd} />
                        <CurrencyDisplay currency="EUR" value={converted.eur} />
                        <CurrencyDisplay currency="DKK" value={converted.dkk} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const CurrencyDisplay: React.FC<{ currency: string, value: number }> = ({ currency, value }) => (
    <div className="bg-slate-100 p-4 rounded-xl">
        <p className="text-sm font-medium text-slate-500">{currency}</p>
        <p className="text-2xl font-bold text-indigo-700 mt-1">
            {value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
    </div>
);
// #endregion VALUTA


// #region Settings
const Settings: React.FC<{ user: User }> = ({ user }) => {
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [newEmail, setNewEmail] = useState(user.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const showFeedback = (type: 'success' | 'error', message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 5000);
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateProfile(user, { displayName });
            showFeedback('success', 'Display name updated successfully!');
        } catch (error: any) {
            showFeedback('error', `Error updating profile: ${error.message}`);
        }
    };
    
    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user.email) return;
        
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        try {
            await reauthenticateWithCredential(user, credential);
            await updateEmail(user, newEmail);
            showFeedback('success', 'Email updated successfully!');
            setCurrentPassword('');
        } catch (error: any) {
            showFeedback('error', `Error updating email: ${error.message}`);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user.email) return;

        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        try {
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            showFeedback('success', 'Password updated successfully!');
            setCurrentPassword('');
            setNewPassword('');
        } catch (error: any) {
            showFeedback('error', `Error updating password: ${error.message}`);
        }
    };

    // fix: The Settings component was not returning any JSX, causing a type error. Added a full UI for managing user settings.
    return (
        <div>
            <Header title="Settings" subtitle="Manage your account details." />
            {feedback && (
                <div className={`p-4 mb-4 text-sm rounded-lg ${feedback.type === 'success' ? 'text-green-800 bg-green-100' : 'text-red-800 bg-red-100'}`}>
                    {feedback.message}
                </div>
            )}
            <div className="space-y-8">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label htmlFor="displayName" className="block text-sm font-medium text-slate-700">Display Name</label>
                            <input
                                id="displayName"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="mt-1 block w-full h-11 px-4 text-slate-900 placeholder-slate-500 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="h-10 px-5 text-base font-semibold text-white transition-colors bg-indigo-600 border border-transparent rounded-xl hover:bg-indigo-700">Save Profile</button>
                        </div>
                    </form>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">Update Email</h3>
                    <form onSubmit={handleUpdateEmail} className="space-y-4">
                        <div>
                            <label htmlFor="newEmail" className="block text-sm font-medium text-slate-700">New Email</label>
                            <input
                                id="newEmail"
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="mt-1 block w-full h-11 px-4 text-slate-900 placeholder-slate-500 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="currentPasswordForEmail" className="block text-sm font-medium text-slate-700">Current Password</label>
                            <input
                                id="currentPasswordForEmail"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="mt-1 block w-full h-11 px-4 text-slate-900 placeholder-slate-500 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                placeholder="Required to change email"
                            />
                        </div>
                         <div className="flex justify-end">
                            <button type="submit" className="h-10 px-5 text-base font-semibold text-white transition-colors bg-indigo-600 border border-transparent rounded-xl hover:bg-indigo-700">Update Email</button>
                        </div>
                    </form>
                </div>
                
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">Change Password</h3>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div>
                            <label htmlFor="currentPasswordForPassword" className="block text-sm font-medium text-slate-700">Current Password</label>
                             <input
                                id="currentPasswordForPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="mt-1 block w-full h-11 px-4 text-slate-900 placeholder-slate-500 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                placeholder="Required to change password"
                            />
                        </div>
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">New Password</label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 block w-full h-11 px-4 text-slate-900 placeholder-slate-500 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="h-10 px-5 text-base font-semibold text-white transition-colors bg-indigo-600 border border-transparent rounded-xl hover:bg-indigo-700">Change Password</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
// #endregion Settings


// #region KNOWLEDGE BASE
// ... (omitted for brevity)
// #endregion KNOWLEDGE BASE


// #region BOOKMARKS
// ... (omitted for brevity)
// #endregion BOOKMARKS

// #region STICKY NOTES
// ... (omitted for brevity)
// #endregion STICKY NOTES


const Dashboard: React.FC<{ user: User; onLogout: () => void; }> = ({ user, onLogout }) => {
    const [currentView, setCurrentView] = useState<ViewType>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const views: { [key in ViewType]: React.ReactNode } = {
        'dashboard': <DashboardHome onNavigate={setCurrentView} />,
        'passwords': <div>Passwords View</div>,
        'todolist': <TaskMaster user={user} onExit={() => setCurrentView('dashboard')} onLogout={onLogout} />,
        'knowledge': <div>Knowledge Base</div>,
        'bookmarks': <div>Bookmarks View</div>,
        'war_planner': <WarPlanner user={user} onExit={() => setCurrentView('dashboard')} />,
        'settings': <Settings user={user} />,
        'valuta': <ValutaConverter />,
        'crm': <CRM user={user} />,
        'moneybox': <div>Moneybox View</div>,
    };

    const mainContent = useMemo(() => views[currentView], [currentView, user, onLogout]);

    if (currentView === 'todolist' || currentView === 'war_planner') {
        return mainContent;
    }

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <Sidebar 
                currentView={currentView}
                onNavigate={setCurrentView}
                onLogout={onLogout}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            <div className="flex-1 flex flex-col">
                <header className="h-[var(--topbar-h)] bg-slate-50/80 backdrop-blur-lg flex items-center justify-between px-4 sm:px-6 border-b border-slate-200">
                     <button onClick={() => setIsSidebarOpen(true)} className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/60 lg:hidden">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div/>
                    <button onClick={onLogout} className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/60" title="Log Out">
                        <LogOutIcon className="w-6 h-6"/>
                    </button>
                </header>
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {mainContent}
                </main>
            </div>
        </div>
    );
};


const Sidebar: React.FC<{
    currentView: ViewType;
    onNavigate: (view: ViewType) => void;
    onLogout: () => void;
    isOpen: boolean;
    onClose: () => void;
}> = ({ currentView, onNavigate, onLogout, isOpen, onClose }) => {
    
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
    
    return (
        <>
            <div className={`fixed inset-0 bg-black/30 z-30 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
            <nav className={`fixed lg:relative z-40 w-64 h-full bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
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
                            onClick={() => { onNavigate(item.id); onClose(); }}
                        />
                    ))}
                </div>
                <div className="p-3 border-t border-slate-200">
                    <SidebarItem icon={<SettingsIcon className="w-6 h-6" />} label="Settings" isActive={currentView === 'settings'} onClick={() => { onNavigate('settings'); onClose(); }} />
                    <SidebarItem icon={<LogOutIcon className="w-6 h-6" />} label="Logout" onClick={onLogout} />
                </div>
            </nav>
        </>
    );
};

const SidebarItem: React.FC<{ label: string; icon: React.ReactNode; isActive?: boolean; onClick: () => void; }> = ({ label, icon, isActive = false, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center w-full px-3 py-2.5 text-base font-semibold rounded-lg text-left gap-3 transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
    >
        <span className="flex-shrink-0 w-6 h-6">{icon}</span>
        <span className="truncate flex-1">{label}</span>
    </button>
);

const DashboardHome: React.FC<{ onNavigate: (view: ViewType) => void; }> = ({ onNavigate }) => (
    <div>
        <Header title="Dashboard" subtitle="Welcome back! Here's your overview." />
        {/* ... More dashboard widgets can be added here ... */}
    </div>
);

// fix: Added default export for Dashboard component to be used in App.tsx
export default Dashboard;
