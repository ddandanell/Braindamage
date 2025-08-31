

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, where, writeBatch, Timestamp, CollectionReference, DocumentData, DocumentSnapshot } from 'firebase/firestore';
// fix: Import User type to resolve "Cannot find name 'User'" error.
import { User } from 'firebase/auth';
import { WarGoal, Mission, ColorGroup, Subtask, WorkType, TeamMember, Principle, Contact, HistoryEntry, GoalDocument, GoalTransaction, GoalContact, Currency, TransactionType, Task, GoalHistoryEntry, HistoryType } from '../types';
import { ChevronLeftIcon, TrashIcon, XIcon, SettingsIcon, PlusIcon, EditIcon, PlusCircleIcon, FolderIcon, FolderPlusIcon, BriefcaseIcon, LightBulbIcon, DocumentTextIcon, UsersIcon, CalendarDaysIcon, ScaleIcon, RocketLaunchIcon, BullseyeIcon, HeartIcon, SparklesIcon, ExclamationTriangleIcon, UserPlusIcon, ExternalLinkIcon, DocumentDuplicateIcon, BanknotesIcon, UserCircleIcon, ChevronRightIcon, CheckCircleIcon, FlagIcon, ClockIcon } from './Icons';
import { useAppStore } from '../store';

// Indonesian Rupiah currency formatter
const formatIDR = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

type WarCatalog = ColorGroup;
type CalendarView = '7day' | 'month' | 'quarter' | 'year';

// --- MAIN COMPONENT ---
const WarPlanner: React.FC = () => {
    const { user, setCurrentView } = useAppStore();
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState<CalendarView>('month');
    const [goals, setGoals] = useState<WarGoal[]>([]);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [catalogs, setCatalogs] = useState<WarCatalog[]>([]);
    const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [activeModal, setActiveModal] = useState<'catalogs' | 'workTypes' | 'people' | 'newGoal' | 'newTask' | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [newTaskParentId, setNewTaskParentId] = useState<string | null>(null);

    const goalsCollection = useMemo(() => user ? collection(db, 'users', user.uid, 'warGoals') : null, [user]);
    const missionsCollection = useMemo(() => user ? collection(db, 'users', user.uid, 'warMissions') : null, [user]);
    const catalogsCollection = useMemo(() => user ? collection(db, 'users', user.uid, 'warCatalogs') : null, [user]);
    const workTypesCollection = useMemo(() => user ? collection(db, 'users', user.uid, 'workTypes') : null, [user]);
    const contactsCollection = useMemo(() => user ? collection(db, 'users', user.uid, 'contacts') : null, [user]);
    const tasksCollection = useMemo(() => user ? collection(db, 'users', user.uid, 'tasks') : null, [user]);
    
    useEffect(() => { if(!goalsCollection) return; const q = query(goalsCollection, where('year', '==', currentYear), orderBy('createdAt', 'asc')); const unsub = onSnapshot(q, snapshot => setGoals(snapshot.docs.map(doc => processFirestoreData<WarGoal>(doc)))); return unsub; }, [goalsCollection, currentYear]);
    useEffect(() => { if(!missionsCollection) return; const q = query(missionsCollection, where('year', '==', currentYear)); const unsub = onSnapshot(q, snapshot => setMissions(snapshot.docs.map(doc => processFirestoreData<Mission>(doc)))); return unsub; }, [missionsCollection, currentYear]);
    useEffect(() => { if(!catalogsCollection) return; const q = query(catalogsCollection, orderBy('createdAt', 'asc')); const unsub = onSnapshot(q, snapshot => setCatalogs(snapshot.docs.map(d => processFirestoreData<WarCatalog>(d)))); return unsub; }, [catalogsCollection]);
    useEffect(() => { if(!workTypesCollection) return; const q = query(workTypesCollection, orderBy('createdAt', 'asc')); const unsub = onSnapshot(q, snapshot => setWorkTypes(snapshot.docs.map(d => processFirestoreData<WorkType>(d)))); return unsub; }, [workTypesCollection]);
    useEffect(() => { if(!contactsCollection) return; const q = query(contactsCollection, orderBy('createdAt', 'desc')); const unsub = onSnapshot(q, snapshot => setContacts(snapshot.docs.map(d => processFirestoreData<Contact>(d)))); return unsub; }, [contactsCollection]);
    useEffect(() => { if(!tasksCollection) return; const q = query(tasksCollection, orderBy('createdAt', 'desc')); const unsub = onSnapshot(q, snapshot => setTasks(snapshot.docs.map(d => processFirestoreData<Task>(d)))); return unsub; }, [tasksCollection]);

    const handleUpdateGoal = async (id: string, data: Partial<WarGoal>) => { if(goalsCollection) await updateDoc(doc(goalsCollection, id), data) };
    const handleDeleteGoal = async (id: string) => { if(goalsCollection) await deleteDoc(doc(goalsCollection, id)) };
    const handleCreateGoal = async () => { setActiveModal('newGoal'); };
    const handleCreateTask = async (parentId: string | null = null) => { 
        setNewTaskParentId(parentId);
        setActiveModal('newTask'); 
    };

    const handleSaveNewGoal = async (goalData: Omit<WarGoal, 'id' | 'createdAt'>) => {
        if (!goalsCollection) return;
        const docRef = await addDoc(goalsCollection, { ...goalData, createdAt: serverTimestamp() });
        setActiveModal(null);
        setSelectedGoalId(docRef.id);
    };

    const groupedGoals = useMemo(() => {
        const catalogGroups = catalogs.map(catalog => ({...catalog, goals: goals.filter(g => g.catalogId === catalog.id)})).filter(g => g.goals.length > 0);
        const uncategorized = goals.filter(g => !g.catalogId || !catalogs.some(c => c.id === g.catalogId));
        if(uncategorized.length > 0) catalogGroups.push({ id: 'uncategorized', name: 'Uncategorized', color: 'bg-slate-400', createdAt: '', goals: uncategorized });
        return catalogGroups;
    }, [catalogs, goals]);

    const selectedGoal = useMemo(() => goals.find(g => g.id === selectedGoalId), [goals, selectedGoalId]);

    if (!user) return <div>Authenticating...</div>;
    
    if (selectedGoal) {
        return <GoalDetailView user={user} goal={selectedGoal} missions={missions.filter(m => m.parentId === selectedGoal.id)} catalogs={catalogs} onBack={() => setSelectedGoalId(null)} onUpdateGoal={(data) => handleUpdateGoal(selectedGoal.id, data)} onDeleteGoal={() => handleDeleteGoal(selectedGoal.id)} />;
    }

    return (
        <div className="h-screen w-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
            <header className="h-[var(--topbar-h)] flex-shrink-0 bg-white/90 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 border-b border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentView('dashboard')} className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/70 transition-all duration-200 hover:scale-105"><ChevronLeftIcon className="h-5 w-5"/></button>
                    <h1 className="text-xl font-bold text-slate-800">War Planner</h1>
                    
                    {/* Calendar View Controls */}
                    <div className="flex items-center gap-2 ml-4">
                        <div className="flex bg-slate-100 rounded-xl p-1">
                            {(['7day', 'month', 'quarter', 'year'] as CalendarView[]).map(view => (
                                <button
                                    key={view}
                                    onClick={() => setCalendarView(view)}
                                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                                        calendarView === view 
                                            ? 'bg-white shadow-sm text-indigo-600' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {view === '7day' ? '7 Days' : view.charAt(0).toUpperCase() + view.slice(1)}
                                </button>
                            ))}
                        </div>
                        
                        <div className="flex items-center gap-2 ml-2">
                            <button onClick={() => setCurrentYear(y => y - 1)} className="h-8 w-8 rounded-lg hover:bg-slate-200/70 flex items-center justify-center font-bold text-lg transition-all duration-200 hover:scale-105">‹</button>
                            <span className="font-bold text-lg w-12 text-center">{currentYear}</span>
                            <button onClick={() => setCurrentYear(y => y + 1)} className="h-8 w-8 rounded-lg hover:bg-slate-200/70 flex items-center justify-center font-bold text-lg transition-all duration-200 hover:scale-105">›</button>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={() => setActiveModal('people')} className="h-9 px-3 text-sm font-semibold bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-all duration-200 hover:scale-105 flex items-center gap-2">
                        <UsersIcon className="w-4 h-4"/> Staff
                    </button>
                    <button onClick={() => setActiveModal('catalogs')} className="h-9 px-3 text-sm font-semibold bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-all duration-200 hover:scale-105">
                        Manage Catalogs
                    </button>
                    <button onClick={() => handleCreateTask()} className="h-9 px-4 flex items-center gap-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all duration-200 hover:scale-105 shadow-sm">
                        <PlusIcon className="w-4 h-4"/> New Task
                    </button>
                    <button onClick={handleCreateGoal} className="h-9 px-4 flex items-center gap-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 hover:scale-105 shadow-sm">
                        <PlusIcon className="w-4 h-4"/> New Goal
                    </button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto">
                {/* Compact Goals Overview */}
                <div className="p-4 sm:p-6 bg-white border-b border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800">Goals Overview - {currentYear}</h2>
                        <button onClick={handleCreateGoal} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
                            <PlusIcon className="w-4 h-4"/> New Goal
                        </button>
                    </div>
                    
                    {/* Compact Single Row of Goals - Maximum 4 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {goals.slice(0, 4).map(goal => (
                            <GoalCard 
                                key={goal.id} 
                                goal={goal} 
                                catalog={catalogs.find(c => c.id === goal.catalogId)}
                                onClick={() => setSelectedGoalId(goal.id)}
                                onCreateTask={() => handleCreateTask(goal.id)}
                            />
                        ))}
                        {/* Fill empty slots if less than 4 goals */}
                        {Array.from({ length: Math.max(0, 4 - goals.length) }).map((_, index) => (
                            <div 
                                key={`empty-${index}`}
                                className="h-32 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                                onClick={handleCreateGoal}
                            >
                                <div className="text-center text-slate-400">
                                    <PlusIcon className="w-6 h-6 mx-auto mb-1" />
                                    <p className="text-xs font-medium">Add Goal</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {goals.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            <RocketLaunchIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                            <p className="text-sm font-semibold mb-1">No goals for {currentYear}</p>
                            <p className="text-xs">Click 'New Goal' to start planning.</p>
                        </div>
                    )}
                </div>
                
                {/* Full-Screen Enhanced Calendar View */}
                <div className="flex-1 p-4 sm:p-6">
                    <EnhancedCalendarView 
                        view={calendarView}
                        currentDate={currentDate}
                        year={currentYear}
                        goals={goals}
                        missions={missions}
                        tasks={tasks}
                        catalogs={catalogs}
                        onCreateTask={handleCreateTask}
                        onGoalSelect={setSelectedGoalId}
                        onDateChange={setCurrentDate}
                    />
                </div>
            </main>
            {activeModal === 'catalogs' && catalogsCollection && <EnhancedCatalogModal catalogs={catalogs} collectionRef={catalogsCollection} onClose={() => setActiveModal(null)} />}
            {activeModal === 'people' && <ManagePeopleModal user={user} onClose={() => setActiveModal(null)} />}
            {activeModal === 'newGoal' && <NewGoalModal catalogs={catalogs} contacts={contacts} onSave={handleSaveNewGoal} onClose={() => setActiveModal(null)} year={currentYear} />}
            {activeModal === 'newTask' && tasksCollection && <NewTaskModal catalogs={catalogs} parentGoalId={newTaskParentId} tasksCollection={tasksCollection} onClose={() => setActiveModal(null)} />}
        </div>
    );
};


// --- All sub-components (Modals, Calendars, etc.) are kept the same as in the original file ---
const processFirestoreData = <T extends { id: string }>(doc: DocumentSnapshot<DocumentData>): T => { const data = doc.data(); if (!data) return { id: doc.id } as T; const convertTimestamps = (obj: any): any => { if (obj === null || typeof obj !== 'object') return obj; if (obj.toDate && typeof obj.toDate === 'function') return obj.toDate().toISOString(); if (Array.isArray(obj)) return obj.map(item => convertTimestamps(item)); const newObj: { [key: string]: any } = {}; for (const key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = convertTimestamps(obj[key]); } } return newObj; }; return { id: doc.id, ...convertTimestamps(data) } as T; };

// Enhanced Goal Card Component
const GoalCard: React.FC<{
    goal: WarGoal;
    catalog?: WarCatalog;
    onClick: () => void;
    onCreateTask: () => void;
}> = ({ goal, catalog, onClick, onCreateTask }) => {
    const completedSubtasks = goal.subtasks?.filter(st => st.isCompleted).length || 0;
    const totalSubtasks = goal.subtasks?.length || 0;
    const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

    return (
        <div className="group bg-white border border-slate-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden h-32 w-full">
            <div 
                className={`h-2 ${catalog?.color || 'bg-slate-400'}`}
            />
            <div className="p-3 h-full flex flex-col justify-between">
                <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                        <button 
                            onClick={onClick}
                            className="text-left flex-1 min-h-0"
                        >
                            <h3 className="font-bold text-slate-800 hover:text-indigo-600 transition-colors line-clamp-2 text-xs leading-tight">
                                {goal.title}
                            </h3>
                            {goal.description && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                    {goal.description}
                                </p>
                            )}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCreateTask();
                            }}
                            className="ml-2 w-5 h-5 rounded-full bg-black hover:bg-gray-800 text-white transition-all duration-200 hover:scale-110 shadow-md flex items-center justify-center flex-shrink-0"
                            title="Add Task"
                        >
                            <PlusIcon className="w-2.5 h-2.5" />
                        </button>
                    </div>

                    {/* Compact Progress Bar */}
                    {totalSubtasks > 0 && (
                        <div className="mb-2">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                <span className="text-xs">Progress</span>
                                <span className="font-medium text-xs">{completedSubtasks}/{totalSubtasks}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                                <div 
                                    className={`h-1.5 rounded-full transition-all duration-500 ${catalog?.color || 'bg-slate-400'}`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Compact Goal Meta Info */}
                <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1 truncate">
                        <CalendarDaysIcon className="w-2.5 h-2.5" />
                        <span className="truncate text-xs">{goal.estimatedTime || 'No timeline'}</span>
                    </span>
                    {goal.team && goal.team.length > 0 && (
                        <span className="flex items-center gap-1">
                            <UsersIcon className="w-2.5 h-2.5" />
                            <span className="text-xs">{goal.team.length}</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// Enhanced Calendar View Component
const EnhancedCalendarView: React.FC<{
    view: CalendarView;
    currentDate: Date;
    year: number;
    goals: WarGoal[];
    missions: Mission[];
    tasks: Task[];
    catalogs: WarCatalog[];
    onCreateTask: (parentId?: string) => void;
    onGoalSelect: (goalId: string) => void;
    onDateChange: (date: Date) => void;
}> = ({ view, currentDate, year, goals, missions, tasks, catalogs, onCreateTask, onGoalSelect, onDateChange }) => {
    const renderCalendarHeader = () => {
        const navigateDate = (direction: 'prev' | 'next') => {
            const newDate = new Date(currentDate);
            switch (view) {
                case '7day':
                    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
                    break;
                case 'month':
                    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
                    break;
                case 'quarter':
                    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 3 : -3));
                    break;
                case 'year':
                    newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
                    break;
            }
            onDateChange(newDate);
        };

        const goToToday = () => {
            onDateChange(new Date());
        };

        const getDateRangeText = () => {
            switch (view) {
                case '7day':
                    const startOfWeek = new Date(currentDate);
                    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
                    const endOfWeek = new Date(startOfWeek);
                    endOfWeek.setDate(startOfWeek.getDate() + 6);
                    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                case 'month':
                    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                case 'quarter':
                    const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
                    return `Q${quarter} ${currentDate.getFullYear()}`;
                case 'year':
                    return currentDate.getFullYear().toString();
                default:
                    return '';
            }
        };

        return (
            <div className="flex items-center justify-between mb-8 p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-6">
                    <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-4">
                        <CalendarDaysIcon className="w-10 h-10 text-indigo-600" />
                        Calendar View
                    </h2>
                    <div className="flex items-center gap-3 bg-white rounded-xl p-2 shadow-sm border border-slate-200">
                        <button 
                            onClick={() => navigateDate('prev')}
                            className="p-3 rounded-lg hover:bg-slate-100 hover:shadow-sm transition-all duration-200"
                        >
                            <ChevronLeftIcon className="w-6 h-6 text-slate-600" />
                        </button>
                        <div className="px-6 py-3 text-base font-bold text-slate-700 min-w-[200px] text-center">
                            {getDateRangeText()}
                        </div>
                        <button 
                            onClick={() => navigateDate('next')}
                            className="p-3 rounded-lg hover:bg-slate-100 hover:shadow-sm transition-all duration-200"
                        >
                            <ChevronRightIcon className="w-6 h-6 text-slate-600" />
                        </button>
                    </div>
                    <button 
                        onClick={goToToday}
                        className="px-4 py-3 text-base font-semibold bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 transition-all duration-200 shadow-sm"
                    >
                        Today
                    </button>
                </div>
                <div className="text-base font-semibold text-slate-600 bg-white px-4 py-2 rounded-xl border border-slate-200">
                    {view === '7day' ? '7 Days View' : view === 'month' ? 'Month View' : view === 'quarter' ? 'Quarter View' : 'Year View'}
                </div>
            </div>
        );
    };

    const renderViewContent = () => {
        switch (view) {
            case '7day':
                return <SevenDayView currentDate={currentDate} missions={missions} tasks={tasks} goals={goals} catalogs={catalogs} onCreateTask={onCreateTask} onGoalSelect={onGoalSelect} />;
            case 'month':
                return <MonthView currentDate={currentDate} missions={missions} tasks={tasks} goals={goals} catalogs={catalogs} onCreateTask={onCreateTask} onGoalSelect={onGoalSelect} />;
            case 'quarter':
                return <QuarterView currentDate={currentDate} missions={missions} tasks={tasks} goals={goals} catalogs={catalogs} onCreateTask={onCreateTask} onGoalSelect={onGoalSelect} />;
            case 'year':
                return <YearView currentDate={currentDate} missions={missions} tasks={tasks} goals={goals} catalogs={catalogs} onCreateTask={onCreateTask} onGoalSelect={onGoalSelect} />;
            default:
                return <MonthView currentDate={currentDate} missions={missions} tasks={tasks} goals={goals} catalogs={catalogs} onCreateTask={onCreateTask} onGoalSelect={onGoalSelect} />;
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-in slide-in-from-bottom-5 duration-500">
            {renderCalendarHeader()}
            <div className="transition-all duration-300">
                {renderViewContent()}
            </div>
        </div>
    );
};

// 7-Day View Component
const SevenDayView: React.FC<{
    currentDate: Date;
    missions: Mission[];
    tasks: Task[];
    goals: WarGoal[];
    catalogs: WarCatalog[];
    onCreateTask: (parentId?: string) => void;
    onGoalSelect: (goalId: string) => void;
}> = ({ currentDate, missions, tasks, goals, catalogs, onCreateTask, onGoalSelect }) => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const days = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        return day;
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-7 gap-6">
                {days.map((day, index) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    const isSunday = day.getDay() === 0;
                    
                    const dayTasks = tasks.filter(task => {
                        if (!task.dueDate) return false;
                        const taskDate = new Date(task.dueDate);
                        return taskDate.toDateString() === day.toDateString();
                    });

                    const dayMissions = missions.filter(mission => {
                        const start = new Date(mission.startDate);
                        const end = new Date(mission.endDate);
                        return day >= start && day <= end;
                    });

                    return (
                        <div 
                            key={index} 
                            className={`p-6 rounded-2xl border-2 min-h-[400px] transition-all duration-200 hover:shadow-lg ${
                                isToday 
                                    ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg' 
                                    : isSunday
                                        ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 hover:bg-gradient-to-br hover:from-yellow-100 hover:to-amber-100'
                                        : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                        >
                            {/* Day Header */}
                            <div className={`text-center mb-4 ${isToday ? 'text-indigo-600' : isSunday ? 'text-yellow-600' : 'text-slate-700'}`}>
                                <div className="text-sm font-bold mb-1">
                                    {dayNames[index]}
                                </div>
                                <div className={`text-3xl font-bold ${isToday ? 'text-indigo-600' : isSunday ? 'text-yellow-600' : 'text-slate-800'}`}>
                                    {day.getDate()}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {day.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </div>
                            </div>
                            
                            {/* Content */}
                            <div className="space-y-3 flex-1">
                                {dayMissions.map(mission => (
                                    <div key={mission.id} className={`text-sm p-3 rounded-xl text-white font-semibold shadow-sm ${catalogs.find(c => c.id === mission.colorGroupId)?.color || 'bg-slate-500'}`}>
                                        <div className="font-bold">{mission.title}</div>
                                        {mission.description && (
                                            <div className="text-xs opacity-90 mt-1">{mission.description.substring(0, 50)}...</div>
                                        )}
                                    </div>
                                ))}
                                
                                {dayTasks.map(task => (
                                    <div key={task.id} className={`text-sm p-3 rounded-xl border-l-4 bg-slate-50 hover:bg-slate-100 transition-colors ${catalogs.find(c => c.id === task.catalogId)?.color || 'border-slate-500'}`}>
                                        <div className="font-semibold text-slate-800">{task.title}</div>
                                        {task.description && (
                                            <div className="text-xs text-slate-600 mt-1">{task.description.substring(0, 50)}...</div>
                                        )}
                                        <div className="text-xs text-slate-500 mt-1">
                                            Priority: {task.priority}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <button
                                onClick={() => onCreateTask()}
                                className="w-full mt-4 py-3 text-sm text-slate-400 border-2 border-dashed border-slate-300 rounded-xl hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200 font-medium"
                            >
                                + Add Task
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Month View Component (Enhanced version of SimpleCalendarGrid)
// Utility function to get week number
const getWeekNumber = (date: Date): number => {
    const target = new Date(date.valueOf());
    const dayNumber = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
};

const MonthView: React.FC<{
    currentDate: Date;
    missions: Mission[];
    tasks: Task[];
    goals: WarGoal[];
    catalogs: WarCatalog[];
    onCreateTask: (parentId?: string) => void;
    onGoalSelect: (goalId: string) => void;
}> = ({ currentDate, missions, tasks, goals, catalogs, onCreateTask, onGoalSelect }) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    while (current <= lastDay || days.length < 42) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
        if (days.length >= 42) break;
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Group days by weeks for week number display
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }

    return (
        <div className="space-y-6">
            {/* Day Headers with Week Number Column */}
            <div className="grid grid-cols-8 gap-3">
                <div className="p-4 text-center font-bold text-sm text-slate-500 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl">
                    Week #
                </div>
                {dayNames.map((day, index) => (
                    <div key={day} className={`p-4 text-center font-bold text-base rounded-xl border ${
                        index === 0 
                            ? 'text-yellow-700 bg-gradient-to-br from-yellow-100 to-amber-100 border-yellow-300' 
                            : 'text-slate-700 bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'
                    }`}>
                        {day}
                    </div>
                ))}
            </div>
            
            {/* Calendar Grid with Week Numbers */}
            <div className="space-y-3">
                {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-8 gap-3">
                        {/* Week Number */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 flex items-center justify-center">
                            <span className="font-bold text-indigo-700 text-lg">
                                W{getWeekNumber(week[0])}
                            </span>
                        </div>
                        
                        {/* Days of the week */}
                        {week.map((day, dayIndex) => {
                            const isCurrentMonth = day.getMonth() === month;
                            const isToday = day.toDateString() === new Date().toDateString();
                            const isSunday = day.getDay() === 0;
                            
                            const dayTasks = tasks.filter(task => {
                                if (!task.dueDate) return false;
                                const taskDate = new Date(task.dueDate);
                                return taskDate.toDateString() === day.toDateString();
                            });

                            const dayMissions = missions.filter(mission => {
                                const start = new Date(mission.startDate);
                                const end = new Date(mission.endDate);
                                return day >= start && day <= end;
                            });

                            return (
                                <div 
                                    key={dayIndex} 
                                    className={`p-3 rounded-xl min-h-[140px] border-2 transition-all duration-200 hover:shadow-md ${
                                        isCurrentMonth 
                                            ? isToday 
                                                ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md' 
                                                : isSunday
                                                    ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 hover:bg-gradient-to-br hover:from-yellow-100 hover:to-amber-100'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50' 
                                            : 'border-slate-100 bg-slate-50 text-slate-400'
                                    }`}
                                >
                                    {/* Day Number */}
                                    <div className={`text-lg font-bold mb-2 ${isToday ? 'text-indigo-600' : isSunday && isCurrentMonth ? 'text-yellow-600' : isCurrentMonth ? 'text-slate-800' : 'text-slate-400'}`}>
                                        {day.getDate()}
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="space-y-1">
                                        {dayMissions.slice(0, 2).map(mission => (
                                            <div key={mission.id} className={`text-xs p-1.5 rounded-lg text-white font-semibold ${catalogs.find(c => c.id === mission.colorGroupId)?.color || 'bg-slate-500'}`}>
                                                {mission.title.length > 10 ? mission.title.substring(0, 10) + '...' : mission.title}
                                            </div>
                                        ))}
                                        
                                        {dayTasks.slice(0, 1).map(task => (
                                            <div key={task.id} className={`text-xs p-1.5 rounded-lg border-l-3 ${catalogs.find(c => c.id === task.catalogId)?.color || 'border-slate-500'} bg-slate-100 hover:bg-slate-200 transition-colors`}>
                                                {task.title.length > 10 ? task.title.substring(0, 10) + '...' : task.title}
                                            </div>
                                        ))}
                                        
                                        {(dayMissions.length + dayTasks.length) > 3 && (
                                            <div className="text-xs text-slate-500 font-semibold text-center">
                                                +{(dayMissions.length + dayTasks.length) - 3}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {isCurrentMonth && (
                                        <button
                                            onClick={() => onCreateTask()}
                                            className="w-full mt-2 py-1.5 text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200"
                                        >
                                            + Task
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Quarter View Component
const QuarterView: React.FC<{
    currentDate: Date;
    missions: Mission[];
    tasks: Task[];
    goals: WarGoal[];
    catalogs: WarCatalog[];
    onCreateTask: (parentId?: string) => void;
    onGoalSelect: (goalId: string) => void;
}> = ({ currentDate, missions, tasks, goals, catalogs, onCreateTask, onGoalSelect }) => {
    const year = currentDate.getFullYear();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3);
    const startMonth = currentQuarter * 3;
    
    const months = Array.from({ length: 3 }, (_, i) => {
        const monthDate = new Date(year, startMonth + i, 1);
        return monthDate;
    });

    const getQuarterName = (quarter: number) => {
        const names = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
        return names[quarter];
    };

    return (
        <div className="space-y-8">
            <div className="text-center text-xl font-bold text-slate-800 mb-8">
                {getQuarterName(currentQuarter)} {year}
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {months.map((month, index) => {
                    const monthTasks = tasks.filter(task => {
                        if (!task.dueDate) return false;
                        const taskDate = new Date(task.dueDate);
                        return taskDate.getMonth() === month.getMonth() && taskDate.getFullYear() === month.getFullYear();
                    });

                    const monthMissions = missions.filter(mission => {
                        const start = new Date(mission.startDate);
                        const end = new Date(mission.endDate);
                        return (start.getMonth() === month.getMonth() && start.getFullYear() === month.getFullYear()) ||
                               (end.getMonth() === month.getMonth() && end.getFullYear() === month.getFullYear());
                    });

                    const isCurrentMonth = month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear();

                    // Create a mini calendar for each month
                    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
                    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
                    const startDate = new Date(firstDay);
                    startDate.setDate(startDate.getDate() - firstDay.getDay());
                    
                    const days = [];
                    const current = new Date(startDate);
                    while (current <= lastDay || days.length % 7 !== 0) {
                        days.push(new Date(current));
                        current.setDate(current.getDate() + 1);
                        if (days.length >= 42) break;
                    }

                    return (
                        <div 
                            key={index} 
                            className={`p-6 rounded-2xl border-2 transition-all duration-200 hover:shadow-lg ${
                                isCurrentMonth 
                                    ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg' 
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                        >
                            <h3 className={`text-xl font-bold mb-6 text-center ${isCurrentMonth ? 'text-indigo-600' : 'text-slate-800'}`}>
                                {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h3>
                            
                            {/* Mini Calendar */}
                            <div className="mb-6">
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                                        <div key={day} className="text-center text-xs font-bold text-slate-500 p-1">
                                            {day}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {days.map((day, dayIndex) => {
                                        const isCurrentMonthDay = day.getMonth() === month.getMonth();
                                        const isToday = day.toDateString() === new Date().toDateString();
                                        const hasTasks = tasks.some(task => task.dueDate && new Date(task.dueDate).toDateString() === day.toDateString());
                                        const hasMissions = missions.some(mission => {
                                            const start = new Date(mission.startDate);
                                            const end = new Date(mission.endDate);
                                            return day >= start && day <= end;
                                        });

                                        return (
                                            <div 
                                                key={dayIndex}
                                                className={`text-center text-xs p-1 rounded ${
                                                    isCurrentMonthDay
                                                        ? isToday
                                                            ? 'bg-indigo-600 text-white font-bold'
                                                            : hasTasks || hasMissions
                                                                ? 'bg-emerald-100 text-emerald-800 font-semibold'
                                                                : 'text-slate-700 hover:bg-slate-100'
                                                        : 'text-slate-300'
                                                }`}
                                            >
                                                {day.getDate()}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* Stats */}
                            <div className="space-y-3 mb-6">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <div className="text-slate-600">Missions</div>
                                        <div className="text-xl font-bold text-slate-800">{monthMissions.length}</div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <div className="text-slate-600">Tasks</div>
                                        <div className="text-xl font-bold text-slate-800">{monthTasks.length}</div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Recent Items */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Recent Items</h4>
                                {monthMissions.slice(0, 2).map(mission => (
                                    <div key={mission.id} className={`text-sm p-3 rounded-lg text-white font-semibold ${catalogs.find(c => c.id === mission.colorGroupId)?.color || 'bg-slate-500'}`}>
                                        {mission.title}
                                    </div>
                                ))}
                                
                                {monthTasks.slice(0, 2).map(task => (
                                    <div key={task.id} className={`text-sm p-3 rounded-lg border-l-4 bg-slate-50 ${catalogs.find(c => c.id === task.catalogId)?.color || 'border-slate-500'}`}>
                                        {task.title}
                                    </div>
                                ))}
                                
                                {(monthMissions.length + monthTasks.length) > 4 && (
                                    <div className="text-sm text-slate-500 font-semibold text-center py-2">
                                        +{(monthMissions.length + monthTasks.length) - 4} more items
                                    </div>
                                )}
                            </div>
                            
                            <button
                                onClick={() => onCreateTask()}
                                className="w-full mt-6 py-3 text-sm text-slate-400 border-2 border-dashed border-slate-300 rounded-xl hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200 font-medium"
                            >
                                + Add Task for {month.toLocaleDateString('en-US', { month: 'short' })}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Year View Component
const YearView: React.FC<{
    currentDate: Date;
    missions: Mission[];
    tasks: Task[];
    goals: WarGoal[];
    catalogs: WarCatalog[];
    onCreateTask: (parentId?: string) => void;
    onGoalSelect: (goalId: string) => void;
}> = ({ currentDate, missions, tasks, goals, catalogs, onCreateTask, onGoalSelect }) => {
    const year = currentDate.getFullYear();
    
    const months = Array.from({ length: 12 }, (_, i) => {
        const monthDate = new Date(year, i, 1);
        return monthDate;
    });

    const quarters = [
        { name: 'Q1', months: months.slice(0, 3), color: 'from-blue-500 to-indigo-600', bgColor: 'from-blue-50 to-indigo-50' },
        { name: 'Q2', months: months.slice(3, 6), color: 'from-emerald-500 to-green-600', bgColor: 'from-emerald-50 to-green-50' },
        { name: 'Q3', months: months.slice(6, 9), color: 'from-amber-500 to-orange-600', bgColor: 'from-amber-50 to-orange-50' },
        { name: 'Q4', months: months.slice(9, 12), color: 'from-purple-500 to-pink-600', bgColor: 'from-purple-50 to-pink-50' }
    ];

    return (
        <div className="space-y-10">
            <div className="text-center text-2xl font-bold text-slate-800 mb-8">
                {year} - Full Year Overview
            </div>
            
            {/* Yearly Goals Overview */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-8 mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <BullseyeIcon className="w-6 h-6 text-indigo-600" />
                    {year} Goals Overview
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {goals.slice(0, 8).map(goal => (
                        <div 
                            key={goal.id} 
                            onClick={() => onGoalSelect(goal.id)}
                            className="p-6 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105"
                        >
                            <div className={`w-4 h-4 rounded-full mb-3 ${catalogs.find(c => c.id === goal.catalogId)?.color || 'bg-slate-400'}`} />
                            <h4 className="font-bold text-slate-800 text-lg mb-2">{goal.title}</h4>
                            <div className="text-sm text-slate-600 mb-3">
                                {goal.subtasks?.filter(st => st.isCompleted).length || 0} / {goal.subtasks?.length || 0} completed
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div 
                                    className={`h-2 rounded-full transition-all duration-500 ${catalogs.find(c => c.id === goal.catalogId)?.color || 'bg-slate-400'}`}
                                    style={{ 
                                        width: `${goal.subtasks ? (goal.subtasks.filter(st => st.isCompleted).length / goal.subtasks.length) * 100 : 0}%` 
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Quarter Breakdown */}
            <div className="space-y-8">
                {quarters.map((quarter, qIndex) => (
                    <div key={quarter.name} className={`bg-gradient-to-r ${quarter.bgColor} rounded-3xl p-8 border border-slate-200`}>
                        <div className={`bg-gradient-to-r ${quarter.color} text-white px-6 py-3 rounded-xl inline-block mb-6`}>
                            <h3 className="font-bold text-xl">{quarter.name} {year}</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {quarter.months.map((month, index) => {
                                const monthTasks = tasks.filter(task => {
                                    if (!task.dueDate) return false;
                                    const taskDate = new Date(task.dueDate);
                                    return taskDate.getMonth() === month.getMonth() && taskDate.getFullYear() === month.getFullYear();
                                });

                                const monthMissions = missions.filter(mission => {
                                    const start = new Date(mission.startDate);
                                    const end = new Date(mission.endDate);
                                    return (start.getMonth() === month.getMonth() && start.getFullYear() === month.getFullYear()) ||
                                           (end.getMonth() === month.getMonth() && end.getFullYear() === month.getFullYear());
                                });

                                const isCurrentMonth = month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear();

                                // Create mini calendar for each month
                                const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
                                const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
                                const startDate = new Date(firstDay);
                                startDate.setDate(startDate.getDate() - firstDay.getDay());
                                
                                const days = [];
                                const current = new Date(startDate);
                                while (current <= lastDay || days.length % 7 !== 0) {
                                    days.push(new Date(current));
                                    current.setDate(current.getDate() + 1);
                                    if (days.length >= 42) break;
                                }

                                return (
                                    <div 
                                        key={index} 
                                        className={`p-6 rounded-2xl border-2 bg-white transition-all duration-200 hover:shadow-lg ${
                                            isCurrentMonth 
                                                ? 'border-indigo-400 shadow-md' 
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <h4 className={`font-bold text-lg mb-4 text-center ${isCurrentMonth ? 'text-indigo-600' : 'text-slate-800'}`}>
                                            {month.toLocaleDateString('en-US', { month: 'long' })}
                                        </h4>
                                        
                                        {/* Mini Calendar */}
                                        <div className="mb-4">
                                            <div className="grid grid-cols-7 gap-1 mb-1">
                                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                                                    <div key={day} className="text-center text-xs font-semibold text-slate-500 p-1">
                                                        {day}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-7 gap-1">
                                                {days.slice(0, 35).map((day, dayIndex) => {
                                                    const isCurrentMonthDay = day.getMonth() === month.getMonth();
                                                    const isToday = day.toDateString() === new Date().toDateString();
                                                    const hasTasks = tasks.some(task => task.dueDate && new Date(task.dueDate).toDateString() === day.toDateString());
                                                    const hasMissions = missions.some(mission => {
                                                        const start = new Date(mission.startDate);
                                                        const end = new Date(mission.endDate);
                                                        return day >= start && day <= end;
                                                    });

                                                    return (
                                                        <div 
                                                            key={dayIndex}
                                                            className={`text-center text-xs p-1 rounded ${
                                                                isCurrentMonthDay
                                                                    ? isToday
                                                                        ? 'bg-indigo-600 text-white font-bold'
                                                                        : hasTasks || hasMissions
                                                                            ? 'bg-emerald-100 text-emerald-800 font-semibold'
                                                                            : 'text-slate-700 hover:bg-slate-100'
                                                                    : 'text-slate-300'
                                                            }`}
                                                        >
                                                            {day.getDate()}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        
                                        {/* Stats */}
                                        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                                            <div className="bg-slate-50 p-2 rounded-lg text-center">
                                                <div className="text-slate-600">Missions</div>
                                                <div className="text-lg font-bold text-slate-800">{monthMissions.length}</div>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-lg text-center">
                                                <div className="text-slate-600">Tasks</div>
                                                <div className="text-lg font-bold text-slate-800">{monthTasks.length}</div>
                                            </div>
                                        </div>

                                        {/* Sample Items */}
                                        {(monthMissions.length > 0 || monthTasks.length > 0) && (
                                            <div className="space-y-2 mb-4">
                                                {monthMissions.slice(0, 1).map(mission => (
                                                    <div key={mission.id} className={`text-xs p-2 rounded-lg text-white font-semibold ${catalogs.find(c => c.id === mission.colorGroupId)?.color || 'bg-slate-500'}`}>
                                                        {mission.title.length > 20 ? mission.title.substring(0, 20) + '...' : mission.title}
                                                    </div>
                                                ))}
                                                {monthTasks.slice(0, 1).map(task => (
                                                    <div key={task.id} className={`text-xs p-2 rounded-lg border-l-3 bg-slate-100 ${catalogs.find(c => c.id === task.catalogId)?.color || 'border-slate-500'}`}>
                                                        {task.title.length > 20 ? task.title.substring(0, 20) + '...' : task.title}
                                                    </div>
                                                ))}
                                                {(monthMissions.length + monthTasks.length) > 2 && (
                                                    <div className="text-xs text-slate-500 font-semibold text-center">
                                                        +{(monthMissions.length + monthTasks.length) - 2} more
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Enhanced Catalog Modal
const EnhancedCatalogModal: React.FC<{ 
    catalogs: WarCatalog[]; 
    collectionRef: CollectionReference<DocumentData>; 
    onClose: () => void; 
}> = ({ catalogs, collectionRef, onClose }) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState('bg-slate-500');
    
    const colors = [
        'bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
        'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 
        'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 
        'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 
        'bg-pink-500', 'bg-rose-500'
    ];

    const predefinedCatalogs = useMemo(() => [
        { name: 'Projects', color: 'bg-sky-500' },
        { name: 'Private Life', color: 'bg-emerald-500' },
        { name: 'Work', color: 'bg-slate-500' },
        { name: 'Health & Fitness', color: 'bg-rose-500' },
        { name: 'Learning', color: 'bg-purple-500' },
        { name: 'Business', color: 'bg-indigo-500' }
    ], []);

    const existingCatalogNames = useMemo(() => catalogs.map(c => c.name.toLowerCase()), [catalogs]);
    const suggestedCatalogs = useMemo(() => 
        predefinedCatalogs.filter(pc => !existingCatalogNames.includes(pc.name.toLowerCase())), 
        [predefinedCatalogs, existingCatalogNames]
    );

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            await addDoc(collectionRef, { name: name.trim(), color, createdAt: serverTimestamp() });
            setName('');
            setColor('bg-slate-500');
        }
    };

    const handleAddPredefined = async (cat: { name: string, color: string }) => {
        await addDoc(collectionRef, { ...cat, createdAt: serverTimestamp() });
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure? This will affect all goals using this category.')) {
            await deleteDoc(doc(collectionRef, id));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <FolderIcon className="w-8 h-8 text-indigo-600" />
                        Manage Catalogs
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                        <XIcon className="w-6 h-6"/>
                    </button>
                </header>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Suggested Catalogs */}
                    {suggestedCatalogs.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5 text-amber-500" />
                                Suggested Categories
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {suggestedCatalogs.map(sc => (
                                    <button 
                                        key={sc.name} 
                                        onClick={() => handleAddPredefined(sc)} 
                                        className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all duration-200 group"
                                    >
                                        <span className={`w-4 h-4 rounded-full ${sc.color} group-hover:scale-110 transition-transform`}></span>
                                        <span className="font-semibold text-slate-700">{sc.name}</span>
                                        <PlusIcon className="w-4 h-4 ml-auto text-slate-400 group-hover:text-indigo-600"/>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Active Catalogs */}
                    <div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <FolderIcon className="w-5 h-5 text-indigo-500" />
                            Active Categories
                            <span className="text-sm font-normal text-slate-500">({catalogs.length})</span>
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {catalogs.map(c => (
                                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 group border border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-5 h-5 rounded-full ${c.color} shadow-sm`}></span>
                                        <span className="font-semibold text-slate-800">{c.name}</span>
                                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                            Saved
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(c.id)} 
                                        className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 hover:bg-red-50 rounded-lg"
                                    >
                                        <TrashIcon className="w-4 h-4"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Create New Catalog */}
                <form onSubmit={handleSave} className="p-6 border-t border-slate-200 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">Create New Category</h3>
                    <div className="flex gap-3">
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            placeholder="Category name..." 
                            className="flex-grow h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        />
                        <button 
                            type="submit" 
                            className="h-12 px-6 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Save
                        </button>
                    </div>
                    
                    {/* Color Picker */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-3">Choose Color</label>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {colors.map(c => (
                                <button 
                                    key={c} 
                                    type="button" 
                                    onClick={() => setColor(c)} 
                                    className={`w-8 h-8 rounded-full ${c} transition-all duration-200 hover:scale-110 ${
                                        color === c ? 'ring-4 ring-offset-2 ring-indigo-500 scale-110' : 'hover:ring-2 hover:ring-offset-1 hover:ring-slate-300'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// New Task Modal
const NewTaskModal: React.FC<{
    catalogs: WarCatalog[];
    parentGoalId: string | null;
    tasksCollection: CollectionReference<DocumentData>;
    onClose: () => void;
}> = ({ catalogs, parentGoalId, tasksCollection, onClose }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical',
        catalogId: catalogs[0]?.id || '',
        dueDate: '',
        estimatedTime: '',
        tags: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent, saveType: 'goal' | 'everywhere' = 'goal') => {
        e.preventDefault();
        if (!formData.title.trim()) return;

        setIsLoading(true);
        try {
            const taskData = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                isCompleted: false,
                priority: formData.priority,
                dueDate: formData.dueDate || null,
                startDate: null,
                estimatedTime: formData.estimatedTime ? parseInt(formData.estimatedTime) : null,
                energyLevel: null,
                catalogId: formData.catalogId,
                tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
                subtasks: [],
                createdAt: serverTimestamp(),
                parentGoalId: saveType === 'goal' ? parentGoalId : null
            };

            await addDoc(tasksCollection, taskData);
            setShowSuccess(true);
            
            // Show success for 1 second before closing
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (error) {
            console.error('Error creating task:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (showSuccess) {
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircleIcon className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Task Created Successfully!</h3>
                    <p className="text-slate-600">Your task has been saved.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-green-50">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <BriefcaseIcon className="w-8 h-8 text-emerald-600" />
                        Create New Task
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white transition-colors">
                        <XIcon className="w-6 h-6"/>
                    </button>
                </header>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Task Title *</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Enter task title..."
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                required
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Describe the task..."
                                rows={3}
                                className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Priority</label>
                            <select
                                value={formData.priority}
                                onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Critical">Critical</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                            <select
                                value={formData.catalogId}
                                onChange={e => setFormData(prev => ({ ...prev, catalogId: e.target.value }))}
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                {catalogs.map(catalog => (
                                    <option key={catalog.id} value={catalog.id}>{catalog.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Due Date</label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={e => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Estimated Time (minutes)</label>
                            <input
                                type="number"
                                value={formData.estimatedTime}
                                onChange={e => setFormData(prev => ({ ...prev, estimatedTime: e.target.value }))}
                                placeholder="e.g., 60"
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Tags (comma-separated)</label>
                            <input
                                type="text"
                                value={formData.tags}
                                onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                                placeholder="urgent, review, client, etc."
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center gap-4 pt-6 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-12 px-6 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e, 'goal')}
                                disabled={isLoading || !formData.title.trim()}
                                className="h-12 px-6 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <BullseyeIcon className="w-4 h-4" />
                                        Save to Goal
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e, 'everywhere')}
                                disabled={isLoading || !formData.title.trim()}
                                className="h-12 px-6 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="w-4 h-4" />
                                        Save Everywhere
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CatalogSettingsModal: React.FC<{ 
    catalogs: WarCatalog[]; 
    collectionRef: CollectionReference<DocumentData>; 
    onClose: () => void; 
}> = ({ catalogs, collectionRef, onClose }) => { 
    const [name, setName] = useState(''); 
    const [color, setColor] = useState('bg-slate-500'); 
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [editingCatalog, setEditingCatalog] = useState<WarCatalog | null>(null);
    
    const colors = [
        'bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
        'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 
        'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 
        'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 
        'bg-pink-500', 'bg-rose-500'
    ]; 
    
    const predefinedCatalogs = useMemo(() => [
        { name: 'Projects', color: 'bg-sky-500' }, 
        { name: 'Private Life', color: 'bg-emerald-500' }, 
        { name: 'Work', color: 'bg-slate-500' }, 
        { name: 'Health & Fitness', color: 'bg-rose-500' }
    ], []); 
    
    const existingCatalogNames = useMemo(() => catalogs.map(c => c.name.toLowerCase()), [catalogs]); 
    const suggestedCatalogs = useMemo(() => predefinedCatalogs.filter(pc => !existingCatalogNames.includes(pc.name.toLowerCase())), [predefinedCatalogs, existingCatalogNames]); 
    
    const handleSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (!name.trim()) return;
        
        setIsLoading(true);
        try {
            if (editingCatalog) {
                await updateDoc(doc(collectionRef, editingCatalog.id), { name: name.trim(), color });
            } else {
                await addDoc(collectionRef, { name: name.trim(), color, createdAt: serverTimestamp() }); 
            }
            setShowSuccess(true);
            setTimeout(() => {
                setName(''); 
                setEditingCatalog(null);
                setShowSuccess(false);
            }, 1000);
        } catch (error) {
            console.error('Error saving catalog:', error);
        } finally {
            setIsLoading(false);
        }
    }; 
    
    const handleAddPredefined = async (cat: { name: string, color: string }) => {
        setIsLoading(true);
        try {
            await addDoc(collectionRef, { ...cat, createdAt: serverTimestamp() }); 
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 1000);
        } catch (error) {
            console.error('Error adding predefined catalog:', error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEdit = (catalog: WarCatalog) => {
        setEditingCatalog(catalog);
        setName(catalog.name);
        setColor(catalog.color);
    };
    
    const handleDelete = async (id: string) => { 
        if (window.confirm('Are you sure you want to delete this catalog? This action cannot be undone.')) {
            setIsLoading(true);
            try {
                await deleteDoc(doc(collectionRef, id)); 
                if (editingCatalog?.id === id) {
                    setEditingCatalog(null);
                    setName('');
                }
            } catch (error) {
                console.error('Error deleting catalog:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }; 

    if (showSuccess) {
        return (
            <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircleIcon className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                        {editingCatalog ? 'Catalog Updated!' : 'Catalog Created!'}
                    </h3>
                    <p className="text-slate-600">Your catalog has been saved successfully.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4" onClick={() => !isLoading && onClose()}>
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <header className="p-6 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <FolderIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Manage Catalogs</h2>
                            <p className="text-slate-600">Organize your goals and tasks with custom categories</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => !isLoading && onClose()} 
                        className="p-2 rounded-xl hover:bg-white transition-colors shadow-sm"
                        disabled={isLoading}
                    >
                        <XIcon className="w-6 h-6"/>
                    </button>
                </header>

                <div className="flex-1 overflow-hidden flex">
                    {/* Left Panel - Form */}
                    <div className="w-1/2 p-6 border-r border-slate-200 bg-slate-50">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">
                            {editingCatalog ? 'Edit Catalog' : 'Create New Catalog'}
                        </h3>
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Catalog Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Enter catalog name"
                                    disabled={isLoading}
                                    className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all disabled:opacity-50"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-3">
                                    Choose Color
                                </label>
                                <div className="grid grid-cols-6 gap-3">
                                    {colors.map(c => (
                                        <button 
                                            key={c} 
                                            type="button" 
                                            onClick={() => setColor(c)} 
                                            disabled={isLoading}
                                            className={`w-10 h-10 rounded-xl ${c} transition-all hover:scale-110 ${
                                                color === c ? 'ring-4 ring-violet-300 ring-offset-2' : 'hover:ring-2 hover:ring-slate-300'
                                            } disabled:opacity-50`}
                                        />
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                {editingCatalog && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingCatalog(null);
                                            setName('');
                                            setColor('bg-slate-500');
                                        }}
                                        disabled={isLoading}
                                        className="flex-1 h-12 text-sm font-semibold text-slate-600 hover:bg-white rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isLoading || !name.trim()}
                                    className="flex-1 h-12 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircleIcon className="w-4 h-4" />
                                            {editingCatalog ? 'Update' : 'Create'} Catalog
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Quick Add Suggestions */}
                        {suggestedCatalogs.length > 0 && !editingCatalog && (
                            <div className="mt-8">
                                <h4 className="text-sm font-semibold text-slate-600 mb-3">Quick Add</h4>
                                <div className="space-y-2">
                                    {suggestedCatalogs.map(sc => (
                                        <button 
                                            key={sc.name} 
                                            onClick={() => handleAddPredefined(sc)} 
                                            disabled={isLoading}
                                            className="w-full flex items-center gap-3 p-3 bg-white hover:bg-violet-50 rounded-xl text-left transition-colors border border-slate-200 hover:border-violet-200 disabled:opacity-50"
                                        >
                                            <span className={`w-4 h-4 rounded-full ${sc.color}`}></span>
                                            <span className="font-medium text-slate-700">{sc.name}</span>
                                            <PlusIcon className="w-4 h-4 text-slate-400 ml-auto" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Catalog List */}
                    <div className="w-1/2 overflow-y-auto">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-6">
                                Active Catalogs ({catalogs.length})
                            </h3>
                            
                            {catalogs.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <FolderIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                                    <p className="font-semibold mb-2">No catalogs yet</p>
                                    <p className="text-sm">Create your first catalog to organize your goals</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {catalogs.map(catalog => (
                                        <div 
                                            key={catalog.id} 
                                            className={`p-4 rounded-2xl border-2 transition-all group hover:shadow-md ${
                                                editingCatalog?.id === catalog.id 
                                                    ? 'border-violet-300 bg-violet-50' 
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-xl ${catalog.color} shadow-sm`}></span>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-800">{catalog.name}</h4>
                                                        <p className="text-xs text-slate-500">
                                                            Created {new Date().toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleEdit(catalog)} 
                                                        disabled={isLoading}
                                                        className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-100 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Edit"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(catalog.id)} 
                                                        disabled={isLoading}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ); 
};
const ManagePeopleModal: React.FC<{ user: User; onClose: () => void; }> = ({ user, onClose }) => { 
    const [contacts, setContacts] = useState<Contact[]>([]); 
    const [editingContact, setEditingContact] = useState<Contact | 'new' | null>(null); 
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const contactsCollection = useMemo(() => collection(db, 'users', user.uid, 'contacts'), [user.uid]); 
    
    useEffect(() => { 
        const q = query(contactsCollection, orderBy('createdAt', 'desc')); 
        const unsub = onSnapshot(q, snapshot => setContacts(snapshot.docs.map(d => processFirestoreData<Contact>(d)))); 
        return unsub; 
    }, [contactsCollection]); 
    
    const handleSave = async (data: Omit<Contact, 'id' | 'createdAt'>) => { 
        setIsLoading(true);
        try {
            if (editingContact && typeof editingContact === 'object') {
                await updateDoc(doc(contactsCollection, editingContact.id), data); 
            } else {
                await addDoc(contactsCollection, { ...data, createdAt: serverTimestamp() }); 
            }
            setShowSuccess(true);
            setTimeout(() => {
                setEditingContact(null); 
                setShowSuccess(false);
            }, 1000);
        } catch (error) {
            console.error('Error saving contact:', error);
        } finally {
            setIsLoading(false);
        }
    }; 
    
    const handleDelete = async (id: string) => { 
        if (window.confirm('Are you sure you want to delete this contact?')) {
            setIsLoading(true);
            try {
                await deleteDoc(doc(contactsCollection, id)); 
                setEditingContact(null);
            } catch (error) {
                console.error('Error deleting contact:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }; 

    const filteredContacts = contacts.filter(contact => 
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (showSuccess) {
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircleIcon className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Contact Saved Successfully!</h3>
                    <p className="text-slate-600">Your contact has been updated.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4" onClick={() => !isLoading && onClose()}>
            <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <header className="p-6 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <UsersIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">People Management</h2>
                            <p className="text-slate-600">Manage your contacts and team members</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => !isLoading && onClose()} 
                        className="p-2 rounded-xl hover:bg-white transition-colors shadow-sm"
                        disabled={isLoading}
                    >
                        <XIcon className="w-6 h-6"/>
                    </button>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col">
                        {/* Search & Add */}
                        <div className="p-4 space-y-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                />
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => setEditingContact('new')} 
                                className="w-full flex items-center justify-center gap-3 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                                disabled={isLoading}
                            >
                                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                                    <PlusIcon className="w-4 h-4" />
                                </div>
                                Add New Person
                            </button>
                        </div>

                        {/* Contacts List */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-2">
                                {filteredContacts.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <UsersIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                        <p className="font-semibold mb-1">No contacts found</p>
                                        <p className="text-sm">Add your first contact to get started</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredContacts.map(contact => (
                                            <div 
                                                key={contact.id} 
                                                onClick={() => setEditingContact(contact)} 
                                                className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                                                    editingContact && typeof editingContact === 'object' && editingContact.id === contact.id 
                                                        ? 'bg-indigo-100 border-2 border-indigo-300 shadow-lg' 
                                                        : 'bg-white hover:bg-slate-50 border border-slate-200'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                        {contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-slate-800 truncate">{contact.name}</p>
                                                        <p className="text-sm text-slate-500 truncate">{contact.email || 'No email'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 overflow-y-auto">
                        {editingContact ? (
                            <ContactForm 
                                key={typeof editingContact === 'object' ? editingContact.id : 'new'} 
                                contact={editingContact === 'new' ? null : editingContact} 
                                onSave={handleSave} 
                                onDelete={handleDelete} 
                                onCancel={() => setEditingContact(null)} 
                                isLoading={isLoading}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center text-slate-500">
                                    <UsersIcon className="w-20 h-20 mx-auto mb-4 text-slate-300" />
                                    <h3 className="text-xl font-semibold mb-2 text-slate-700">Select a Contact</h3>
                                    <p className="text-slate-500 mb-6">Choose a contact from the list or add a new one</p>
                                    <button 
                                        onClick={() => setEditingContact('new')} 
                                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                                    >
                                        Add First Contact
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    ); 
};
const ContactForm: React.FC<{ 
    contact: Contact | null; 
    onSave: (data: Omit<Contact, 'id'|'createdAt'>) => void; 
    onDelete: (id: string) => void; 
    onCancel: () => void; 
    isLoading?: boolean;
}> = ({ contact, onSave, onDelete, onCancel, isLoading = false }) => { 
    const [formData, setFormData] = useState({ 
        name: contact?.name || '', 
        email: contact?.email || '', 
        phone: contact?.phone || '', 
        notes: contact?.notes || '' 
    }); 
    
    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (formData.name.trim()) {
            onSave(formData); 
        }
    }; 
    
    return (
        <div className="p-8 h-full flex flex-col">
            <div className="flex items-center gap-4 mb-8">
                {contact ? (
                    <div className="w-16 h-16 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                        {contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                ) : (
                    <div className="w-16 h-16 bg-gradient-to-r from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <UserPlusIcon className="w-8 h-8" />
                    </div>
                )}
                <div>
                    <h3 className="text-2xl font-bold text-slate-800">
                        {contact ? 'Edit Contact' : 'New Contact'}
                    </h3>
                    <p className="text-slate-600">
                        {contact ? 'Update contact information' : 'Add a new person to your contacts'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Full Name *
                        </label>
                        <input 
                            type="text" 
                            value={formData.name} 
                            onChange={e => setFormData(p => ({...p, name: e.target.value}))} 
                            placeholder="Enter full name" 
                            required 
                            disabled={isLoading}
                            className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
                        /> 
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Email Address
                        </label>
                        <input 
                            type="email" 
                            value={formData.email} 
                            onChange={e => setFormData(p => ({...p, email: e.target.value}))} 
                            placeholder="email@example.com" 
                            disabled={isLoading}
                            className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
                        /> 
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Phone Number
                        </label>
                        <input 
                            type="tel" 
                            value={formData.phone} 
                            onChange={e => setFormData(p => ({...p, phone: e.target.value}))} 
                            placeholder="+62 812 3456 7890" 
                            disabled={isLoading}
                            className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
                        /> 
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Company/Title
                        </label>
                        <input 
                            type="text" 
                            placeholder="Company or job title" 
                            disabled={isLoading}
                            className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
                        /> 
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Notes
                    </label>
                    <textarea 
                        value={formData.notes} 
                        onChange={e => setFormData(p => ({...p, notes: e.target.value}))} 
                        rows={4} 
                        placeholder="Additional notes about this contact..." 
                        disabled={isLoading}
                        className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-8 border-t border-slate-200">
                    <div className="flex gap-3">
                        <button 
                            type="button" 
                            onClick={onCancel} 
                            disabled={isLoading}
                            className="h-12 px-6 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        
                        {contact && (
                            <button 
                                type="button" 
                                onClick={() => onDelete(contact.id)} 
                                disabled={isLoading}
                                className="h-12 px-6 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Delete Contact
                            </button>
                        )}
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={isLoading || !formData.name.trim()}
                        className="h-12 px-8 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon className="w-4 h-4" />
                                {contact ? 'Update Contact' : 'Save Contact'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    ); 
};
const GlobalYearCalendar: React.FC<{ year: number; missions: Mission[]; catalogs: WarCatalog[] }> = ({ year, missions, catalogs }) => { return (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{[...Array(12)].map((_, i) => (<MiniMonth key={i} year={year} month={i} missions={missions} catalogs={catalogs} />))}</div>); };
const MiniMonth: React.FC<{ year: number; month: number; missions: Mission[]; catalogs: WarCatalog[]; }> = ({ year, month, missions, catalogs }) => { const getCatalogColor = (id: string | null) => catalogs.find(c => c.id === id)?.color || 'bg-slate-500'; const monthDate = new Date(year, month, 1); const daysInMonth = new Date(year, month + 1, 0).getDate(); const firstDayIndex = monthDate.getDay(); const days = [...Array(firstDayIndex).fill(null), ...Array.from({ length: daysInMonth }, (_, k) => k + 1)]; return (<div className="bg-white p-3 rounded-xl border border-slate-200"><h4 className="font-bold text-base text-center mb-2">{monthDate.toLocaleString('default', { month: 'long' })}</h4><div className="grid grid-cols-7 text-xs text-center">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="font-semibold text-slate-400 pb-1">{d}</div>)}{days.map((day, index) => { const dayDate = day ? new Date(year, month, day) : null; const missionsForDay = dayDate ? missions.filter(m => { const start = new Date(m.startDate); start.setHours(0, 0, 0, 0); const end = new Date(m.endDate); end.setHours(23, 59, 59, 999); return dayDate >= start && dayDate <= end; }) : []; const isToday = dayDate && new Date().toDateString() === dayDate.toDateString(); return (<div key={index} className="relative h-24 pt-1 text-center"><span className={`text-sm font-medium ${isToday ? 'bg-indigo-600 text-white rounded-full h-6 w-6 flex items-center justify-center mx-auto' : 'text-slate-700'}`}>{day}</span><div className="mt-1 space-y-0.5 overflow-hidden">{missionsForDay.slice(0, 2).map(m => (<div key={m.id} title={m.title} className={`w-full text-left text-[10px] font-bold px-1 py-0.5 rounded text-white truncate ${getCatalogColor(m.colorGroupId)}`}>{m.title}</div>))}{missionsForDay.length > 2 && (<div className="text-[10px] text-slate-500 font-semibold text-center mt-0.5">+ {missionsForDay.length - 2}</div>)}</div></div>); })}</div></div>); };
const GoalDetailView: React.FC<{ user: any; goal: WarGoal; missions: Mission[]; catalogs: WarCatalog[]; onBack: () => void; onUpdateGoal: (data: Partial<WarGoal>) => void; onDeleteGoal: () => void; }> = ({ user, goal, missions, catalogs, onBack, onUpdateGoal, onDeleteGoal }) => { 
    const [activeTab, setActiveTab] = useState('action-plan'); 

    const tabs = [
        { id: 'action-plan', label: 'Action Plan', icon: RocketLaunchIcon, color: 'text-indigo-600' }, 
        { id: 'strategy', label: 'Strategy', icon: LightBulbIcon, color: 'text-purple-600' },
        { id: 'team', label: 'Team', icon: UsersIcon, color: 'text-emerald-600' },
        { id: 'documents', label: 'Documents', icon: DocumentTextIcon, color: 'text-slate-600' },
        { id: 'financials', label: 'Financials', icon: BanknotesIcon, color: 'text-amber-600' },
        { id: 'history', label: 'History', icon: SparklesIcon, color: 'text-pink-600' }
    ]; 
    
    return (
        <div className="h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 bg-white/95 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200/80 shadow-sm">
                <button onClick={onBack} className="flex items-center gap-2 font-semibold text-slate-600 hover:text-slate-900 transition-all duration-200 hover:scale-105">
                    <ChevronLeftIcon className="w-5 h-5"/> Back to Planner
                </button>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${catalogs.find(c => c.id === goal.catalogId)?.color || 'bg-slate-400'} animate-pulse`} />
                        <span className="text-sm font-medium text-slate-600">
                            {catalogs.find(c => c.id === goal.catalogId)?.name || 'Uncategorized'}
                        </span>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <div className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 rounded-lg">
                            Auto-saved
                        </div>
                        <button 
                            onClick={() => {
                                if (window.confirm('Are you sure you want to delete this goal? This action cannot be undone.')) {
                                    onDeleteGoal();
                                    onBack();
                                }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                            <TrashIcon className="w-3 h-3" />
                            Delete Goal
                        </button>
                    </div>
                </div>
            </header>
            
            {/* Compact Goal Header */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
                <div className="px-6 py-4">
                    <div className="flex items-center gap-4">
                        {/* Compact Goal Icon */}
                        <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-200">
                            <BullseyeIcon className="w-8 h-8 text-white" />
                        </div>
                        
                        {/* Goal Info with Deadline Countdown */}
                        <div className="flex-1 min-w-0">
                            <EditableField as="h2" value={goal.title} onSave={(val) => onUpdateGoal({ title: val })} className="text-2xl font-bold text-slate-800 mb-1" placeholder="Goal Title" />
                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-2">
                                {goal.estimatedTime && (
                                    <div className="flex items-center gap-1">
                                        <CalendarDaysIcon className="w-4 h-4" />
                                        <span>{goal.estimatedTime}</span>
                                    </div>
                                )}
                                {goal.team && goal.team.length > 0 && (
                                    <div className="flex items-center gap-1">
                                        <UsersIcon className="w-4 h-4" />
                                        <span>{goal.team.length} team member{goal.team.length !== 1 ? 's' : ''}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1">
                                    <RocketLaunchIcon className="w-4 h-4" />
                                    <span>{goal.subtasks?.length || 0} action{(goal.subtasks?.length || 0) !== 1 ? 's' : ''}</span>
                                </div>
                            </div>
                            
                            {/* Deadline Section */}
                            <div className="flex items-center gap-4 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-600">Deadline:</span>
                                    <EditableField 
                                        value={goal.deadline ? new Date(goal.deadline).toLocaleDateString() : ''} 
                                        onSave={(val) => {
                                            const date = new Date(val);
                                            if (!isNaN(date.getTime())) {
                                                onUpdateGoal({ deadline: date.toISOString() });
                                            }
                                        }} 
                                        className="text-sm text-slate-700" 
                                        placeholder="Set deadline (YYYY-MM-DD)" 
                                    />
                                </div>
                                {goal.deadline && (
                                    <DeadlineCountdown deadline={goal.deadline} className="text-sm" />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Compact Strategic Questions - Horizontal Layout (50% smaller) */}
                <div className="px-6 pb-3">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-2 rounded-lg border border-blue-200 hover:shadow-sm transition-all duration-200">
                            <h4 className="font-semibold text-blue-700 mb-1 flex items-center gap-1 text-xs">
                                <BullseyeIcon className="w-3 h-3" />
                                What & How to Get
                            </h4>
                            <EditableField 
                                value={goal.whatToReach || ''} 
                                onSave={(val) => onUpdateGoal({ whatToReach: val })} 
                                className="text-xs text-blue-600 leading-relaxed" 
                                placeholder="Describe what you want to achieve..."
                                as="textarea"
                            />
                        </div>
                        <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-2 rounded-lg border border-purple-200 hover:shadow-sm transition-all duration-200">
                            <h4 className="font-semibold text-purple-700 mb-1 flex items-center gap-1 text-xs">
                                <LightBulbIcon className="w-3 h-3" />
                                How to Reach
                            </h4>
                            <EditableField 
                                value={goal.howToReach || ''} 
                                onSave={(val) => onUpdateGoal({ howToReach: val })} 
                                className="text-xs text-purple-600 leading-relaxed" 
                                placeholder="Describe your strategy..."
                                as="textarea"
                            />
                        </div>
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-2 rounded-lg border border-emerald-200 hover:shadow-sm transition-all duration-200">
                            <h4 className="font-semibold text-emerald-700 mb-1 flex items-center gap-1 text-xs">
                                <HeartIcon className="w-3 h-3" />
                                Why Important
                            </h4>
                            <EditableField 
                                value={goal.whyToTakeOn || ''} 
                                onSave={(val) => onUpdateGoal({ whyToTakeOn: val })} 
                                className="text-xs text-emerald-600 leading-relaxed" 
                                placeholder="Describe the importance..."
                                as="textarea"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Tab Navigation */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
                <nav className="flex space-x-1 px-6 overflow-x-auto scrollbar-hide">
                    {tabs.map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id)} 
                            className={`flex-shrink-0 flex items-center gap-1 py-2 px-3 border-b-2 text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                                activeTab === tab.id 
                                    ? `border-indigo-500 ${tab.color} bg-indigo-50/50` 
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <tab.icon className="w-3 h-3"/>
                            {tab.label}
                        </button>
                    ))} 
                </nav>
            </div>
            
            {/* Main Content Area - Expanded */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Tab Content - Takes most space */}
                <main className="flex-1 overflow-y-auto p-6 animate-in slide-in-from-right-5 duration-300">
                    <div className="max-w-6xl mx-auto">
                        {activeTab === 'action-plan' && <EnhancedActionPlanTab goal={goal} onUpdate={onUpdateGoal} />}
                        {activeTab === 'strategy' && <StrategyTab goal={goal} onUpdate={onUpdateGoal} />}
                        {activeTab === 'team' && <TeamTab goal={goal} onUpdate={onUpdateGoal} />}
                        {activeTab === 'documents' && <DocumentsTab goal={goal} onUpdate={onUpdateGoal} />}
                        {activeTab === 'financials' && <FinancialsTab goal={goal} onUpdate={onUpdateGoal} />}
                        {activeTab === 'history' && <EnhancedHistoryTab goal={goal} onUpdate={onUpdateGoal} />}
                    </div>
                </main>
                
                {/* Sidebar Calendar - Compact on larger screens, full width on mobile */}
                <aside className="w-full lg:w-80 xl:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto">
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <CalendarDaysIcon className="w-5 h-5 text-indigo-600" />
                            Goal Calendar
                        </h3>
                        <div className="space-y-4">
                            <MonthView 
                                currentDate={new Date()}
                                missions={missions}
                                tasks={[]}
                                goals={[goal]}
                                catalogs={catalogs}
                                onCreateTask={() => {}}
                                onGoalSelect={() => {}}
                            />
                            
                            {/* Quick Stats */}
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 space-y-3">
                                <h4 className="font-semibold text-slate-700 text-sm">Quick Stats</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Progress</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                                                    style={{ 
                                                        width: `${goal.subtasks ? (goal.subtasks.filter(st => st.isCompleted).length / goal.subtasks.length) * 100 : 0}%` 
                                                    }}
                                                />
                                            </div>
                                            <span className="font-semibold text-slate-700">
                                                {goal.subtasks ? Math.round((goal.subtasks.filter(st => st.isCompleted).length / goal.subtasks.length) * 100) : 0}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Team Size</span>
                                        <span className="font-semibold text-slate-700">{goal.team?.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Documents</span>
                                        <span className="font-semibold text-slate-700">{goal.documents?.length || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};
// Deadline Countdown Component
const DeadlineCountdown: React.FC<{ deadline?: string; className?: string }> = ({ deadline, className = '' }) => {
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        isOverdue: boolean;
    } | null>(null);

    useEffect(() => {
        if (!deadline) return;

        const updateCountdown = () => {
            const now = new Date().getTime();
            const target = new Date(deadline).getTime();
            const difference = target - now;

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
                
                setTimeLeft({ days, hours, minutes, isOverdue: false });
            } else {
                const days = Math.floor(Math.abs(difference) / (1000 * 60 * 60 * 24));
                const hours = Math.floor((Math.abs(difference) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((Math.abs(difference) % (1000 * 60 * 60)) / (1000 * 60));
                
                setTimeLeft({ days, hours, minutes, isOverdue: true });
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [deadline]);

    if (!deadline || !timeLeft) return null;

    const { days, hours, minutes, isOverdue } = timeLeft;

    return (
        <div className={`${className} ${isOverdue ? 'text-red-600' : 'text-emerald-600'}`}>
            <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                <span className="font-semibold">
                    {isOverdue ? 'Overdue by: ' : 'Time left: '}
                    {days > 0 && `${days}d `}
                    {hours > 0 && `${hours}h `}
                    {minutes > 0 && `${minutes}m`}
                    {days === 0 && hours === 0 && minutes === 0 && (isOverdue ? 'Just overdue' : 'Due now!')}
                </span>
            </div>
        </div>
    );
};

const EditableField: React.FC<{ 
    value: string; 
    onSave: (newValue: string) => void; 
    as?: 'h2' | 'p' | 'textarea'; 
    placeholder?: string; 
    className?: string 
}> = ({ value, onSave, as = 'p', placeholder = "Click to edit", className = '' }) => { 
    const [isEditing, setIsEditing] = useState(false); 
    const [currentValue, setCurrentValue] = useState(value); 
    const [isSaving, setIsSaving] = useState(false);
    
    // Update currentValue when value prop changes
    useEffect(() => {
        setCurrentValue(value);
    }, [value]);
    
    const handleSave = async () => { 
        if (currentValue !== value && !isSaving) {
            setIsSaving(true);
            try {
                await onSave(currentValue);
            } catch (error) {
                console.error('Failed to save:', error);
                // Revert on error
                setCurrentValue(value);
            } finally {
                setIsSaving(false);
            }
        }
        setIsEditing(false); 
    }; 
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && as !== 'textarea') {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Escape') {
            setCurrentValue(value);
            setIsEditing(false);
        }
    };
    
    if (isEditing) { 
        if (as === 'textarea') {
            return (
                <div className="relative">
                    <textarea 
                        value={currentValue} 
                        onChange={e => setCurrentValue(e.target.value)} 
                        onBlur={handleSave} 
                        onKeyDown={handleKeyDown}
                        autoFocus 
                        className={`bg-white border-2 border-indigo-300 rounded-lg p-2 w-full min-h-[80px] focus:border-indigo-500 focus:outline-none ${className}`} 
                        disabled={isSaving}
                    />
                    {isSaving && (
                        <div className="absolute top-2 right-2 w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    )}
                </div>
            );
        }
        return (
            <div className="relative">
                <input 
                    type="text" 
                    value={currentValue} 
                    onChange={e => setCurrentValue(e.target.value)} 
                    onBlur={handleSave} 
                    onKeyDown={handleKeyDown} 
                    autoFocus 
                    className={`bg-white border-2 border-indigo-300 rounded-lg p-2 w-full focus:border-indigo-500 focus:outline-none ${className}`} 
                    disabled={isSaving}
                />
                {isSaving && (
                    <div className="absolute top-2 right-2 w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                )}
            </div>
        );
    } 
    
    const displayValue = value || placeholder; 
    const displayClass = !value ? 'text-slate-400' : ''; 
    
    return React.createElement(as, { 
        onClick: () => setIsEditing(true), 
        className: `cursor-pointer hover:bg-slate-100/80 p-2 rounded-lg transition-colors border-2 border-transparent hover:border-slate-200 ${className} ${displayClass}` 
    }, displayValue); 
};
const ActionPlanTab: React.FC<{ goal: WarGoal; onUpdate: (data: Partial<WarGoal>) => void; }> = ({ goal, onUpdate }) => { const [subtasks, setSubtasks] = useState(goal.subtasks || []); const handleUpdate = () => onUpdate({ subtasks }); const handleChange = (index: number, newSubtask: Subtask) => { const newSubtasks = [...subtasks]; newSubtasks[index] = newSubtask; setSubtasks(newSubtasks); }; const addSubtask = () => setSubtasks([...subtasks, { id: `new_${Date.now()}`, title: '', isCompleted: false }]); const removeSubtask = (index: number) => { const newSubtasks = subtasks.filter((_, i) => i !== index); setSubtasks(newSubtasks); onUpdate({ subtasks: newSubtasks }); }; return (<div className="bg-white border border-slate-200 rounded-2xl p-6"><h3 className="text-xl font-bold mb-4">Action Plan</h3><div className="space-y-3">{subtasks.map((st, i) => (<div key={st.id} className={`flex items-center gap-3 group ${st.isCompleted ? 'opacity-60' : ''}`}><input type="checkbox" checked={st.isCompleted} onChange={() => { handleChange(i, {...st, isCompleted: !st.isCompleted }); handleUpdate(); }} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/><input type="text" value={st.title} onChange={e => handleChange(i, {...st, title: e.target.value})} onBlur={handleUpdate} className={`flex-grow p-2 border rounded-lg bg-transparent focus:bg-white focus:border-indigo-300 ${st.isCompleted ? 'line-through text-slate-500' : ''} border-transparent hover:border-slate-200`} placeholder="Describe action..."/><button onClick={() => removeSubtask(i)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600"><TrashIcon className="w-5 h-5" /></button></div>))}</div><button onClick={addSubtask} className="mt-4 flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-800"><PlusCircleIcon className="w-5 h-5"/> Add Action</button></div>); };

// Enhanced Action Plan Tab
const EnhancedActionPlanTab: React.FC<{ goal: WarGoal; onUpdate: (data: Partial<WarGoal>) => void; }> = ({ goal, onUpdate }) => {
    const [subtasks, setSubtasks] = useState(goal.subtasks || []);
    
    const handleUpdate = () => onUpdate({ subtasks });
    
    const handleChange = (index: number, newSubtask: Subtask) => {
        const newSubtasks = [...subtasks];
        newSubtasks[index] = newSubtask;
        setSubtasks(newSubtasks);
    };
    
    const addSubtask = () => setSubtasks([...subtasks, { 
        id: `new_${Date.now()}`, 
        title: '', 
        isCompleted: false 
    }]);
    
    const removeSubtask = (index: number) => {
        const newSubtasks = subtasks.filter((_, i) => i !== index);
        setSubtasks(newSubtasks);
        onUpdate({ subtasks: newSubtasks });
    };

    const completedTasks = subtasks.filter(st => st.isCompleted).length;
    const totalTasks = subtasks.length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return (
        <div className="space-y-6">
            {/* Progress Overview */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold">Action Plan Progress</h3>
                    <div className="text-right">
                        <div className="text-3xl font-bold">{Math.round(progress)}%</div>
                        <div className="text-indigo-200 text-sm">{completedTasks} of {totalTasks} completed</div>
                    </div>
                </div>
                <div className="w-full bg-white/20 rounded-full h-3">
                    <div 
                        className="bg-white h-3 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Action Items */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-800">Action Items</h3>
                    <button 
                        onClick={addSubtask}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                        <PlusCircleIcon className="w-5 h-5"/> Add Action
                    </button>
                </div>
                
                <div className="space-y-4">
                    {subtasks.map((st, i) => (
                        <div key={st.id} className={`p-4 border-2 rounded-xl transition-all duration-200 group ${
                            st.isCompleted 
                                ? 'border-green-200 bg-green-50' 
                                : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="checkbox" 
                                    checked={st.isCompleted}
                                    onChange={() => {
                                        handleChange(i, {...st, isCompleted: !st.isCompleted });
                                        handleUpdate();
                                    }}
                                    className="h-6 w-6 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <input 
                                    type="text" 
                                    value={st.title}
                                    onChange={e => handleChange(i, {...st, title: e.target.value})}
                                    onBlur={handleUpdate}
                                    className={`flex-grow p-3 border-0 bg-transparent text-lg font-medium focus:ring-0 ${
                                        st.isCompleted 
                                            ? 'line-through text-slate-500' 
                                            : 'text-slate-800'
                                    }`}
                                    placeholder="Describe this action..."
                                />
                                <button 
                                    onClick={() => removeSubtask(i)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {subtasks.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            <RocketLaunchIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                            <p className="text-lg font-semibold mb-2">No actions yet</p>
                            <p className="text-sm">Click 'Add Action' to start planning your goal.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Strategy Tab
const StrategyTab: React.FC<{ goal: WarGoal; onUpdate: (data: Partial<WarGoal>) => void; }> = ({ goal, onUpdate }) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Strategic Approach */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <LightBulbIcon className="w-6 h-6 text-purple-600" />
                        Strategic Approach
                    </h3>
                    <EditableField 
                        as="textarea"
                        value={goal.howToReach || ''} 
                        onSave={(val) => onUpdate({ howToReach: val })} 
                        className="text-slate-600 leading-relaxed min-h-[200px]" 
                        placeholder="Describe your detailed strategy, methods, and approach to achieve this goal..." 
                    />
                </div>

                {/* Success Metrics */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ScaleIcon className="w-6 h-6 text-emerald-600" />
                        Success Metrics
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Financial Target</label>
                            <input
                                type="number"
                                value={goal.financialTarget || ''}
                                onChange={e => onUpdate({ financialTarget: parseInt(e.target.value) || undefined })}
                                placeholder="e.g., 100000"
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Timeline</label>
                            <input
                                type="text"
                                value={goal.estimatedTime || ''}
                                onChange={e => onUpdate({ estimatedTime: e.target.value })}
                                placeholder="e.g., 6 months, 1 year"
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Knowledge Requirements */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:col-span-2">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <DocumentTextIcon className="w-6 h-6 text-blue-600" />
                        Knowledge & Skills Required
                    </h3>
                    <EditableField 
                        as="textarea"
                        value={goal.knowledgeRequired || ''} 
                        onSave={(val) => onUpdate({ knowledgeRequired: val })} 
                        className="text-slate-600 leading-relaxed min-h-[120px]" 
                        placeholder="What knowledge, skills, or expertise do you need to develop or acquire?" 
                    />
                </div>
            </div>
        </div>
    );
};

// Team Tab
const TeamTab: React.FC<{ goal: WarGoal; onUpdate: (data: Partial<WarGoal>) => void; }> = ({ goal, onUpdate }) => {
    const [team, setTeam] = useState<TeamMember[]>(goal.team || []);

    const addTeamMember = () => {
        const newMember: TeamMember = {
            id: `member_${Date.now()}`,
            name: '',
            role: '',
            hours: 0,
            skills: ''
        };
        const newTeam = [...team, newMember];
        setTeam(newTeam);
        onUpdate({ team: newTeam });
    };

    const updateTeamMember = (index: number, updates: Partial<TeamMember>) => {
        const newTeam = team.map((member, i) => 
            i === index ? { ...member, ...updates } : member
        );
        setTeam(newTeam);
        onUpdate({ team: newTeam });
    };

    const removeTeamMember = (index: number) => {
        const newTeam = team.filter((_, i) => i !== index);
        setTeam(newTeam);
        onUpdate({ team: newTeam });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <UsersIcon className="w-8 h-8 text-emerald-600" />
                    Team Members
                </h3>
                <button 
                    onClick={addTeamMember}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                >
                    <UserPlusIcon className="w-5 h-5"/> Add Member
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {team.map((member, index) => (
                    <div key={member.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                <UserCircleIcon className="w-8 h-8 text-emerald-600" />
                            </div>
                            <button 
                                onClick={() => removeTeamMember(index)}
                                className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={member.name}
                                onChange={e => updateTeamMember(index, { name: e.target.value })}
                                placeholder="Full Name"
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            />
                            <input
                                type="text"
                                value={member.role}
                                onChange={e => updateTeamMember(index, { role: e.target.value })}
                                placeholder="Role/Position"
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            />
                            <input
                                type="number"
                                value={member.hours}
                                onChange={e => updateTeamMember(index, { hours: parseInt(e.target.value) || 0 })}
                                placeholder="Hours per week"
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            />
                            <textarea
                                value={member.skills}
                                onChange={e => updateTeamMember(index, { skills: e.target.value })}
                                placeholder="Skills and expertise"
                                rows={3}
                                className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>
                ))}
            </div>

            {team.length === 0 && (
                <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
                    <UsersIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-semibold text-slate-600 mb-2">No team members yet</p>
                    <p className="text-slate-500 mb-4">Add team members to collaborate on this goal.</p>
                    <button 
                        onClick={addTeamMember}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                    >
                        Add First Member
                    </button>
                </div>
            )}
        </div>
    );
};

// Documents Tab
const DocumentsTab: React.FC<{ goal: WarGoal; onUpdate: (data: Partial<WarGoal>) => void; }> = ({ goal, onUpdate }) => {
    const [documents, setDocuments] = useState<GoalDocument[]>(goal.documents || []);

    const addDocument = () => {
        const newDoc: GoalDocument = {
            id: `doc_${Date.now()}`,
            name: '',
            description: '',
            url: ''
        };
        const newDocs = [...documents, newDoc];
        setDocuments(newDocs);
        onUpdate({ documents: newDocs });
    };

    const updateDocument = (index: number, updates: Partial<GoalDocument>) => {
        const newDocs = documents.map((doc, i) => 
            i === index ? { ...doc, ...updates } : doc
        );
        setDocuments(newDocs);
        onUpdate({ documents: newDocs });
    };

    const removeDocument = (index: number) => {
        const newDocs = documents.filter((_, i) => i !== index);
        setDocuments(newDocs);
        onUpdate({ documents: newDocs });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <DocumentTextIcon className="w-8 h-8 text-blue-600" />
                    Documents & Resources
                </h3>
                <button 
                    onClick={addDocument}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                    <DocumentDuplicateIcon className="w-5 h-5"/> Add Document
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {documents.map((doc, index) => (
                    <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-4">
                                <input
                                    type="text"
                                    value={doc.name}
                                    onChange={e => updateDocument(index, { name: e.target.value })}
                                    placeholder="Document name"
                                    className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold"
                                />
                                <input
                                    type="url"
                                    value={doc.url}
                                    onChange={e => updateDocument(index, { url: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                />
                                <textarea
                                    value={doc.description}
                                    onChange={e => updateDocument(index, { description: e.target.value })}
                                    placeholder="Description..."
                                    rows={2}
                                    className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                {doc.url && (
                                    <a 
                                        href={doc.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <ExternalLinkIcon className="w-5 h-5" />
                                    </a>
                                )}
                                <button 
                                    onClick={() => removeDocument(index)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {documents.length === 0 && (
                <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
                    <DocumentTextIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-semibold text-slate-600 mb-2">No documents yet</p>
                    <p className="text-slate-500 mb-4">Add documents, links, and resources related to this goal.</p>
                    <button 
                        onClick={addDocument}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                    >
                        Add First Document
                    </button>
                </div>
            )}
        </div>
    );
};

// Financials Tab
const FinancialsTab: React.FC<{ goal: WarGoal; onUpdate: (data: Partial<WarGoal>) => void; }> = ({ goal, onUpdate }) => {
    const [transactions, setTransactions] = useState<GoalTransaction[]>(goal.transactions || []);

    const addTransaction = () => {
        const newTransaction: GoalTransaction = {
            id: `txn_${Date.now()}`,
            name: '',
            comment: '',
            amount: 0,
            currency: 'IDR',
            type: 'Expense (for my work)',
            date: new Date().toISOString().split('T')[0]
        };
        const newTransactions = [...transactions, newTransaction];
        setTransactions(newTransactions);
        onUpdate({ transactions: newTransactions });
    };

    const updateTransaction = (index: number, updates: Partial<GoalTransaction>) => {
        const newTransactions = transactions.map((txn, i) => 
            i === index ? { ...txn, ...updates } : txn
        );
        setTransactions(newTransactions);
        onUpdate({ transactions: newTransactions });
    };

    const removeTransaction = (index: number) => {
        const newTransactions = transactions.filter((_, i) => i !== index);
        setTransactions(newTransactions);
        onUpdate({ transactions: newTransactions });
    };

    const totalIncome = transactions
        .filter(t => t.type === 'Income (money I got for work)')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
        .filter(t => t.type === 'Expense (for my work)')
        .reduce((sum, t) => sum + t.amount, 0);

    const profit = totalIncome - totalExpenses;

    return (
        <div className="space-y-6">
            {/* Financial Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                    <h4 className="font-semibold text-green-700 mb-2">Total Income</h4>
                    <p className="text-3xl font-bold text-green-600">{formatIDR(totalIncome)}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                    <h4 className="font-semibold text-red-700 mb-2">Total Expenses</h4>
                    <p className="text-3xl font-bold text-red-600">{formatIDR(totalExpenses)}</p>
                </div>
                <div className={`border-2 rounded-2xl p-6 ${profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
                    <h4 className={`font-semibold mb-2 ${profit >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>Net Profit</h4>
                    <p className={`text-3xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {formatIDR(profit)}
                    </p>
                </div>
            </div>

            {/* Add Transaction */}
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <BanknotesIcon className="w-8 h-8 text-amber-600" />
                    Financial Tracking
                </h3>
                <button 
                    onClick={addTransaction}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5"/> Add Transaction
                </button>
            </div>

            {/* Transactions List */}
            <div className="space-y-4">
                {transactions.map((txn, index) => (
                    <div key={txn.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Name</label>
                                <input
                                    type="text"
                                    value={txn.name}
                                    onChange={e => updateTransaction(index, { name: e.target.value })}
                                    placeholder="Transaction name"
                                    className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Amount</label>
                                <input
                                    type="number"
                                    value={txn.amount}
                                    onChange={e => updateTransaction(index, { amount: parseFloat(e.target.value) || 0 })}
                                    placeholder="0"
                                    className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Type</label>
                                <select
                                    value={txn.type}
                                    onChange={e => updateTransaction(index, { type: e.target.value as TransactionType })}
                                    className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="Income (money I got for work)">Income</option>
                                    <option value="Expense (for my work)">Expense</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
                                <input
                                    type="date"
                                    value={txn.date.split('T')[0]}
                                    onChange={e => updateTransaction(index, { date: e.target.value })}
                                    className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Comment</label>
                                <textarea
                                    value={txn.comment}
                                    onChange={e => updateTransaction(index, { comment: e.target.value })}
                                    placeholder="Additional notes..."
                                    rows={2}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div className="flex items-end">
                                <button 
                                    onClick={() => removeTransaction(index)}
                                    className="w-full h-10 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <TrashIcon className="w-5 h-5 mx-auto" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {transactions.length === 0 && (
                <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
                    <BanknotesIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-semibold text-slate-600 mb-2">No transactions yet</p>
                    <p className="text-slate-500 mb-4">Track income and expenses related to this goal.</p>
                    <button 
                        onClick={addTransaction}
                        className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors"
                    >
                        Add First Transaction
                    </button>
                </div>
            )}
        </div>
    );
};

// Enhanced History Tab for Goal Detail View
const EnhancedHistoryTab: React.FC<{ goal: WarGoal; onUpdate: (data: Partial<WarGoal>) => void; }> = ({ goal, onUpdate }) => {
    const [historyEntries, setHistoryEntries] = useState<GoalHistoryEntry[]>(goal.history || []);

    const addHistoryEntry = () => {
        const newEntry: GoalHistoryEntry = {
            id: `history_${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            title: '',
            description: '',
            type: 'Update'
        };
        const newHistory = [newEntry, ...historyEntries];
        setHistoryEntries(newHistory);
        onUpdate({ history: newHistory });
    };

    const updateHistoryEntry = (index: number, updates: Partial<GoalHistoryEntry>) => {
        const newHistory = historyEntries.map((entry, i) => 
            i === index ? { ...entry, ...updates } : entry
        );
        setHistoryEntries(newHistory);
        onUpdate({ history: newHistory });
    };

    const removeHistoryEntry = (index: number) => {
        const newHistory = historyEntries.filter((_, i) => i !== index);
        setHistoryEntries(newHistory);
        onUpdate({ history: newHistory });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Achievement': return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
            case 'Milestone': return <FlagIcon className="w-5 h-5 text-purple-600" />;
            case 'Challenge': return <ExclamationTriangleIcon className="w-5 h-5 text-orange-600" />;
            default: return <ClockIcon className="w-5 h-5 text-blue-600" />;
        }
    };

    const getTypeBg = (type: string) => {
        switch (type) {
            case 'Achievement': return 'bg-green-50 border-green-200';
            case 'Milestone': return 'bg-purple-50 border-purple-200';
            case 'Challenge': return 'bg-orange-50 border-orange-200';
            default: return 'bg-blue-50 border-blue-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ClockIcon className="w-8 h-8 text-slate-600" />
                    Goal History
                </h3>
                <button 
                    onClick={addHistoryEntry}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5"/> Add Entry
                </button>
            </div>

            <div className="space-y-4">
                {historyEntries.map((entry, index) => (
                    <div key={entry.id} className={`border-2 rounded-2xl p-6 ${getTypeBg(entry.type)}`}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
                                <input
                                    type="date"
                                    value={entry.date.split('T')[0]}
                                    onChange={e => updateHistoryEntry(index, { date: e.target.value })}
                                    className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Type</label>
                                <select
                                    value={entry.type}
                                    onChange={e => updateHistoryEntry(index, { type: e.target.value as HistoryType })}
                                    className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                                >
                                    <option value="Update">Update</option>
                                    <option value="Achievement">Achievement</option>
                                    <option value="Milestone">Milestone</option>
                                    <option value="Challenge">Challenge</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                    {getTypeIcon(entry.type)}
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={entry.title}
                                    onChange={e => updateHistoryEntry(index, { title: e.target.value })}
                                    placeholder="What happened?"
                                    className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                                <textarea
                                    value={entry.description}
                                    onChange={e => updateHistoryEntry(index, { description: e.target.value })}
                                    placeholder="Provide details about this event..."
                                    rows={3}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                                />
                            </div>
                            <div className="flex items-end">
                                <button 
                                    onClick={() => removeHistoryEntry(index)}
                                    className="w-full h-10 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <TrashIcon className="w-5 h-5 mx-auto" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {historyEntries.length === 0 && (
                <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
                    <ClockIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-semibold text-slate-600 mb-2">No history yet</p>
                    <p className="text-slate-500 mb-4">Track important milestones, achievements, and updates for this goal.</p>
                    <button 
                        onClick={addHistoryEntry}
                        className="px-6 py-3 bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors"
                    >
                        Add First Entry
                    </button>
                </div>
            )}
        </div>
    );
};

const HistoryTab: React.FC<{ user: any; goalId: string; }> = ({ user, goalId }) => { const [history, setHistory] = useState<HistoryEntry[]>([]); const [newEntryText, setNewEntryText] = useState(''); const [newEntryType, setNewEntryType] = useState<'success' | 'learning'>('success'); const historyCollection = useMemo(() => collection(db, 'users', user.uid, 'warGoals', goalId, 'history'), [user, goalId]); useEffect(() => { const q = query(historyCollection, orderBy('createdAt', 'desc')); const unsub = onSnapshot(q, snapshot => setHistory(snapshot.docs.map(d => processFirestoreData<HistoryEntry>(d)))); return unsub; }, [historyCollection]); const handleAddEntry = async (e: React.FormEvent) => { e.preventDefault(); if (newEntryText.trim()) await addDoc(historyCollection, { goalId, text: newEntryText, type: newEntryType, createdAt: serverTimestamp() }); setNewEntryText(''); }; return (<div className="bg-white border border-slate-200 rounded-2xl"><div className="p-6"><h3 className="text-xl font-bold mb-4">Goal History</h3><form onSubmit={handleAddEntry} className="flex gap-2 items-start"><textarea value={newEntryText} onChange={e => setNewEntryText(e.target.value)} placeholder="Document a success or learning..." rows={2} className="flex-grow p-2 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500"></textarea><div className="flex flex-col gap-2"><div className="flex bg-slate-100 rounded-lg p-0.5"><button type="button" onClick={() => setNewEntryType('success')} className={`px-2 py-1 rounded-md text-sm font-semibold flex items-center gap-1 ${newEntryType === 'success' ? 'bg-white shadow' : ''}`}><SparklesIcon className="w-4 h-4 text-green-500"/> Success</button><button type="button" onClick={() => setNewEntryType('learning')} className={`px-2 py-1 rounded-md text-sm font-semibold flex items-center gap-1 ${newEntryType === 'learning' ? 'bg-white shadow' : ''}`}><LightBulbIcon className="w-4 h-4 text-amber-500"/> Learning</button></div><button type="submit" className="h-9 w-full bg-indigo-600 text-white font-semibold rounded-lg text-sm hover:bg-indigo-700">Add</button></div></form></div><div className="border-t border-slate-200 p-6 space-y-4">{history.map(entry => (<div key={entry.id} className="flex gap-4 items-start"><div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${entry.type === 'success' ? 'bg-green-100' : 'bg-amber-100'}`}>{entry.type === 'success' ? <SparklesIcon className="w-5 h-5 text-green-600" /> : <LightBulbIcon className="w-5 h-5 text-amber-600" />}</div><div><p className="text-slate-700">{entry.text}</p><p className="text-xs text-slate-400 mt-1">{new Date(entry.createdAt).toLocaleString()}</p></div></div>))}{history.length === 0 && <p className="text-slate-500 text-center py-8">No history recorded yet.</p>}</div></div>) };

const NewGoalModal: React.FC<{
    catalogs: WarCatalog[];
    contacts: Contact[];
    onSave: (goalData: Omit<WarGoal, 'id' | 'createdAt'>) => void;
    onClose: () => void;
    year: number;
}> = ({ catalogs, contacts, onSave, onClose, year }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        catalogId: null as string | null,
        whatToReach: '',
        howToReach: '',
        whyToTakeOn: '',
        estimatedTime: '',
        selectedTeam: [] as string[]
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.whatToReach.trim() || !formData.howToReach.trim() || !formData.whyToTakeOn.trim()) {
            alert('Please fill in all required fields');
            return;
        }

        const goalData: Omit<WarGoal, 'id' | 'createdAt'> = {
            title: formData.title.trim(),
            description: formData.description.trim(),
            year,
            catalogId: formData.catalogId,
            subtasks: [],
            whatToReach: formData.whatToReach.trim(),
            howToReach: formData.howToReach.trim(),
            whyToTakeOn: formData.whyToTakeOn.trim(),
            estimatedTime: formData.estimatedTime.trim(),
            team: formData.selectedTeam.map(contactId => {
                const contact = contacts.find(c => c.id === contactId);
                return {
                    id: contactId,
                    name: contact?.name || '',
                    role: 'Team Member',
                    hours: 0,
                    skills: ''
                } as TeamMember;
            })
        };

        onSave(goalData);
    };

    const handleTeamToggle = (contactId: string) => {
        setFormData(prev => ({
            ...prev,
            selectedTeam: prev.selectedTeam.includes(contactId)
                ? prev.selectedTeam.filter(id => id !== contactId)
                : [...prev.selectedTeam, contactId]
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">Create New Goal</h2>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
                        <XIcon className="w-6 h-6"/>
                    </button>
                </header>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Title and Description */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Goal Title *</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Enter your goal title..."
                                className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Describe your goal..."
                                rows={3}
                                className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Three Required Questions */}
                    <div className="space-y-6 border-t border-slate-200 pt-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Goal Clarity Questions</h3>
                        
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                1. What is your goal, and how do you get it? *
                            </label>
                            <textarea
                                value={formData.whatToReach}
                                onChange={e => setFormData(prev => ({ ...prev, whatToReach: e.target.value }))}
                                placeholder="Describe what you want to achieve and the path to get there..."
                                rows={4}
                                className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                2. How do you reach this goal? *
                            </label>
                            <textarea
                                value={formData.howToReach}
                                onChange={e => setFormData(prev => ({ ...prev, howToReach: e.target.value }))}
                                placeholder="Describe the specific steps, strategies, and methods you'll use..."
                                rows={4}
                                className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                3. How do you look when you get it? (Why is this important?) *
                            </label>
                            <textarea
                                value={formData.whyToTakeOn}
                                onChange={e => setFormData(prev => ({ ...prev, whyToTakeOn: e.target.value }))}
                                placeholder="Describe how achieving this goal will transform you and why it matters..."
                                rows={4}
                                className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>
                    </div>

                    {/* Additional Information */}
                    <div className="space-y-4 border-t border-slate-200 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                                <select
                                    value={formData.catalogId || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, catalogId: e.target.value || null }))}
                                    className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">No Category</option>
                                    {catalogs.map(catalog => (
                                        <option key={catalog.id} value={catalog.id}>{catalog.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Estimated Time</label>
                                <input
                                    type="text"
                                    value={formData.estimatedTime}
                                    onChange={e => setFormData(prev => ({ ...prev, estimatedTime: e.target.value }))}
                                    placeholder="e.g., 3 months, 1 year..."
                                    className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Team Members */}
                        {contacts.length > 0 && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-3">
                                    Team Members
                                    <span className="text-slate-500 font-normal ml-2">
                                        ({formData.selectedTeam.length} selected)
                                    </span>
                                </label>
                                <div className="max-h-32 overflow-y-auto border border-slate-300 rounded-xl p-3">
                                    <div className="space-y-2">
                                        {contacts.map(contact => (
                                            <label key={contact.id} className="flex items-center gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.selectedTeam.includes(contact.id)}
                                                    onChange={() => handleTeamToggle(contact.id)}
                                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                                                />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{contact.name}</p>
                                                    <p className="text-xs text-slate-500">{contact.email}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-12 px-6 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="h-12 px-8 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
                        >
                            Create Goal
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WarPlanner;