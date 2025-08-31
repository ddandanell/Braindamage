

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebaseConfig';
// fix: Import `getDoc` from firestore to resolve "Cannot find name 'getDoc'" error.
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, where, setDoc, getDoc } from 'firebase/firestore';
import { Task, Catalog, Subtask, Folder } from '../types';
import { 
    ChevronLeftIcon, MenuIcon, FolderIcon, PlusIcon, LogOutIcon, ClockIcon, TrashIcon, XIcon,
    TodayIcon, CalendarDaysIcon, InboxIcon, FlagIcon, CheckCircleIcon, EditIcon, ChevronRightIcon,
    DocumentTextIcon
} from './Icons';
import { useAppStore } from '../store';

const TaskMaster: React.FC = () => {
    const { user, navigateToNote, setCurrentView } = useAppStore();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    
    const [currentView, setCurrentViewInternal] = useState<string>('today');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const tasksCollection = useMemo(() => user ? collection(db, 'users', user.uid, 'tasks') : null, [user]);
    const catalogsCollection = useMemo(() => user ? collection(db, 'users', user.uid, 'catalogs') : null, [user]);
    const foldersCollection = useMemo(() => user ? collection(db, 'users', user.uid, 'folders') : null, [user]);

    useEffect(() => {
        if (!tasksCollection) return;
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
        if (!catalogsCollection) return;
        const q = query(catalogsCollection, orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, snapshot => {
            let catalogsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString() } as Catalog));
            if (!catalogsData.some(c => c.id === 'inbox')) {
                const inbox = { id: 'inbox', name: 'Inbox', color: '#64748b', icon: 'Inbox', createdAt: new Date().toISOString() };
                setDoc(doc(catalogsCollection, 'inbox'), { name: 'Inbox', color: '#64748b', icon: 'Inbox', createdAt: serverTimestamp() }).catch(() => {});
                catalogsData.unshift(inbox);
            }
            setCatalogs(catalogsData);
        });
        return unsubscribe;
    }, [catalogsCollection]);

    useEffect(() => {
        if (!foldersCollection) return;
        const q = query(foldersCollection, orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, snapshot => {
            setFolders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString() } as Folder)));
        });
        return unsubscribe;
    }, [foldersCollection]);


    const handleSaveTask = useCallback(async (taskData: Partial<Task>) => {
        if (selectedTask && tasksCollection) {
            await updateDoc(doc(tasksCollection, selectedTask.id), taskData);
        }
    }, [tasksCollection, selectedTask]);

    const handleCreateTask = useCallback(async () => {
        if (!tasksCollection) return;
        let defaultCatalogId = 'inbox';
        if (currentView !== 'today' && currentView !== 'scheduled' && currentView !== 'all' && currentView !== 'flagged' && currentView !== 'completed' ) {
            if(catalogs.some(c => c.id === currentView)) {
                defaultCatalogId = currentView;
            }
        }
        
        const newTask: Omit<Task, 'id' | 'createdAt'> = {
            title: 'New Task', description: '', isCompleted: false, priority: 'Medium', dueDate: null, startDate: null,
            estimatedTime: null, energyLevel: null, catalogId: defaultCatalogId, tags: [], subtasks: [], isFlagged: false
        };
        const docRef = await addDoc(tasksCollection, { ...newTask, createdAt: serverTimestamp() });
        const newDoc = await getDoc(docRef);
        setSelectedTask({id: newDoc.id, ...newDoc.data()} as Task);

    }, [tasksCollection, currentView, catalogs]);


    const handleDeleteTask = useCallback(async (taskId: string) => {
        if (!tasksCollection) return;
        await deleteDoc(doc(tasksCollection, taskId));
        setSelectedTask(null);
    }, [tasksCollection]);

    const handleCreateFolder = async (name: string) => {
        if (name.trim() === '' || !foldersCollection) return;
        await addDoc(foldersCollection, { name: name.trim(), createdAt: serverTimestamp() });
    };

    const filteredTasks = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        switch (currentView) {
            case 'today': return tasks.filter(t => !t.isCompleted && t.dueDate && new Date(t.dueDate) <= today && new Date(t.dueDate) >= todayStart);
            case 'scheduled': return tasks.filter(t => !t.isCompleted && t.dueDate);
            case 'all': return tasks.filter(t => !t.isCompleted);
            case 'flagged': return tasks.filter(t => !t.isCompleted && t.isFlagged);
            case 'completed': return tasks.filter(t => t.isCompleted);
            default:
                const folder = folders.find(f => f.id === currentView);
                if (folder) {
                    const listIdsInFolder = catalogs.filter(c => c.folderId === folder.id).map(c => c.id);
                    return tasks.filter(t => !t.isCompleted && listIdsInFolder.includes(t.catalogId));
                }
                return tasks.filter(t => !t.isCompleted && t.catalogId === currentView);
        }
    }, [tasks, currentView, folders, catalogs]);
    
    const viewTitle = useMemo(() => {
        const smartListTitles = { today: 'Today', scheduled: 'Scheduled', all: 'All Tasks', flagged: 'Flagged', completed: 'Completed' };
        if (Object.keys(smartListTitles).includes(currentView)) return smartListTitles[currentView as keyof typeof smartListTitles];
        return catalogs.find(c => c.id === currentView)?.name || folders.find(f => f.id === currentView)?.name || "Tasks";
    }, [currentView, catalogs, folders]);

    if (!user) return <div>Authenticating...</div>

    return (
        <div className="flex h-screen w-screen bg-slate-100 text-slate-900 antialiased font-sans">
            <Sidebar 
                isOpen={isSidebarOpen} 
                onClose={() => setIsSidebarOpen(false)}
                onExit={() => setCurrentView('dashboard')}
                currentView={currentView}
                setCurrentView={setCurrentViewInternal}
                catalogs={catalogs}
                folders={folders}
                tasks={tasks}
                onAddFolder={handleCreateFolder}
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
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <ul className="space-y-2">
                         {filteredTasks.map(task => (
                            <TaskItem 
                                key={task.id} 
                                task={task} 
                                onSelect={() => setSelectedTask(task)}
                                onToggleComplete={async () => tasksCollection && await updateDoc(doc(tasksCollection, task.id), { isCompleted: !task.isCompleted })}
                                onNavigateToNote={navigateToNote}
                            />
                        ))}
                        {filteredTasks.length === 0 && (
                            <div className="text-center py-16 text-slate-500">No tasks in this list.</div>
                        )}
                    </ul>
                </div>
            </main>

            <AnimatePresence>
                {selectedTask && (
                    <TaskDetailPanel
                        key={selectedTask.id}
                        task={selectedTask}
                        catalogs={catalogs.filter(c => c.id !== 'inbox')}
                        onSave={handleSaveTask}
                        onClose={() => setSelectedTask(null)}
                        onDelete={handleDeleteTask}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// ... Sidebar, SidebarItem, TaskItem components remain largely the same

const Sidebar: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    onExit: () => void,
    currentView: string,
    setCurrentView: (view: string) => void,
    catalogs: Catalog[],
    folders: Folder[],
    tasks: Task[],
    onAddFolder: (name: string) => void;
}> = ({ isOpen, onClose, onExit, currentView, setCurrentView, catalogs, folders, tasks, onAddFolder }) => {
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
    const [isAddingFolder, setIsAddingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const folderInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAddingFolder) {
            folderInputRef.current?.focus();
        }
    }, [isAddingFolder]);

    const handleAddFolder = () => {
        if (newFolderName.trim()) {
            onAddFolder(newFolderName.trim());
        }
        setNewFolderName('');
        setIsAddingFolder(false);
    };

    const smartLists = [
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
            completed: 0,
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
                     <div className="flex items-center justify-between pr-1">
                        <h3 className="px-3 text-sm font-bold text-slate-600 mt-4 mb-2">My Lists</h3>
                        <button onClick={() => setIsAddingFolder(true)} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-300/60" title="Add new folder">
                            <PlusIcon className="w-4 h-4" />
                        </button>
                     </div>
                     <div className="space-y-1">
                        {isAddingFolder && <div className="px-1 py-1"><input ref={folderInputRef} type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onBlur={handleAddFolder} onKeyDown={(e) => { if (e.key === 'Enter') handleAddFolder(); if (e.key === 'Escape') { setNewFolderName(''); setIsAddingFolder(false);}}} placeholder="New folder name" className="w-full h-8 px-2 text-sm border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500"/></div>}
                        {folders.map(folder => (<div key={folder.id}><div onClick={() => setOpenFolders(p => ({...p, [folder.id]: !p[folder.id]}))} className="flex items-center w-full px-3 py-2 text-base font-medium rounded-lg text-left gap-2 transition-colors text-slate-700 hover:bg-slate-300/50 cursor-pointer"><ChevronRightIcon className={`w-4 h-4 transition-transform flex-shrink-0 ${openFolders[folder.id] ? 'rotate-90' : ''}`} /><FolderIcon className="w-5 h-5 flex-shrink-0"/><span className="truncate flex-1 font-semibold">{folder.name}</span></div>{openFolders[folder.id] && (<div className="pl-7 space-y-1">{catalogs.filter(c => c.folderId === folder.id).map(c => (<SidebarItem key={c.id} icon={<div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: c.color}} />} label={c.name} onClick={() => setCurrentView(c.id)} isActive={currentView === c.id} />))}</div>)}</div>))}
                        {catalogs.filter(c => !c.folderId).map(c => (<SidebarItem key={c.id} icon={<div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: c.color}} />} label={c.name} onClick={() => setCurrentView(c.id)} isActive={currentView === c.id} />))}
                     </div>
                </div>
            </div>
        </nav>
    );
};

const TaskItem: React.FC<{task: Task, onSelect: () => void, onToggleComplete: () => void, onNavigateToNote: (noteId: string) => void}> = ({ task, onSelect, onToggleComplete, onNavigateToNote }) => {
    const priorityBorderClasses = { 'Low': 'border-l-slate-400', 'Medium': 'border-l-transparent', 'High': 'border-l-orange-500', 'Critical': 'border-l-red-600' };
    return (<li className={`bg-white rounded-xl border border-slate-200/80 shadow-sm hover:border-indigo-400 transition-all flex items-start group border-l-4 ${priorityBorderClasses[task.priority]}`}><div className="p-3 flex items-start gap-3 w-full"><button onClick={(e) => { e.stopPropagation(); onToggleComplete(); }} className="mt-0.5 flex-shrink-0"><div className={`h-6 w-6 rounded-full border-2 ${task.isCompleted ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 group-hover:border-indigo-500'} flex items-center justify-center transition-colors`}>{task.isCompleted && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}</div></button><div className="flex-grow cursor-pointer" onClick={onSelect}><p className={`font-medium ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>{task.description && <p className="text-sm text-slate-500 mt-0.5 truncate">{task.description}</p>}<div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500 mt-1">{task.dueDate && <span className="text-xs font-semibold">{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>}{task.isFlagged && <FlagIcon className="w-4 h-4 text-orange-500" />}{task.sourceNoteId && (<button onClick={(e) => { e.stopPropagation(); onNavigateToNote(task.sourceNoteId!); }} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"><DocumentTextIcon className="w-4 h-4" /> Go to Note</button>)}</div></div><button onClick={onSelect} className="flex-shrink-0 h-8 w-8 flex items-center justify-center text-slate-400 group-hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"><EditIcon className="w-5 h-5"/></button></div></li>);
};

const TaskDetailPanel: React.FC<{ task: Task, catalogs: Catalog[], onSave: (data: Partial<Task>) => void, onClose: () => void, onDelete: (id: string) => void }> = ({ task, catalogs, onSave, onClose, onDelete }) => {
    // ... (rest of the component is the same, but now wrapped in motion.div)
    const [formData, setFormData] = useState<Task>(task);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const datePickerRef = useRef<HTMLDivElement>(null);
    useEffect(() => setFormData(task), [task]);
    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) { setIsDatePickerOpen(false); }}; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
    const handleFieldChange = (field: keyof Task, value: any) => { const updatedTask = { ...formData, [field]: value }; setFormData(updatedTask); onSave({ [field]: value }); };
    const handleSubtaskChange = (subtask: Subtask, index: number) => { const newSubtasks = [...formData.subtasks]; newSubtasks[index] = subtask; handleFieldChange('subtasks', newSubtasks); };
    const addSubtask = () => { const newSubtask: Subtask = { id: Date.now().toString(), title: '', isCompleted: false }; handleFieldChange('subtasks', [...formData.subtasks, newSubtask]); };
    
    return (<motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="fixed inset-y-0 right-0 bg-slate-50 w-full max-w-md shadow-2xl border-l border-slate-200 z-30 flex flex-col" onClick={e => e.stopPropagation()}><header className="p-3 border-b border-slate-200 flex justify-end items-center flex-shrink-0 gap-2"><button onClick={() => onDelete(task.id)} className="text-slate-500 hover:text-red-600 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><TrashIcon className="w-5 h-5"/></button><button onClick={onClose} className="text-slate-500 hover:text-slate-800 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><XIcon className="w-6 h-6"/></button></header><div className="flex-1 overflow-y-auto p-5"><div className="flex items-start gap-3"><button onClick={() => handleFieldChange('isCompleted', !formData.isCompleted)} className="mt-1 flex-shrink-0"><div className={`h-6 w-6 rounded-full border-2 ${formData.isCompleted ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 hover:border-indigo-500'} flex items-center justify-center transition-colors`}>{formData.isCompleted && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}</div></button><input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} onBlur={() => onSave({ title: formData.title })} className="w-full text-xl font-bold border-none focus:ring-0 p-0 bg-transparent"/></div><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} onBlur={() => onSave({ description: formData.description })} placeholder="Add notes..." rows={4} className="w-full text-base p-2 ml-9 mt-2 border border-transparent rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-slate-100/0 focus:bg-white"></textarea><div className="ml-9 mt-4 space-y-2">{formData.subtasks.map((st, i) => (<div key={st.id} className={`flex items-center gap-2 group ${st.isCompleted ? 'opacity-70' : ''}`}><input type="checkbox" checked={st.isCompleted} onChange={() => handleSubtaskChange({...st, isCompleted: !st.isCompleted}, i)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/><input type="text" value={st.title} onChange={e => handleSubtaskChange({...st, title: e.target.value}, i)} onBlur={() => onSave({ subtasks: formData.subtasks })} className={`flex-grow text-sm p-1 border rounded bg-transparent focus:bg-white focus:border-indigo-300 ${st.isCompleted ? 'line-through text-slate-500' : 'text-slate-800'} border-transparent hover:border-slate-200`} /></div>))}<button onClick={addSubtask} className="text-indigo-600 text-sm font-semibold hover:text-indigo-800">+ Add subtask</button></div><div className="mt-6 border-t border-slate-200 pt-4 space-y-3"><DetailRow icon={<CalendarDaysIcon className="w-5 h-5 text-slate-500"/>}><div className="relative" ref={datePickerRef}><button onClick={() => setIsDatePickerOpen(o => !o)} className="w-full h-8 px-2 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 text-sm text-left">{formData.dueDate ? new Date(formData.dueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : <span className="text-slate-400">Set due date</span>}</button>{isDatePickerOpen && (<DatePicker value={formData.dueDate} onChange={(date) => handleFieldChange('dueDate', date)} onClose={() => setIsDatePickerOpen(false)}/>)}</div></DetailRow><DetailRow icon={<FlagIcon className="w-5 h-5 text-slate-500"/>}><label className="flex items-center justify-between w-full"><span>Flag</span><button onClick={() => handleFieldChange('isFlagged', !formData.isFlagged)} className={`h-6 w-10 rounded-full p-1 transition-colors ${formData.isFlagged ? 'bg-orange-500' : 'bg-slate-300'}`}><div className={`h-4 w-4 bg-white rounded-full transition-transform ${formData.isFlagged ? 'translate-x-4' : 'translate-x-0'}`}></div></button></label></DetailRow><DetailRow icon={<span className="font-bold text-xl text-slate-500">!</span>}><select value={formData.priority} onChange={e => handleFieldChange('priority', e.target.value)} className="w-full h-8 px-2 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 text-sm"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></DetailRow><DetailRow icon={<FolderIcon className="w-5 h-5 text-slate-500"/>}><select value={formData.catalogId} onChange={e => handleFieldChange('catalogId', e.target.value)} className="w-full h-8 px-2 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 text-sm"><option value="inbox">Inbox</option>{catalogs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></DetailRow></div></div></motion.div>);
};

const DetailRow: React.FC<{icon: React.ReactNode, children: React.ReactNode}> = ({icon, children}) => (<div className="flex items-center gap-4 text-base"><div className="w-6 text-center">{icon}</div><div className="flex-1">{children}</div></div>);
const SidebarItem: React.FC<{label: string, icon: React.ReactNode, count?: number, isActive: boolean, onClick: () => void}> = ({ label, icon, count, isActive, onClick }) => (<button onClick={onClick} className={`flex items-center w-full px-3 py-2 text-base font-medium rounded-lg text-left gap-3.5 transition-colors ${isActive ? 'bg-indigo-600 text-white shadow' : 'text-slate-700 hover:bg-slate-300/50'}`}><span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span><span className="truncate flex-1 font-semibold">{label}</span>{count != null && count > 0 && <span className="text-sm font-bold">{count}</span>}</button>);
const DatePicker: React.FC<{ value: string | null; onChange: (date: string | null) => void; onClose: () => void; }> = ({ value, onChange, onClose }) => { const selectedDate = value ? new Date(value) : null; if (selectedDate) selectedDate.setUTCHours(12); const [displayDate, setDisplayDate] = useState(selectedDate || new Date()); const daysInMonth = useMemo(() => { const date = new Date(Date.UTC(displayDate.getUTCFullYear(), displayDate.getUTCMonth(), 1)); const days = []; while (date.getUTCMonth() === displayDate.getUTCMonth()) { days.push(new Date(date)); date.setUTCDate(date.getUTCDate() + 1); } return days; }, [displayDate]); const startingDayOfMonth = useMemo(() => new Date(Date.UTC(displayDate.getUTCFullYear(), displayDate.getUTCMonth(), 1)).getUTCDay(), [displayDate]); const changeMonth = (amount: number) => { setDisplayDate(prev => { const newDate = new Date(prev); newDate.setUTCMonth(newDate.getUTCMonth() + amount); return newDate; }); }; const handleDayClick = (day: Date) => { onChange(day.toISOString()); onClose(); }; return (<div className="absolute z-10 top-full mt-2 right-0 bg-white shadow-lg border border-slate-200 rounded-2xl p-3 w-72"><div className="flex justify-between items-center mb-2 px-1"><button type="button" onClick={() => changeMonth(-1)} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><ChevronLeftIcon className="w-5 h-5"/></button><div className="font-semibold text-sm">{displayDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</div><button type="button" onClick={() => changeMonth(1)} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><ChevronRightIcon className="w-5 h-5"/></button></div><div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 font-medium my-2">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d}>{d}</div>)}</div><div className="grid grid-cols-7 gap-1">{Array(startingDayOfMonth).fill(null).map((_, i) => <div key={`empty-${i}`}></div>)}{daysInMonth.map(day => { const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString(); const isToday = day.toDateString() === new Date().toDateString(); return (<button key={day.toISOString()} type="button" onClick={() => handleDayClick(day)} className={`h-8 w-8 rounded-full text-sm flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 text-white font-bold' : ''} ${!isSelected && isToday ? 'bg-slate-200 text-slate-800 font-semibold' : ''} ${!isSelected ? 'hover:bg-slate-100 text-slate-700' : ''}`}>{day.getUTCDate()}</button>)})}</div><div className="mt-2 pt-2 border-t border-slate-200"><button type="button" onClick={() => { onChange(null); onClose(); }} className="w-full text-center text-sm font-semibold text-red-600 hover:bg-red-50 p-1.5 rounded-md">Clear Date</button></div></div>); };

export default TaskMaster;