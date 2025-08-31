import React from 'react';
// fix: Import 'Transition' type from framer-motion to resolve type error.
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useAppStore } from '../store';
import { LogOutIcon } from './Icons';

import Sidebar from './Sidebar';
import DashboardHome from './DashboardHome';
import Settings from './Settings';
import TaskMaster from './TaskMaster';
import WarPlanner from './WarPlanner';
import CRM from './CRM';
import KnowledgeBase from './KnowledgeBase';

const ValutaConverter: React.FC = () => <div>Valuta View</div>;
const Bookmarks: React.FC = () => <div>Bookmarks View</div>;

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 },
};

// fix: Explicitly type 'pageTransition' with the 'Transition' type from framer-motion.
const pageTransition: Transition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.4,
};

const Dashboard: React.FC<{ onLogout: () => void; }> = ({ onLogout }) => {
    const { currentView, isSidebarOpen, setSidebarOpen, user, initialNoteToOpen, navigateToNote } = useAppStore();

    if (!user) return null;

    // fix: Pass required props to KnowledgeBase component.
    const views: { [key in string]: React.ReactNode } = {
        'dashboard': <DashboardHome />,
        'passwords': <div>Passwords View</div>,
        'todolist': <TaskMaster />,
        'knowledge': <KnowledgeBase user={user} initialNoteId={initialNoteToOpen} onNoteOpened={() => useAppStore.setState({ initialNoteToOpen: null })} />,
        'bookmarks': <Bookmarks />,
        'war_planner': <WarPlanner />,
        'settings': <Settings />,
        'valuta': <ValutaConverter />,
        'crm': <CRM />,
        'moneybox': <div>Moneybox View</div>,
    };

    const mainContent = views[currentView];
    const isSpecialView = currentView === 'todolist' || currentView === 'war_planner';
    const isKnowledgeView = currentView === 'knowledge';
    
    if (isSpecialView) {
        return mainContent;
    }

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <Sidebar onLogout={onLogout} />
            <div className="flex-1 flex flex-col">
                {!isKnowledgeView && (
                    <header className="h-[var(--topbar-h)] bg-slate-50/80 backdrop-blur-lg flex items-center justify-between px-4 sm:px-6 border-b border-slate-200">
                         <button onClick={() => setSidebarOpen(true)} className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/60 lg:hidden">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <div/>
                        <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={onLogout} 
                            className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/60" 
                            title="Log Out"
                        >
                            <LogOutIcon className="w-6 h-6"/>
                        </motion.button>
                    </header>
                )}
                <main className={`flex-1 overflow-y-auto ${isKnowledgeView ? '' : 'p-4 sm:p-6 lg:p-8'}`}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentView}
                            initial="initial"
                            animate="in"
                            exit="out"
                            variants={pageVariants}
                            transition={pageTransition}
                        >
                            {mainContent}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;