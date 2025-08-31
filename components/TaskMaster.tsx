

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, where, setDoc } from 'firebase/firestore';
import { Task, Catalog, Subtask, Folder } from '../types';
import { 
    ChevronLeftIcon, MenuIcon, FolderIcon, PlusIcon, LogOutIcon, ClockIcon, TrashIcon, XIcon,
    TodayIcon, CalendarDaysIcon, InboxIcon, FlagIcon, CheckCircleIcon, EditIcon
} from './Icons';

// An object mapping icon names to their respective components
const catalogIcons: { [key: string]: React.FC<any> } = {
    Inbox: InboxIcon,
    Folder: FolderIcon,
};

type SmartListView = 'today' | 'scheduled' | 'all' | 'flagged' | 'completed';
type View = SmartListView | string; // string for Catalog ID or Folder ID

const TaskMaster: React.FC<{ user: User; onExit: () => void; onLogout: () => void; }> = ({ user, onExit, onLogout }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [catalogs, setCatalogs] = useState<Catalog[]>([]); // These are "Lists"
    const [folders, setFolders] = useState<Folder[]>([]);
    
    const [currentView, setCurrentView] = useState<View>('today');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const tasksCollection = useMemo(() => collection(db, 'users', user.uid, 'tasks'), [user.uid]);
    const catalogsCollection = useMemo(() => collection(db, 'users', user.uid, 'catalogs'), [user.uid]);
    const foldersCollection = useMemo(() => collection(db, 'users', user.uid, 'folders'), [user.uid]);

    // Data fetching
    useEffect(() => {
        const q = query(tasksCollection, orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, snapshot => {
            const tasksData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                } as Task;
            });
            setTasks(tasksData);
        });
        return unsubscribe;
    }, [tasksCollection]);
    
    useEffect(() => {
        const q = query(catalogsCollection, orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, snapshot => {
            let catalogsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                } as Catalog
            });
            if (!catalogsData.some(c => c.id === 'inbox')) {
                const inbox = { id: 'inbox', name: 'Inbox', color: '#64748b', icon: 'Inbox', createdAt: new Date().toISOString(), folderId: null };
                setDoc(doc(catalogsCollection, 'inbox'), { name: 'Inbox', color: '#64748b', icon: 'Inbox', createdAt: serverTimestamp() }).catch(() => {}); // Add if not exists
                catalogsData.unshift(inbox);
            }
            setCatalogs(catalogsData);
        });
        return unsubscribe;
    }, [catalogsCollection]);

    useEffect(() => {
        const q = query(foldersCollection, orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, snapshot => {
            const foldersData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                } as Folder;
            });
            setFolders(foldersData);
        });
        return unsubscribe;
    }, [foldersCollection]);


    const handleSaveTask = useCallback(async (taskData: Partial<Task>) => {
        if (selectedTask) {
            await updateDoc(doc(tasksCollection, selectedTask.id), taskData);
        }
    }, [tasksCollection, selectedTask]);

    const handleCreateTask = useCallback(async () => {
        let defaultCatalogId = 'inbox';
        if (currentView !== 'today' && currentView !== 'scheduled' && currentView !== 'all' && currentView !== 'flagged' && currentView !== 'completed' ) {
            // If view is a list, use that list's ID
            if(catalogs.some(c => c.id === currentView)) {
                defaultCatalogId = currentView;
            }
        }
        
        const newTask: Omit<Task, 'id' | 'createdAt'> = {
            title: 'New Task',
            description: '',
            isCompleted: false,
            priority: 'Medium',
            dueDate: null,
            startDate: null,
            estimatedTime: null,
            energyLevel: null,
            catalogId: defaultCatalogId,
            tags: [],
            subtasks: [],
            isFlagged: false
        };

        // Optimistic update for instant UI feedback
        const optimisticTask: Task = {
            ...newTask,
            id: `optimistic_${Date.now()}`,
            createdAt: new Date().toISOString(),
        };
        setTasks(prevTasks => [optimisticTask, ...prevTasks]);
        setSelectedTask(optimisticTask);

        // Add to Firebase in the background
        const docRef = await addDoc(tasksCollection, { ...newTask, createdAt: serverTimestamp() });
        
        // The onSnapshot listener will automatically replace the optimistic task with the real one.
        // We can update the selected task's ID to the real one to avoid issues if the user edits it immediately.
        setSelectedTask(prevTask => {
            if (prevTask && prevTask.id === optimisticTask.id) {
                return { ...prevTask, id: docRef.id };
            }
            return prevTask;
        });

    }, [tasksCollection, currentView, catalogs]);


    const handleDeleteTask = useCallback(async (taskId: string) => {
        await deleteDoc(doc(tasksCollection, taskId));
        setSelectedTask(null);
    }, [tasksCollection]);


    const filteredTasks = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        switch (currentView) {
            case 'today':
                return tasks.filter(t => !t.isCompleted && t.dueDate && new Date(t.dueDate) <= today && new Date(t.dueDate) >= todayStart);
            case 'scheduled':
                return tasks.filter(t => !t.isCompleted && t.dueDate);
            case 'all':
                return tasks.filter(t => !t.isCompleted);
            case 'flagged':
                return tasks.filter(t => !t.isCompleted && t.isFlagged);
            case 'completed':
                return tasks.filter(t => t.isCompleted);
            default:
                // Is it a folder?
                const folder = folders.find(f => f.id === currentView);
                if (folder) {
                    const listIdsInFolder = catalogs.filter(c => c.folderId === folder.id).map(c => c.id);
                    return tasks.filter(t => !t.isCompleted && listIdsInFolder.includes(t.catalogId));
                }
                // It must be a list
                return tasks.filter(t => !t.isCompleted && t.catalogId === currentView);
        }
    }, [tasks, currentView, folders, catalogs]);
    
    const viewTitle = useMemo(() => {
        const smartListTitles: Record<SmartListView, string> = {
            today: 'Today', scheduled: 'Scheduled', all: 'All Tasks', flagged: 'Flagged', completed: 'Completed'
        };
        if (Object.keys(smartListTitles).includes(currentView)) {
            return smartListTitles[currentView as SmartListView];
        }
        return catalogs.find(c => c.id === currentView)?.name || folders.find(f => f.id === currentView)?.name || "Tasks";
    }, [currentView, catalogs, folders]);

    return (
        <div className="flex h-screen w-screen bg-slate-100 text-slate-900 antialiased font-sans">
            <Sidebar 
                user={user}
                isOpen={isSidebarOpen} 
                onClose={() => setIsSidebarOpen(false)}
                onExit={onExit}
                currentView={currentView}
                setCurrentView={setCurrentView}
                catalogs={catalogs}
                folders={folders}
                tasks={tasks}
            />
            
            <main className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
                <header className="h-[var(--topbar-h)] flex-shrink-0 bg-slate-100/80 backdrop-blur-lg flex items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/60 sm:hidden">
                            <MenuIcon className="w-6 h-6"/>
                        </button>
                        <h2 className="text-2xl font-bold text-slate-800">{viewTitle}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleCreateTask} className="flex items-center justify-center gap-2 h-9 px-3 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors">
                            <PlusIcon className="w-4 h-4"/>
                            <span className="hidden sm:inline">New Task</span>
                        </button>
                         <button onClick={onLogout} className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/60" title="Log Out">
                            <LogOutIcon className="w-6 h-6"/>
                        </button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <ul className="space-y-2">
                         {filteredTasks.map(task => (
                            <TaskItem 
                                key={task.id} 
                                task={task} 
                                onSelect={() => setSelectedTask(task)}
                                onToggleComplete={async () => await updateDoc(doc(tasksCollection, task.id), { isCompleted: !task.isCompleted })}
                            />
                        ))}
                        {filteredTasks.length === 0 && (
                            <div className="text-center py-16 text-slate-500">No tasks in this list.</div>
                        )}
                    </ul>
                </div>
            </main>

            {selectedTask && (
                <TaskDetailPanel
                    task={selectedTask}
                    catalogs={catalogs.filter(c => c.id !== 'inbox')}
                    onSave={handleSaveTask}
                    onClose={() => setSelectedTask(null)}
                    onDelete={handleDeleteTask}
                />
            )}
        </div>
    );
};

const Sidebar: React.FC<{
    user: User,
    isOpen: boolean,
    onClose: () => void,
    onExit: () => void,
    currentView: View,
    setCurrentView: (view: View) => void,
    catalogs: Catalog[],
    folders: Folder[],
    tasks: Task[]
}> = ({ user, isOpen, onClose, onExit, currentView, setCurrentView, catalogs, folders, tasks }) => {
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

    const smartLists: { id: SmartListView; label: string; icon: React.FC<any>; }[] = [
        { id: 'today', label: 'Today', icon: TodayIcon },
        { id: 'scheduled', label: 'Scheduled', icon: CalendarDaysIcon },
        { id: 'all', label: 'All', icon: InboxIcon },
        { id: 'flagged', label: 'Flagged', icon: FlagIcon },
        { id: 'completed', label: 'Completed', icon: CheckCircleIcon },
    ];
    
    const taskCounts = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        return {
            today: tasks.filter(t => !t.isCompleted && t.dueDate && new Date(t.dueDate) <= today && new Date(t.dueDate) >= todayStart).length,
            scheduled: tasks.filter(t => !t.isCompleted && t.dueDate).length,
            all: tasks.filter(t => !t.isCompleted).length,
            flagged: tasks.filter(t => !t.isCompleted && t.isFlagged).length,
            completed: 0, // usually not shown
        };
    }, [tasks]);

    return (
        <nav className={`absolute sm:relative z-20 flex flex-col bg-slate-200/80 backdrop-blur-xl border-r border-slate-300/50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0 w-72 flex-shrink-0`}>
             <div className="h-[var(--topbar-h)] flex-shrink-0 flex items-center justify-between px-4 border-b border-slate-300/50">
                <div className="flex items-center gap-2">
                     <button onClick={onExit} className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-300/60"><ChevronLeftIcon className="h-5 w-5"/></button>
                     <h1 className="text-lg font-bold text-slate-800">Task Master</h1>
                </div>
                 <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-300/60 sm:hidden"><XIcon className="h-6 w-6"/></button>
            </div>
            <div className="flex-grow p-3 space-y-4 overflow-y-auto">
                <div className="space-y-1">
                    {smartLists.map(list => (
                        <SidebarItem 
                            key={list.id} 
                            icon={<list.icon className="w-5 h-5"/>} 
                            label={list.label} 
                            count={taskCounts[list.id as keyof typeof taskCounts]}
                            onClick={() => setCurrentView(list.id)} 
                            isActive={currentView === list.id} 
                        />
                    ))}
                </div>
                <div>
                     <h3 className="px-3 text-sm font-bold text-slate-600 mt-4 mb-2">My Lists</h3>
                     <div className="space-y-1">
                        {folders.map(folder => (
                            <div key={folder.id}>
                                <div onClick={() => setOpenFolders(p => ({...p, [folder.id]: !p[folder.id]}))} className="flex items-center w-full px-3 py-2 text-base font-medium rounded-lg text-left gap-3.5 transition-colors text-slate-700 hover:bg-slate-300/50 cursor-pointer">
                                    <FolderIcon className="w-5 h-5"/>
                                    <span className="truncate flex-1 font-semibold">{folder.name}</span>
                                </div>
                                {openFolders[folder.id] && (
                                    <div className="pl-4">
                                        {catalogs.filter(c => c.folderId === folder.id).map(c => (
                                             <SidebarItem key={c.id} icon={<div className="w-3 h-3 rounded-full" style={{backgroundColor: c.color}} />} label={c.name} onClick={() => setCurrentView(c.id)} isActive={currentView === c.id} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {catalogs.filter(c => !c.folderId).map(c => (
                             <SidebarItem key={c.id} icon={<div className="w-3 h-3 rounded-full" style={{backgroundColor: c.color}} />} label={c.name} onClick={() => setCurrentView(c.id)} isActive={currentView === c.id} />
                        ))}
                     </div>
                </div>
            </div>
        </nav>
    );
};

const SidebarItem: React.FC<{label: string, icon: React.ReactNode, count?: number, isActive: boolean, onClick: () => void}> = ({ label, icon, count, isActive, onClick }) => (
    <button onClick={onClick} className={`flex items-center w-full px-3 py-2 text-base font-medium rounded-lg text-left gap-3.5 transition-colors ${isActive ? 'bg-indigo-600 text-white shadow' : 'text-slate-700 hover:bg-slate-300/50'}`}>
        <span className="flex-shrink-0 w-5 h-5">{icon}</span>
        <span className="truncate flex-1 font-semibold">{label}</span>
        {count != null && count > 0 && <span className="text-sm font-bold">{count}</span>}
    </button>
);

const TaskItem: React.FC<{task: Task, onSelect: () => void, onToggleComplete: () => void}> = ({ task, onSelect, onToggleComplete }) => {
    const priorityClasses = {
        'Low': 'text-slate-500', 'Medium': 'text-blue-600', 'High': 'text-orange-600', 'Critical': 'text-red-600'
    };
    return (
        <li className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm hover:border-indigo-400 transition-all flex items-start gap-3 group">
            <button onClick={(e) => { e.stopPropagation(); onToggleComplete(); }} className="mt-0.5 flex-shrink-0" disabled={task.id.startsWith('optimistic_')}>
                <div className={`h-6 w-6 rounded-full border-2 ${task.isCompleted ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 group-hover:border-indigo-500'} flex items-center justify-center transition-colors`}>
                   {task.isCompleted && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                </div>
            </button>
            <div className="flex-grow cursor-pointer" onClick={onSelect}>
                <p className={`font-medium ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'} ${task.id.startsWith('optimistic_') ? 'opacity-60' : ''}`}>
                    <span className={priorityClasses[task.priority]}>{task.priority !== 'Medium' && `${'!'.repeat({Low:0,Medium:0,High:2,Critical:3}[task.priority])} `}</span>
                    {task.title}
                </p>
                {task.description && <p className="text-sm text-slate-500 mt-0.5 truncate">{task.description}</p>}
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500 mt-1">
                    {task.dueDate && <span className="text-xs font-semibold">{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>}
                    {task.isFlagged && <FlagIcon className="w-4 h-4 text-orange-500" />}
                </div>
            </div>
            <button onClick={onSelect} className="flex-shrink-0 h-8 w-8 flex items-center justify-center text-slate-400 group-hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <EditIcon className="w-5 h-5"/>
            </button>
        </li>
    );
};

const TaskDetailPanel: React.FC<{
    task: Task,
    catalogs: Catalog[],
    onSave: (data: Partial<Task>) => void,
    onClose: () => void,
    onDelete: (id: string) => void,
}> = ({ task, catalogs, onSave, onClose, onDelete }) => {
    
    const [formData, setFormData] = useState<Task>(task);
    useEffect(() => setFormData(task), [task]);
    
    const handleFieldChange = (field: keyof Task, value: any) => {
        const updatedTask = { ...formData, [field]: value };
        setFormData(updatedTask);
        if (!task.id.startsWith('optimistic_')) {
            onSave({ [field]: value });
        }
    };

    const handleSubtaskChange = (subtask: Subtask, index: number) => {
        const newSubtasks = [...formData.subtasks];
        newSubtasks[index] = subtask;
        handleFieldChange('subtasks', newSubtasks);
    };

    const addSubtask = () => {
        const newSubtask: Subtask = { id: Date.now().toString(), title: '', isCompleted: false };
        handleFieldChange('subtasks', [...formData.subtasks, newSubtask]);
    };

    return (
        <div className="fixed inset-y-0 right-0 bg-slate-50 w-full max-w-md shadow-2xl border-l border-slate-200 z-30 flex flex-col transform transition-transform duration-300 ease-in-out"
             onClick={e => e.stopPropagation()}>
            <header className="p-3 border-b border-slate-200 flex justify-end items-center flex-shrink-0 gap-2">
                 <button onClick={() => onDelete(task.id)} className="text-slate-500 hover:text-red-600 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200" disabled={task.id.startsWith('optimistic_')}><TrashIcon className="w-5 h-5"/></button>
                 <button onClick={onClose} className="text-slate-500 hover:text-slate-800 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><XIcon className="w-6 h-6"/></button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-5">
                 <div className="flex items-start gap-3">
                     <button onClick={() => handleFieldChange('isCompleted', !formData.isCompleted)} className="mt-1 flex-shrink-0" disabled={task.id.startsWith('optimistic_')}>
                        <div className={`h-6 w-6 rounded-full border-2 ${formData.isCompleted ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 hover:border-indigo-500'} flex items-center justify-center transition-colors`}>
                           {formData.isCompleted && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                    </button>
                    <input 
                        type="text" 
                        value={formData.title} 
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        onBlur={() => onSave({ title: formData.title })}
                        className="w-full text-xl font-bold border-none focus:ring-0 p-0 bg-transparent"
                        disabled={task.id.startsWith('optimistic_')}
                    />
                 </div>
                 <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    onBlur={() => onSave({ description: formData.description })}
                    placeholder="Add notes..."
                    rows={4}
                    className="w-full text-base p-2 ml-9 mt-2 border border-transparent rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-slate-100/0 focus:bg-white"
                    disabled={task.id.startsWith('optimistic_')}
                ></textarea>

                <div className="ml-9 mt-4 space-y-2">
                    {formData.subtasks.map((st, i) => (
                        <div key={st.id} className="flex items-center gap-2 group">
                             <input type="checkbox" checked={st.isCompleted} onChange={() => handleSubtaskChange({...st, isCompleted: !st.isCompleted}, i)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" disabled={task.id.startsWith('optimistic_')}/>
                             <input type="text" value={st.title} onChange={e => handleSubtaskChange({...st, title: e.target.value}, i)} className={`flex-grow text-sm p-1 border rounded bg-transparent focus:bg-white focus:border-indigo-300 ${st.isCompleted ? 'line-through text-slate-400' : ''} border-transparent hover:border-slate-200`} disabled={task.id.startsWith('optimistic_')} />
                        </div>
                    ))}
                    <button onClick={addSubtask} className="text-indigo-600 text-sm font-semibold hover:text-indigo-800" disabled={task.id.startsWith('optimistic_')}>+ Add subtask</button>
                </div>

                 <div className="mt-6 border-t border-slate-200 pt-4 space-y-3">
                    <DetailRow icon={<CalendarDaysIcon className="w-5 h-5 text-slate-500"/>}>
                        <input type="date" value={formData.dueDate?.split('T')[0] || ''} onChange={e => handleFieldChange('dueDate', e.target.value ? new Date(e.target.value).toISOString() : null)} className="w-full h-8 px-2 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 text-sm" disabled={task.id.startsWith('optimistic_')}/>
                    </DetailRow>
                    <DetailRow icon={<FlagIcon className="w-5 h-5 text-slate-500"/>}>
                        <label className="flex items-center justify-between w-full">
                            <span>Flag</span>
                             <button onClick={() => handleFieldChange('isFlagged', !formData.isFlagged)} className={`h-6 w-10 rounded-full p-1 transition-colors ${formData.isFlagged ? 'bg-orange-500' : 'bg-slate-300'}`} disabled={task.id.startsWith('optimistic_')}>
                                <div className={`h-4 w-4 bg-white rounded-full transition-transform ${formData.isFlagged ? 'translate-x-4' : 'translate-x-0'}`}></div>
                             </button>
                        </label>
                    </DetailRow>
                    <DetailRow icon={<span className="font-bold text-xl text-slate-500">!</span>}>
                        <select value={formData.priority} onChange={e => handleFieldChange('priority', e.target.value)} className="w-full h-8 px-2 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 text-sm" disabled={task.id.startsWith('optimistic_')}>
                            <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                        </select>
                    </DetailRow>
                    <DetailRow icon={<FolderIcon className="w-5 h-5 text-slate-500"/>}>
                         <select value={formData.catalogId} onChange={e => handleFieldChange('catalogId', e.target.value)} className="w-full h-8 px-2 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 text-sm" disabled={task.id.startsWith('optimistic_')}>
                            <option value="inbox">Inbox</option>
                            {catalogs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </DetailRow>
                 </div>
            </div>
        </div>
    );
};

const DetailRow: React.FC<{icon: React.ReactNode, children: React.ReactNode}> = ({icon, children}) => (
    <div className="flex items-center gap-4 text-base">
        <div className="w-6 text-center">{icon}</div>
        <div className="flex-1">{children}</div>
    </div>
)

export default TaskMaster;