

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, where, writeBatch, Timestamp, CollectionReference, DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { WarGoal, Mission, ColorGroup, Subtask, WorkType, TeamMember, Principle, Contact, HistoryEntry, GoalDocument, GoalTransaction, GoalContact, Currency, TransactionType } from '../types';
import { ChevronLeftIcon, TrashIcon, XIcon, SettingsIcon, PlusIcon, EditIcon, PlusCircleIcon, FolderIcon, FolderOpenIcon, BriefcaseIcon, UsersGroupIcon, LightBulbIcon, DocumentTextIcon, UsersIcon, CurrencyDollarIcon, CalendarDaysIcon, ScaleIcon, RocketLaunchIcon, BullseyeIcon, HeartIcon, SparklesIcon, ExclamationTriangleIcon, UserPlusIcon, ExternalLinkIcon, DocumentDuplicateIcon, BanknotesIcon, UserCircleIcon } from './Icons';

// Renaming ColorGroup to WarCatalog conceptually for this component
type WarCatalog = ColorGroup;

// Helper function to process Firestore data and convert Timestamps
const processFirestoreData = <T extends { id: string }>(doc: DocumentSnapshot<DocumentData>): T => {
    const data = doc.data();
    if (!data) return { id: doc.id } as T;

    const convertTimestamps = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
        if (Array.isArray(obj)) return obj.map(item => convertTimestamps(item));

        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = convertTimestamps(obj[key]);
            }
        }
        return newObj;
    };
    return { id: doc.id, ...convertTimestamps(data) } as T;
};


const GoalModal: React.FC<{
    goal: WarGoal | 'new' | null;
    year: number;
    catalogs: WarCatalog[];
    onSave: (data: Omit<WarGoal, 'id'>) => Promise<void>;
    onClose: () => void;
    onDelete: (id: string) => void;
}> = ({ goal, year, catalogs, onSave, onClose, onDelete }) => {
    const isNew = goal === 'new';
    const [isSaving, setIsSaving] = useState(false);
    const getInitialData = useCallback(() => ({
        title: '', description: '', year, catalogId: catalogs[0]?.id || null, subtasks: [],
        whatToReach: '', howToReach: '', whyToTakeOn: '', financialTarget: 0, estimatedTime: '', knowledgeRequired: '', principles: [], team: [],
        documents: [], transactions: [], goalContacts: [],
    }), [year, catalogs]);

    const [formData, setFormData] = useState<Omit<WarGoal, 'id'>>(() => {
        if (isNew || !goal || typeof goal !== 'object') return getInitialData();
        const { id, ...rest } = goal;
        return rest;
    });
    
    useEffect(() => {
        if (goal && typeof goal === 'object') {
            const { id, ...rest } = goal;
            setFormData(rest);
        } else if (isNew) {
            setFormData(getInitialData());
        }
    }, [goal, isNew, getInitialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'number' ? parseFloat(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.title.trim() === '' || isSaving) return;
        setIsSaving(true);
        try {
            await onSave({ ...formData, year });
            await new Promise(resolve => setTimeout(resolve, 1200));
            onClose();
        } catch (error) {
            console.error("Failed to save goal:", error);
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-start p-4 overflow-y-auto" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-slate-50 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col my-8" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold">{isNew ? 'Create New Goal Folder' : 'Edit Goal Folder'}</h2>
                    <div className="flex items-center gap-2">
                        {!isNew && goal && typeof goal === 'object' && <button type="button" onClick={() => onDelete(goal.id)} className="text-slate-500 hover:text-red-600 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><TrashIcon className="w-5 h-5"/></button>}
                        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><XIcon className="w-6 h-6"/></button>
                    </div>
                </header>
                <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                    <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Goal Title" className="w-full text-2xl font-bold border-none focus:ring-0 p-0 bg-transparent" required />
                    <textarea name="description" value={formData.description} onChange={handleChange} rows={2} placeholder="Description..." className="w-full text-base p-3 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white"></textarea>
                    
                    <label className="block">
                        <span className="font-semibold text-slate-500 text-sm">Catalog / Folder</span>
                        <select name="catalogId" value={formData.catalogId || ''} onChange={handleChange} className="w-full h-10 px-3 mt-1 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500 focus:border-indigo-500" required>
                            {catalogs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                    <div className="pt-4 border-t border-slate-200">
                        <h3 className="font-bold text-lg mb-2">Strategy Details</h3>
                        <div className="space-y-3">
                            <textarea name="whatToReach" value={formData.whatToReach} onChange={handleChange} rows={3} placeholder="What is the final, measurable outcome I want to achieve?" className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white"></textarea>
                            <textarea name="howToReach" value={formData.howToReach} onChange={handleChange} rows={3} placeholder="What's my unique strategy to achieve this faster and better than anyone else?" className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white"></textarea>
                            <textarea name="whyToTakeOn" value={formData.whyToTakeOn} onChange={handleChange} rows={3} placeholder="Why am I doing this? What's the core motivation or reward?" className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white"></textarea>
                        </div>
                    </div>
                </div>
                <footer className="p-4 border-t border-slate-200 flex justify-end flex-shrink-0">
                    <button type="submit" disabled={isSaving} className="h-11 px-6 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]">
                        {isSaving ? ( <> <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg> <span>Saving...</span> </> ) : (isNew ? 'Create Goal' : 'Save Changes')}
                    </button>
                </footer>
            </form>
        </div>
    );
};

const CatalogSettingsModal: React.FC<{ catalogs: WarCatalog[]; collectionRef: CollectionReference<DocumentData>; onClose: () => void; }> = ({ catalogs, collectionRef, onClose }) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState('bg-slate-500');
    const colors = ['bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'];
    
    const predefinedCatalogs = useMemo(() => [
        { name: 'Projects', color: 'bg-sky-500' }, { name: 'Private Life', color: 'bg-emerald-500' }, { name: 'School', color: 'bg-amber-500' }, { name: 'Work', color: 'bg-slate-500' }, { name: 'Health & Fitness', color: 'bg-rose-500' }, { name: 'Finance', color: 'bg-green-500' }, { name: 'Home', color: 'bg-orange-500' }, { name: 'Creative', color: 'bg-violet-500' },
    ], []);

    const existingCatalogNames = useMemo(() => catalogs.map(c => c.name.toLowerCase()), [catalogs]);
    const suggestedCatalogs = useMemo(() => predefinedCatalogs.filter(pc => !existingCatalogNames.includes(pc.name.toLowerCase())), [predefinedCatalogs, existingCatalogNames]);

    const handleAddCustom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() === '' || existingCatalogNames.includes(name.trim().toLowerCase())) return;
        const data: DocumentData = { name: name.trim(), color, createdAt: serverTimestamp() };
        await addDoc(collectionRef, data);
        setName('');
    };
    
    const handleAddPredefined = async (predefinedCatalog: { name: string, color: string }) => {
        if (existingCatalogNames.includes(predefinedCatalog.name.toLowerCase())) return;
        // fix: Explicitly create the data object to avoid potential TypeScript inference issues with spread syntax.
        const data: DocumentData = { name: predefinedCatalog.name, color: predefinedCatalog.color, createdAt: serverTimestamp() };
        await addDoc(collectionRef, data);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this catalog? This cannot be undone.')) {
            await deleteDoc(doc(collectionRef, id));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Manage Catalogs</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><XIcon className="w-6 h-6"/></button>
                </header>
                <div className="p-4 max-h-[70vh] overflow-y-auto space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Suggestions</h3>
                        <div className="flex flex-wrap gap-2">
                            {suggestedCatalogs.map(sc => (
                                <button key={sc.name} onClick={() => handleAddPredefined(sc)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold">
                                    <span className={`w-3 h-3 rounded-full ${sc.color}`}></span>
                                    {sc.name}
                                    <PlusIcon className="w-4 h-4 text-slate-500"/>
                                </button>
                            ))}
                            {suggestedCatalogs.length === 0 && <p className="text-sm text-slate-500">All suggestions have been added.</p>}
                        </div>
                    </div>
                    <div className="border-t border-slate-200 pt-4">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Your Active Catalogs</h3>
                         <ul className="space-y-2">
                            {catalogs.map(c => (
                                <li key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 group">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-4 h-4 rounded-full ${c.color}`}></span>
                                        <span className="font-medium">{c.name}</span>
                                    </div>
                                    <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4"/></button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <form onSubmit={handleAddCustom} className="p-4 border-t border-slate-200 space-y-3">
                     <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Add Custom Catalog</h3>
                    <div className="flex gap-2">
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="New catalog name" className="flex-grow h-10 px-3 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500 focus:border-indigo-500" />
                        <button type="submit" className="h-10 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                        {colors.map(c => <button key={c} type="button" onClick={() => setColor(c)} className={`w-6 h-6 rounded-full ${c} ${color === c ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}></button>)}
                    </div>
                </form>
            </div>
        </div>
    );
};

const WorkTypeSettingsModal: React.FC<{ workTypes: WorkType[]; collectionRef: CollectionReference<DocumentData>; onClose: () => void; }> = ({ workTypes, collectionRef, onClose }) => {
    const [name, setName] = useState('');
    const predefinedWorkTypes = useMemo(() => ['Sales', 'Marketing', 'Market Research', 'Development', 'Design', 'Operations', 'Customer Support', 'HR', 'Finance', 'Strategy'], []);
    const existingWorkTypeNames = useMemo(() => workTypes.map(wt => wt.name.toLowerCase()), [workTypes]);
    const suggestedWorkTypes = useMemo(() => predefinedWorkTypes.filter(pwt => !existingWorkTypeNames.includes(pwt.toLowerCase())), [predefinedWorkTypes, existingWorkTypeNames]);

    const handleAddCustom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() === '' || existingWorkTypeNames.includes(name.trim().toLowerCase())) return;
        const data: DocumentData = { name: name.trim(), createdAt: serverTimestamp() };
        await addDoc(collectionRef, data);
        setName('');
    };

    const handleAddPredefined = async (workTypeName: string) => {
        if (existingWorkTypeNames.includes(workTypeName.toLowerCase())) return;
        const data: DocumentData = { name: workTypeName, createdAt: serverTimestamp() };
        await addDoc(collectionRef, data);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this work type?')) {
            await deleteDoc(doc(collectionRef, id));
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Manage Work Types</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><XIcon className="w-6 h-6"/></button>
                </header>
                <div className="p-4 max-h-[70vh] overflow-y-auto space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Suggestions</h3>
                        <div className="flex flex-wrap gap-2">
                             {suggestedWorkTypes.map(swt => (
                                <button key={swt} onClick={() => handleAddPredefined(swt)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold">
                                    {swt} <PlusIcon className="w-4 h-4 text-slate-500"/>
                                </button>
                            ))}
                            {suggestedWorkTypes.length === 0 && <p className="text-sm text-slate-500">All suggestions have been added.</p>}
                        </div>
                    </div>
                     <div className="border-t border-slate-200 pt-4">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Your Active Work Types</h3>
                        <ul className="space-y-2">
                            {workTypes.map(wt => (
                                <li key={wt.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 group">
                                    <span className="font-medium">{wt.name}</span>
                                    <button onClick={() => handleDelete(wt.id)} className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4"/></button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <form onSubmit={handleAddCustom} className="p-4 border-t border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Add Custom Work Type</h3>
                    <div className="flex gap-2">
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="New work type name" className="flex-grow h-10 px-3 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500 focus:border-indigo-500" />
                        <button type="submit" className="h-10 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Add</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ManagePeopleModal: React.FC<{ user: User; onClose: () => void; }> = ({ user, onClose }) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [editingContact, setEditingContact] = useState<Contact | 'new' | null>(null);
    const contactsCollection = useMemo(() => collection(db, 'users', user.uid, 'contacts'), [user.uid]);

    useEffect(() => {
        const q = query(contactsCollection, orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, snapshot => {
            setContacts(snapshot.docs.map(d => processFirestoreData<Contact>(d)));
        });
        return unsubscribe;
    }, [contactsCollection]);

    const handleSaveContact = async (contactData: Omit<Contact, 'id' | 'createdAt'>) => {
        if (editingContact && typeof editingContact === 'object') {
            await updateDoc(doc(contactsCollection, editingContact.id), contactData);
        } else {
            await addDoc(contactsCollection, { ...contactData, createdAt: serverTimestamp() });
        }
        setEditingContact(null);
    };

    const handleDeleteContact = async (contactId: string) => {
        if (window.confirm('Are you sure? This will remove the contact from your central CRM.')) {
            await deleteDoc(doc(contactsCollection, contactId));
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-lg flex flex-col h-[80vh]" onClick={e => e.stopPropagation()}>
                 <header className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold">Manage People (CRM)</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><XIcon className="w-6 h-6"/></button>
                </header>
                <div className="flex-grow flex overflow-hidden">
                    <div className="w-2/5 border-r border-slate-200 overflow-y-auto">
                        <div className="p-3 border-b border-slate-200">
                             <button onClick={() => setEditingContact('new')} className="w-full flex items-center justify-center gap-2 h-10 px-3 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors">
                                <PlusIcon className="w-4 h-4"/> Add New Person
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-200">
                           {contacts.map(c => (
                               <li key={c.id} onClick={() => setEditingContact(c)} className={`p-3 cursor-pointer ${editingContact && typeof editingContact === 'object' && editingContact.id === c.id ? 'bg-indigo-100' : 'hover:bg-slate-100'}`}>
                                   <p className="font-semibold">{c.name}</p>
                                   <p className="text-sm text-slate-500 truncate">{c.email}</p>
                               </li>
                           ))}
                        </ul>
                    </div>
                    <div className="w-3/5 overflow-y-auto p-6">
                        {editingContact ? (
                            <ContactForm key={typeof editingContact === 'object' ? editingContact.id : 'new'} contact={editingContact === 'new' ? null : editingContact} onSave={handleSaveContact} onDelete={handleDeleteContact} onCancel={() => setEditingContact(null)} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500">Select a contact to view/edit, or add a new one.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ContactForm: React.FC<{ contact: Contact | null; onSave: (data: Omit<Contact, 'id'|'createdAt'>) => void; onDelete: (id: string) => void; onCancel: () => void; }> = ({ contact, onSave, onDelete, onCancel }) => {
    const [formData, setFormData] = useState({ name: contact?.name || '', email: contact?.email || '', phone: contact?.phone || '', notes: contact?.notes || '' });
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-lg font-bold">{contact ? 'Edit Contact' : 'Add New Contact'}</h3>
            <input type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="Full Name" required className="w-full h-11 px-4 text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-indigo-500"/>
            <input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} placeholder="Email" className="w-full h-11 px-4 text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-indigo-500"/>
            <input type="tel" value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} placeholder="Phone" className="w-full h-11 px-4 text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-indigo-500"/>
            <textarea value={formData.notes} onChange={e => setFormData(p => ({...p, notes: e.target.value}))} rows={4} placeholder="Notes..." className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500"></textarea>
            <div className="flex justify-between items-center pt-2">
                <div>
                {!contact && <button type="button" onClick={onCancel} className="h-10 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>}
                {contact && <button type="button" onClick={() => onDelete(contact.id)} className="h-10 px-4 text-sm font-semibold text-red-600 hover:bg-red-100 rounded-lg">Delete</button>}
                </div>
                <button type="submit" className="h-10 px-5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Save Contact</button>
            </div>
        </form>
    );
};

const MissionModal: React.FC<{
    mission: Mission | { parentId: string, startDate?: string } | null;
    year: number;
    goals: WarGoal[];
    workTypes: WorkType[];
    onSave: (data: Omit<Mission, 'id'>) => void;
    onClose: () => void;
    onDelete: (id: string) => void;
}> = ({ mission, year, goals, workTypes, onSave, onClose, onDelete }) => {
    const isNew = !mission || !('id' in mission);
    
    const getInitialData = useCallback(() => {
        const startDate = (mission && !('id' in mission) && mission.startDate) ? new Date(mission.startDate) : new Date();
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        return {
            title: '', description: '', parentId: (mission && 'parentId' in mission) ? mission.parentId : (goals[0]?.id || ''),
            startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0],
            isCompleted: false, colorGroupId: null, priority: 'Normal' as 'Normal' | 'Urgent', subtasks: [], year,
            workTypeId: workTypes[0]?.id || ''
        };
    }, [mission, goals, workTypes, year]);

    const [formData, setFormData] = useState<Omit<Mission, 'id'>>(() => {
        if(isNew) return getInitialData();
        const m = mission as Mission;
        return { ...m, startDate: new Date(m.startDate).toISOString().split('T')[0], endDate: new Date(m.endDate).toISOString().split('T')[0] };
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.title.trim() === '' || !formData.parentId) return;
        onSave({ ...formData, startDate: new Date(formData.startDate).toISOString(), endDate: new Date(formData.endDate).toISOString() });
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-white w-full max-w-lg rounded-2xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold">{isNew ? 'Create New Mission' : 'Edit Mission'}</h2>
                    <div className="flex items-center gap-2">
                        {!isNew && <button type="button" onClick={() => onDelete((mission as Mission).id)} className="text-slate-500 hover:text-red-600 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><TrashIcon className="w-5 h-5"/></button>}
                        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><XIcon className="w-6 h-6"/></button>
                    </div>
                </header>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Mission Title" className="w-full text-xl font-bold border-none focus:ring-0 p-0 bg-transparent" required />
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block text-sm"><span className="font-semibold text-slate-500">Start Date</span><input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="w-full h-10 px-3 mt-1 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500" required /></label>
                        <label className="block text-sm"><span className="font-semibold text-slate-500">End Date</span><input type="date" name="endDate" value={formData.endDate} onChange={handleChange} className="w-full h-10 px-3 mt-1 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500" required /></label>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <label className="block text-sm"><span className="font-semibold text-slate-500">Parent Goal</span><select name="parentId" value={formData.parentId} onChange={handleChange} className="w-full h-10 px-3 mt-1 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500" required>{goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
                        <label className="block text-sm"><span className="font-semibold text-slate-500">Work Type</span><select name="workTypeId" value={formData.workTypeId} onChange={handleChange} className="w-full h-10 px-3 mt-1 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500">{workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name}</option>)}</select></label>
                     </div>
                     <label className="block text-sm"><span className="font-semibold text-slate-500">Priority</span><select name="priority" value={formData.priority} onChange={handleChange} className="w-full h-10 px-3 mt-1 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500"><option value="Normal">Normal</option><option value="Urgent">Urgent</option></select></label>
                </div>
                 <footer className="p-4 border-t border-slate-200 flex justify-end">
                    <button type="submit" className="h-11 px-6 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                        {isNew ? 'Create Mission' : 'Save Changes'}
                    </button>
                </footer>
            </form>
        </div>
    );
};

const SubtaskModal: React.FC<{
    data: { goal: WarGoal, subtask: Subtask | 'new' };
    workTypes: WorkType[];
    onClose: () => void;
    onSave: (goalId: string, subtasks: Subtask[]) => void;
}> = ({ data, workTypes, onClose, onSave }) => {
    const isNew = data.subtask === 'new';
    const [subtaskData, setSubtaskData] = useState<Subtask>(() => isNew ? { id: Date.now().toString(), title: '', isCompleted: false, reach: 0, revenueImpact: 0, strategicFit: 0, confidence: 75, effort: 0 } : { ...(data.subtask as Subtask) });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const numValue = type === 'number' || e.target.dataset.type === 'number' ? parseFloat(value) || 0 : value;
        setSubtaskData(prev => ({ ...prev, [name]: numValue }));
    };

    const riceScore = useMemo(() => {
        const { reach = 0, revenueImpact = 0, strategicFit = 0, confidence = 0, effort = 0 } = subtaskData;
        if (effort === 0) return '∞';
        const impact = (revenueImpact + strategicFit) / 2;
        const score = (reach * impact * (confidence / 100)) / effort;
        return score.toFixed(2);
    }, [subtaskData]);

    const handleSave = () => {
        if (subtaskData.title.trim() === '') return;
        let updatedSubtasks = isNew ? [...data.goal.subtasks, subtaskData] : data.goal.subtasks.map(st => st.id === subtaskData.id ? subtaskData : st);
        onSave(data.goal.id, updatedSubtasks);
    };
    
    const FormInput: React.FC<{label: string, name: keyof Subtask, type?: string, children?: React.ReactNode, value: any}> = ({ label, name, type = 'number', children, value }) => (
        <label className="block">
            <span className="font-semibold text-slate-600 text-sm">{label}</span>
            {children ? React.cloneElement(children as React.ReactElement, { name, value, onChange: handleChange }) : 
            <input type={type} name={name} value={value} onChange={handleChange} data-type="number" className="w-full h-10 px-3 mt-1 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500" />}
        </label>
    );

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-slate-50 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold">{isNew ? 'Create Sub-task' : 'Edit Sub-task'}</h2>
                    <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><XIcon className="w-6 h-6"/></button>
                </header>
                <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                    <FormInput label="Title" name="title" type="text" value={subtaskData.title}><input type="text" name="title" value={subtaskData.title} onChange={handleChange} required className="w-full h-10 px-3 mt-1 border border-slate-300 rounded-xl bg-white focus:ring-indigo-500" /></FormInput>
                    <div className="p-4 mt-4 rounded-xl bg-indigo-50 border border-indigo-200">
                        <h3 className="font-bold text-indigo-800 mb-3">RICE+ Scoring</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormInput label="Reach (e.g., users per month)" name="reach" value={subtaskData.reach || ''} />
                            <FormInput label="Revenue Impact (1-5)" name="revenueImpact" value={subtaskData.revenueImpact || ''} />
                            <FormInput label="Strategic Fit (1-5)" name="strategicFit" value={subtaskData.strategicFit || ''} />
                             <label className="block">
                                <span className="font-semibold text-slate-600 text-sm">Confidence (%)</span>
                                <input type="range" name="confidence" value={subtaskData.confidence || 75} onChange={handleChange} data-type="number" min="0" max="100" step="5" className="w-full mt-2" />
                                <div className="text-center font-bold">{subtaskData.confidence}%</div>
                            </label>
                            <FormInput label="Effort (person-hours)" name="effort" value={subtaskData.effort || ''} />
                            <div className="flex flex-col items-center justify-center bg-white p-3 rounded-xl border border-indigo-200">
                                <span className="font-semibold text-slate-600 text-sm">RICE+ Score</span>
                                <span className="text-3xl font-bold text-indigo-600 mt-1">{riceScore}</span>
                            </div>
                        </div>
                    </div>
                </div>
                 <footer className="p-4 border-t border-slate-200 flex justify-end">
                    <button type="button" onClick={handleSave} className="h-11 px-6 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Save Sub-task</button>
                </footer>
            </div>
        </div>
    );
};

const StrategySubtasks: React.FC<{
    goal: WarGoal;
    onUpdateSubtasks: (subtasks: Subtask[]) => void;
    onEditSubtask: (subtask: Subtask | 'new') => void;
}> = ({ goal, onUpdateSubtasks, onEditSubtask }) => {
    
    const handleToggleSubtask = (id: string) => {
        onUpdateSubtasks(goal.subtasks.map(st => st.id === id ? { ...st, isCompleted: !st.isCompleted } : st));
    };

    const handleDeleteSubtask = (id: string) => {
        if (window.confirm("Are you sure?")) {
            onUpdateSubtasks(goal.subtasks.filter(st => st.id !== id));
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Actionable Sub-tasks</h3>
                 <button onClick={() => onEditSubtask('new')} className="flex items-center gap-2 h-9 px-3 bg-indigo-100 text-indigo-700 rounded-lg font-semibold text-sm hover:bg-indigo-200">
                    <PlusIcon className="w-4 h-4"/> Add Sub-task
                </button>
            </div>
            <div className="space-y-2">
                {goal.subtasks.map(subtask => {
                    const { reach = 0, revenueImpact = 0, strategicFit = 0, confidence = 0, effort = 0 } = subtask;
                    const score = effort > 0 ? (reach * ((revenueImpact + strategicFit) / 2) * (confidence / 100)) / effort : 0;
                    return (
                        <div key={subtask.id} className="flex items-center gap-3 group p-2 rounded-lg hover:bg-slate-100">
                            <input type="checkbox" checked={subtask.isCompleted} onChange={() => handleToggleSubtask(subtask.id)} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>
                            <div className="flex-grow cursor-pointer" onClick={() => onEditSubtask(subtask)}>
                                <span className={subtask.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}>{subtask.title}</span>
                                { effort > 0 && <span className="ml-4 text-xs font-mono p-1 rounded bg-slate-200 text-slate-600">Score: {score.toFixed(1)}</span>}
                                { effort > 0 && <span className="ml-2 text-xs font-mono p-1 rounded bg-slate-200 text-slate-600">{subtask.effort}h</span>}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                <button onClick={() => onEditSubtask(subtask)} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-indigo-600"><EditIcon className="w-4 h-4"/></button>
                                <button onClick={() => handleDeleteSubtask(subtask.id)} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-red-600"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        </div>
                    )
                })}
            </div>
            {goal.subtasks.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No sub-tasks yet.</p>}
        </div>
    );
};

const GoalHistoryPanel: React.FC<{ user: User, goal: WarGoal }> = ({ user, goal }) => {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [newEntryText, setNewEntryText] = useState('');
    const [newEntryType, setNewEntryType] = useState<'success' | 'learning'>('success');
    const historyCollection = useMemo(() => collection(db, 'users', user.uid, 'warHistory'), [user.uid]);

    useEffect(() => {
        const q = query(historyCollection, where('goalId', '==', goal.id), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, snapshot => setHistory(snapshot.docs.map(d => processFirestoreData<HistoryEntry>(d))));
        return unsubscribe;
    }, [historyCollection, goal.id]);

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newEntryText.trim() === '') return;
        await addDoc(historyCollection, { goalId: goal.id, text: newEntryText.trim(), type: newEntryType, createdAt: serverTimestamp() });
        setNewEntryText('');
    };

    return (
        <div>
            <form onSubmit={handleAddEntry} className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h3 className="text-lg font-bold mb-3 text-slate-800">Add to Goal Diary</h3>
                <textarea value={newEntryText} onChange={(e) => setNewEntryText(e.target.value)} rows={3} placeholder="What happened? What did you learn?" className="w-full text-base p-3 border border-slate-300 rounded-xl bg-white" required />
                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setNewEntryType('success')} className={`px-3 py-1.5 text-sm font-semibold rounded-lg flex items-center gap-2 ${newEntryType === 'success' ? 'bg-green-100 text-green-800 ring-2 ring-green-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                            <SparklesIcon className="w-4 h-4" /> Success
                        </button>
                        <button type="button" onClick={() => setNewEntryType('learning')} className={`px-3 py-1.5 text-sm font-semibold rounded-lg flex items-center gap-2 ${newEntryType === 'learning' ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                            <ExclamationTriangleIcon className="w-4 h-4" /> Learning
                        </button>
                    </div>
                    <button type="submit" className="h-9 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 text-sm">Add Entry</button>
                </div>
            </form>
            <div className="space-y-4">
                {history.map(entry => (
                     <div key={entry.id} className={`p-4 rounded-xl border-l-4 ${entry.type === 'success' ? 'bg-green-50/70 border-green-500' : 'bg-amber-50/70 border-amber-500'}`}>
                        <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${entry.type === 'success' ? 'bg-green-100' : 'bg-amber-100'}`}>
                                {entry.type === 'success' ? <SparklesIcon className="w-5 h-5 text-green-600" /> : <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" />}
                            </div>
                            <div>
                                <p className="text-sm text-slate-800 whitespace-pre-wrap">{entry.text}</p>
                                <p className="text-xs text-slate-500 mt-2 font-medium">{new Date(entry.createdAt).toLocaleString()}</p>
                            </div>
                        </div>
                     </div>
                ))}
                {history.length === 0 && <p className="text-slate-500 text-center py-8">No history recorded for this goal yet.</p>}
            </div>
        </div>
    );
};

// Generic panel for other Goal Detail tabs
const GoalAssetPanel: React.FC<{
    goal: WarGoal;
    assetKey: 'documents' | 'transactions' | 'goalContacts';
    title: string;
    onUpdate: (updatedAssets: any[]) => void;
    renderForm: (onAdd: (newItem: any) => void) => React.ReactNode;
    renderItem: (item: any, onUpdateItem: (updatedItem: any) => void, onDeleteItem: () => void) => React.ReactNode;
}> = ({ goal, assetKey, title, onUpdate, renderForm, renderItem }) => {
    const assets = goal[assetKey] || [];

    const handleAdd = (newItem: any) => {
        onUpdate([...assets, { ...newItem, id: Date.now().toString() }]);
    };
    
    const handleUpdate = (updatedItem: any) => {
        onUpdate(assets.map((item: any) => item.id === updatedItem.id ? updatedItem : item));
    };

    const handleDelete = (itemId: string) => {
        onUpdate(assets.filter((item: any) => item.id !== itemId));
    };

    return (
        <div>
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h3 className="text-lg font-bold mb-3">{`Add New ${title.slice(0, -1)}`}</h3>
                {renderForm(handleAdd)}
            </div>
            <div className="space-y-3">
                {assets.map((item: any) => (
                    <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200">
                        {renderItem(item, (updated) => handleUpdate(updated), () => handleDelete(item.id))}
                    </div>
                ))}
                {assets.length === 0 && <p className="text-slate-500 text-center py-8">{`No ${title.toLowerCase()} added yet.`}</p>}
            </div>
        </div>
    );
};

const MonthCalendar: React.FC<{
    year: number,
    month: number,
    missions: Mission[],
    catalogs: WarCatalog[],
    onAddMission: (date: string) => void,
    onEditMission: (mission: Mission) => void
}> = ({ year, month, missions, catalogs, onAddMission, onEditMission }) => {
    const days = useMemo(() => {
        const date = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayIndex = date.getDay();
        const daysArray: (Date | null)[] = [];
        for (let i = 0; i < firstDayIndex; i++) daysArray.push(null);
        for (let i = 1; i <= daysInMonth; i++) daysArray.push(new Date(year, month, i));
        while (daysArray.length % 7 !== 0) daysArray.push(null);
        return daysArray;
    }, [year, month]);

    const getCatalogColor = (id: string | null) => catalogs.find(c => c.id === id)?.color || 'bg-slate-500';

    return (
        <div className="grid grid-cols-7 border-l border-t border-slate-200 bg-white">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-2 text-center text-sm font-semibold text-slate-600 border-b border-r border-slate-200">{day}</div>
            ))}
            {days.map((day, index) => (
                <div key={index} className="relative min-h-[120px] p-1.5 border-b border-r border-slate-200 group">
                    {day && (
                        <>
                            <span className={`text-sm font-semibold ${new Date().toDateString() === day.toDateString() ? 'bg-indigo-600 text-white rounded-full h-6 w-6 flex items-center justify-center' : 'text-slate-700'}`}>{day.getDate()}</span>
                            <button onClick={() => onAddMission(day.toISOString())} className="absolute top-1 right-1 h-6 w-6 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-indigo-200 hover:text-indigo-700"><PlusIcon className="w-4 h-4"/></button>
                            <div className="mt-1 space-y-1">
                                {missions.filter(m => {
                                    const missionStart = new Date(m.startDate); missionStart.setHours(0,0,0,0);
                                    const missionEnd = new Date(m.endDate); missionEnd.setHours(23,59,59,999);
                                    return day >= missionStart && day <= missionEnd;
                                }).map(m => (
                                    <button key={m.id} onClick={() => onEditMission(m)} className={`w-full text-left text-xs font-semibold p-1.5 rounded-md text-white truncate ${getCatalogColor(m.colorGroupId)}`}>{m.title}</button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};

const WeekCalendar: React.FC<{
    year: number,
    missions: Mission[],
    catalogs: WarCatalog[],
    onAddMission: (date: string) => void,
    onEditMission: (mission: Mission) => void
}> = ({ year, missions, catalogs, onAddMission, onEditMission }) => {
    const [weekStart, setWeekStart] = useState(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek;
        return new Date(today.setDate(diff));
    });

    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        return date;
    }), [weekStart]);

    const changeWeek = (direction: 'prev' | 'next') => {
        setWeekStart(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
            return newDate;
        });
    };

    const getCatalogColor = (id: string | null) => catalogs.find(c => c.id === id)?.color || 'bg-slate-500';

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => changeWeek('prev')} className="px-3 py-1 bg-white border rounded-md">&lt; Prev</button>
                <h3 className="font-bold text-lg">{`${weekDays[0].toLocaleDateString()} - ${weekDays[6].toLocaleDateString()}`}</h3>
                <button onClick={() => changeWeek('next')} className="px-3 py-1 bg-white border rounded-md">Next &gt;</button>
            </div>
             <div className="grid grid-cols-7 border-l border-t border-slate-200 bg-white">
                {weekDays.map(day => (
                    <div key={day.toISOString()} className="py-2 text-center text-sm font-semibold text-slate-600 border-b border-r border-slate-200">
                        {day.toLocaleDateString(undefined, { weekday: 'short' })} <span className="font-normal">{day.getDate()}</span>
                    </div>
                ))}
                {weekDays.map(day => (
                    <div key={day.toISOString()} className="relative min-h-[200px] p-1.5 border-b border-r border-slate-200 group">
                        <button onClick={() => onAddMission(day.toISOString())} className="absolute top-1 right-1 h-6 w-6 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-indigo-200 hover:text-indigo-700"><PlusIcon className="w-4 h-4"/></button>
                        <div className="mt-1 space-y-1">
                            {missions.filter(m => {
                                const missionStart = new Date(m.startDate); missionStart.setHours(0,0,0,0);
                                const missionEnd = new Date(m.endDate); missionEnd.setHours(23,59,59,999);
                                return day >= missionStart && day <= missionEnd;
                            }).map(m => (
                                <button key={m.id} onClick={() => onEditMission(m)} className={`w-full text-left text-xs font-semibold p-1.5 rounded-md text-white truncate ${getCatalogColor(m.colorGroupId)}`}>{m.title}</button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const ExecutionPlan: React.FC<{
    year: number,
    missions: Mission[],
    catalogs: WarCatalog[],
    onAddMission: (date: string) => void,
    onEditMission: (mission: Mission) => void
}> = ({ year, missions, catalogs, onAddMission, onEditMission }) => {
    const [view, setView] = useState<'week' | 'month'>('month');
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <button onClick={() => setView('week')} className={`px-4 py-2 text-sm font-semibold rounded-lg ${view === 'week' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>Week</button>
                    <button onClick={() => setView('month')} className={`px-4 py-2 text-sm font-semibold rounded-lg ${view === 'month' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>Month</button>
                </div>
                {view === 'month' && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentMonth(p => (p - 1 + 12) % 12)} className="px-3 py-1 bg-white border rounded-md">&lt;</button>
                        <h3 className="font-bold text-lg">{new Date(year, currentMonth).toLocaleString('default', { month: 'long' })}</h3>
                        <button onClick={() => setCurrentMonth(p => (p + 1) % 12)} className="px-3 py-1 bg-white border rounded-md">&gt;</button>
                    </div>
                )}
            </div>
            {view === 'month' ? (
                <MonthCalendar year={year} month={currentMonth} missions={missions} catalogs={catalogs} onAddMission={onAddMission} onEditMission={onEditMission} />
            ) : (
                <WeekCalendar year={year} missions={missions} catalogs={catalogs} onAddMission={onAddMission} onEditMission={onEditMission} />
            )}
        </div>
    );
};

const GoalDetailPanel: React.FC<{
    user: User;
    goal: WarGoal;
    onUpdateGoal: (id: string, data: Partial<WarGoal>) => void;
    onEditSubtask: (subtask: Subtask | 'new') => void;
}> = ({ user, goal, onUpdateGoal, onEditSubtask }) => {
    type Tab = 'strategy' | 'actions' | 'history' | 'documents' | 'economic' | 'contacts';
    const [activeTab, setActiveTab] = useState<Tab>('strategy');

    const tabs: {id: Tab, label: string, icon: React.FC<any>}[] = [
        { id: 'strategy', label: 'Strategy & Plan', icon: LightBulbIcon },
        { id: 'actions', label: 'Actions & Tasks', icon: RocketLaunchIcon },
        { id: 'history', label: 'History', icon: CalendarDaysIcon },
        { id: 'documents', label: 'Documents & Files', icon: DocumentDuplicateIcon },
        { id: 'economic', label: 'Economic', icon: BanknotesIcon },
        { id: 'contacts', label: 'Contact Persons', icon: UserCircleIcon }
    ];

    const handleUpdateAssets = (assetKey: 'documents' | 'transactions' | 'goalContacts', updatedAssets: any[]) => {
        onUpdateGoal(goal.id, { [assetKey]: updatedAssets });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
             <div className="mb-6">
                <h2 className="text-3xl font-bold">{goal.title}</h2>
                <p className="text-slate-600 mt-1">{goal.description}</p>
            </div>
            <div className="border-b border-slate-200 mb-6">
                <nav className="-mb-px flex space-x-6">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-3 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                            <tab.icon className="w-5 h-5"/> {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            <div>
                {activeTab === 'strategy' && (
                    <div className="space-y-4 max-w-3xl">
                        <StrategyDetailItem icon={BullseyeIcon} title="What to Achieve" content={goal.whatToReach} />
                        <StrategyDetailItem icon={RocketLaunchIcon} title="How to Reach It" content={goal.howToReach} />
                        <StrategyDetailItem icon={HeartIcon} title="Why Take It On" content={goal.whyToTakeOn} />
                    </div>
                )}
                {activeTab === 'actions' && <StrategySubtasks goal={goal} onUpdateSubtasks={(subtasks) => onUpdateGoal(goal.id, { subtasks })} onEditSubtask={onEditSubtask} />}
                {activeTab === 'history' && <GoalHistoryPanel user={user} goal={goal} />}
                {activeTab === 'documents' && <GoalAssetPanel goal={goal} assetKey="documents" title="Documents" onUpdate={(assets) => handleUpdateAssets('documents', assets)}
                    renderForm={(onAdd) => <DocumentForm onAdd={onAdd as (item: Omit<GoalDocument, 'id'>) => void} />}
                    renderItem={(item, onUpdate, onDelete) => <DocumentItem item={item} onUpdate={onUpdate} onDelete={onDelete} />}
                />}
                 {activeTab === 'economic' && <GoalAssetPanel goal={goal} assetKey="transactions" title="Transactions" onUpdate={(assets) => handleUpdateAssets('transactions', assets)}
                    renderForm={(onAdd) => <TransactionForm onAdd={onAdd as (item: Omit<GoalTransaction, 'id'>) => void} />}
                    renderItem={(item, _onUpdate, onDelete) => <TransactionItem item={item} onDelete={onDelete} />}
                />}
                 {activeTab === 'contacts' && <GoalAssetPanel goal={goal} assetKey="goalContacts" title="Contacts" onUpdate={(assets) => handleUpdateAssets('goalContacts', assets)}
                    renderForm={(onAdd) => <GoalContactForm onAdd={onAdd as (item: Omit<GoalContact, 'id'>) => void} />}
                    renderItem={(item, _onUpdate, onDelete) => <GoalContactItem item={item} onDelete={onDelete} />}
                />}
            </div>
        </div>
    );
};

const StrategyDetailItem: React.FC<{icon: React.FC<any>, title: string, content?: string}> = ({ icon: Icon, title, content}) => (
    <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Icon className="w-6 h-6 text-indigo-600"/>
        </div>
        <div>
            <h4 className="font-bold text-slate-800">{title}</h4>
            <p className="text-slate-600 mt-0.5 whitespace-pre-wrap">{content || 'Not defined.'}</p>
        </div>
    </div>
);

// Forms and Items for GoalAssetPanel
const DocumentForm: React.FC<{onAdd: (item: Omit<GoalDocument, 'id'>) => void}> = ({onAdd}) => {
    const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [url, setUrl] = useState('');
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onAdd({name, description: desc, url}); setName(''); setDesc(''); setUrl(''); };
    return <form onSubmit={handleSubmit} className="space-y-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="File Name" required className="w-full h-9 px-3 border border-slate-300 rounded-lg"/> <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" className="w-full h-9 px-3 border border-slate-300 rounded-lg"/> <input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." required className="w-full h-9 px-3 border border-slate-300 rounded-lg"/> <button type="submit" className="h-9 px-4 bg-indigo-600 text-white rounded-lg text-sm">Add Document</button></form>;
}
const DocumentItem: React.FC<{item: GoalDocument, onUpdate: (item: GoalDocument) => void, onDelete: () => void}> = ({item, onDelete}) => (
    <div className="flex justify-between items-center">
        <div><p className="font-semibold">{item.name}</p><p className="text-sm text-slate-500">{item.description}</p></div>
        <div className="flex items-center gap-2"><a href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon className="w-5 h-5"/></a><button onClick={onDelete}><TrashIcon className="w-5 h-5 text-red-500"/></button></div>
    </div>
);

const TransactionForm: React.FC<{onAdd: (item: Omit<GoalTransaction, 'id'>) => void}> = ({onAdd}) => {
    const [name, setName] = useState(''); const [amount, setAmount] = useState(0); const [currency, setCurrency] = useState<Currency>('IDR'); const [type, setType] = useState<TransactionType>('Expense (for my work)');
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onAdd({name, amount, currency, type, comment: '', date: new Date().toISOString()}); setName(''); setAmount(0); };
    return <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Item Name" required className="col-span-2 w-full h-9 px-3 border rounded-lg"/> <input type="number" value={amount} onChange={e=>setAmount(parseFloat(e.target.value))} placeholder="Amount" required className="w-full h-9 px-3 border rounded-lg"/> <select value={currency} onChange={e=>setCurrency(e.target.value as Currency)} className="w-full h-9 px-3 border rounded-lg"><option>IDR</option><option>USD</option><option>EUR</option><option>DKK</option></select> <select value={type} onChange={e=>setType(e.target.value as TransactionType)} className="col-span-2 w-full h-9 px-3 border rounded-lg"><option>Expense (for my work)</option><option>Income (money I got for work)</option></select> <button type="submit" className="h-9 px-4 bg-indigo-600 text-white rounded-lg text-sm col-span-2">Add Transaction</button></form>;
}
const TransactionItem: React.FC<{item: GoalTransaction, onDelete: () => void}> = ({item, onDelete}) => (
    <div className="flex justify-between items-center">
        <div><p className="font-semibold">{item.name}</p><p className={`text-sm ${item.type.startsWith('Expense') ? 'text-red-600' : 'text-green-600'}`}>{item.type}</p></div>
        <div className="flex items-center gap-4"><p className="font-bold">{new Intl.NumberFormat('en-US', {style:'currency', currency: item.currency}).format(item.amount)}</p><button onClick={onDelete}><TrashIcon className="w-5 h-5 text-red-500"/></button></div>
    </div>
);

const GoalContactForm: React.FC<{onAdd: (item: Omit<GoalContact, 'id'>) => void}> = ({onAdd}) => {
    const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState('');
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onAdd({name, email, role, phone: '', agreements: ''}); setName(''); setEmail(''); setRole(''); };
    return <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" required className="w-full h-9 px-3 border rounded-lg"/> <input value={role} onChange={e=>setRole(e.target.value)} placeholder="Role" required className="w-full h-9 px-3 border rounded-lg"/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required className="col-span-2 w-full h-9 px-3 border rounded-lg"/> <button type="submit" className="h-9 px-4 bg-indigo-600 text-white rounded-lg text-sm col-span-2">Add Contact</button></form>;
}
const GoalContactItem: React.FC<{item: GoalContact, onDelete: () => void}> = ({item, onDelete}) => (
     <div className="flex justify-between items-center">
        <div><p className="font-semibold">{item.name} <span className="text-sm font-normal text-slate-500">- {item.role}</span></p><p className="text-sm text-slate-500">{item.email}</p></div>
        <button onClick={onDelete}><TrashIcon className="w-5 h-5 text-red-500"/></button>
    </div>
);


export const WarPlanner: React.FC<{ user: User; onExit: () => void; }> = ({ user, onExit }) => {
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [goals, setGoals] = useState<WarGoal[]>([]);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [catalogs, setCatalogs] = useState<WarCatalog[]>([]);
    const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);

    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [editingGoal, setEditingGoal] = useState<WarGoal | 'new' | null>(null);
    const [editingMission, setEditingMission] = useState<Mission | { parentId: string, startDate?: string } | null>(null);
    const [editingSubtask, setEditingSubtask] = useState<{ goal: WarGoal, subtask: Subtask | 'new' } | null>(null);
    
    const [isCatalogSettingsOpen, setIsCatalogSettingsOpen] = useState(false);
    const [isWorkTypeSettingsOpen, setIsWorkTypeSettingsOpen] = useState(false);
    const [isPeopleModalOpen, setIsPeopleModalOpen] = useState(false);

    const goalsCollection = useMemo(() => collection(db, 'users', user.uid, 'warGoals'), [user.uid]);
    const missionsCollection = useMemo(() => collection(db, 'users', user.uid, 'warMissions'), [user.uid]);
    const catalogsCollection = useMemo(() => collection(db, 'users', user.uid, 'warCatalogs'), [user.uid]);
    const workTypesCollection = useMemo(() => collection(db, 'users', user.uid, 'workTypes'), [user.uid]);
    const contactsCollection = useMemo(() => collection(db, 'users', user.uid, 'contacts'), [user.uid]);

    useEffect(() => {
        const q = query(goalsCollection, where('year', '==', currentYear), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, snapshot => setGoals(snapshot.docs.map(doc => processFirestoreData<WarGoal>(doc))));
        return unsubscribe;
    }, [goalsCollection, currentYear]);

    useEffect(() => {
        const q = query(missionsCollection, where('year', '==', currentYear), orderBy('startDate', 'asc'));
        const unsubscribe = onSnapshot(q, snapshot => setMissions(snapshot.docs.map(doc => processFirestoreData<Mission>(doc))));
        return unsubscribe;
    }, [missionsCollection, currentYear]);
    
    useEffect(() => {
        const q = query(catalogsCollection, orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, snapshot => {
            const data = snapshot.docs.map(d => processFirestoreData<WarCatalog>(d));
            if (snapshot.empty) { // Seed default catalogs
                const batch = writeBatch(db);
                [{name:'Work',color:'bg-slate-500'},{name:'Personal',color:'bg-sky-500'},{name:'Projects',color:'bg-amber-500'}].forEach(c => {
                    const docRef = doc(catalogsCollection);
                    batch.set(docRef, {...c, createdAt: serverTimestamp()});
                });
                batch.commit();
            } else { setCatalogs(data); }
        });
        return unsubscribe;
    }, [catalogsCollection]);
    
    useEffect(() => {
        const q = query(workTypesCollection, orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, snapshot => {
             const data = snapshot.docs.map(d => processFirestoreData<WorkType>(d));
            if (snapshot.empty) { // Seed default work types
                const batch = writeBatch(db);
                ['Development', 'Marketing', 'Sales'].forEach(name => {
                    const docRef = doc(workTypesCollection);
                    batch.set(docRef, {name, createdAt: serverTimestamp()});
                });
                batch.commit();
            } else { setWorkTypes(data); }
        });
        return unsubscribe;
    }, [workTypesCollection]);

    const handleSaveGoal = async (data: Omit<WarGoal, 'id'>) => {
        if (editingGoal && typeof editingGoal === 'object' && editingGoal.id) {
            await updateDoc(doc(goalsCollection, editingGoal.id), data);
        } else {
            await addDoc(goalsCollection, { ...data, createdAt: serverTimestamp() });
        }
    };

    const handleDeleteGoal = async (id: string) => {
        if (window.confirm('Are you sure? This will delete the goal and ALL associated missions.')) {
            const batch = writeBatch(db);
            batch.delete(doc(goalsCollection, id));
            missions.filter(m => m.parentId === id).forEach(m => batch.delete(doc(missionsCollection, m.id)));
            await batch.commit();
            setSelectedGoalId(null);
        }
    };
    
    const handleSaveMission = async (data: Omit<Mission, 'id'>) => {
        if (editingMission && 'id' in editingMission) {
            await updateDoc(doc(missionsCollection, editingMission.id), data);
        } else {
            await addDoc(missionsCollection, { ...data, createdAt: serverTimestamp() });
        }
        setEditingMission(null);
    };

    const handleDeleteMission = async (id: string) => {
        await deleteDoc(doc(missionsCollection, id));
        setEditingMission(null);
    };

    const handleUpdateGoal = async (id: string, data: Partial<WarGoal>) => {
        await updateDoc(doc(goalsCollection, id), data);
    };
    
    const handleUpdateGoalSubtasks = async (goalId: string, subtasks: Subtask[]) => {
        await updateDoc(doc(goalsCollection, goalId), { subtasks });
        setEditingSubtask(null);
    };

    const groupedGoals = useMemo(() => {
        return catalogs.map(cat => ({
            ...cat,
            goals: goals.filter(g => g.catalogId === cat.id)
        })).filter(cat => cat.goals.length > 0);
    }, [goals, catalogs]);

    const selectedGoal = useMemo(() => goals.find(g => g.id === selectedGoalId), [goals, selectedGoalId]);

    return (
        <div className="flex h-screen w-screen bg-slate-100 text-slate-900 antialiased font-sans">
            <nav className="w-80 flex-shrink-0 bg-white/80 backdrop-blur-xl border-r border-slate-200 flex flex-col">
                <header className="h-[var(--topbar-h)] flex-shrink-0 flex items-center justify-between px-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                         <button onClick={onExit} className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"><ChevronLeftIcon className="h-5 w-5"/></button>
                         <h1 className="text-lg font-bold text-slate-800">War Planner</h1>
                    </div>
                     <button onClick={() => setEditingGoal('new')} className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200" title="New Goal"><PlusIcon className="h-6 w-6"/></button>
                </header>
                <div className="flex-grow p-3 space-y-4 overflow-y-auto">
                    {groupedGoals.map(group => (
                        <div key={group.id}>
                            <h2 className="text-sm font-bold text-slate-500 uppercase px-2 mb-2 flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${group.color}`}></span>
                                {group.name}
                            </h2>
                            <ul className="space-y-1">
                                {group.goals.map(goal => (
                                    <li key={goal.id}>
                                        <button onClick={() => setSelectedGoalId(goal.id)} className={`w-full text-left p-2 rounded-lg font-semibold text-base transition-colors flex justify-between items-center ${selectedGoalId === goal.id ? 'bg-indigo-100 text-indigo-800' : 'text-slate-700 hover:bg-slate-100'}`}>
                                            {goal.title}
                                            <button onClick={(e) => { e.stopPropagation(); setEditingGoal(goal); }}><EditIcon className="w-4 h-4 opacity-50 hover:opacity-100"/></button>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </nav>
            <main className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
                <header className="h-[var(--topbar-h)] flex-shrink-0 bg-slate-100/80 backdrop-blur-lg flex items-center justify-between px-4 sm:px-6 border-b border-slate-200">
                     <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentYear(y => y-1)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200 font-bold text-lg">&lt;</button>
                        <h2 className="text-xl font-bold">{currentYear}</h2>
                        <button onClick={() => setCurrentYear(y => y+1)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200 font-bold text-lg">&gt;</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsWorkTypeSettingsOpen(true)} className="h-9 px-3 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Manage Work Types</button>
                        <button onClick={() => setIsCatalogSettingsOpen(true)} className="h-9 px-3 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Manage Catalogs</button>
                        <button onClick={() => setIsPeopleModalOpen(true)} className="h-9 px-3 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"><UserPlusIcon className="w-4 h-4" /> Add People</button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto">
                    {selectedGoal ? (
                        <GoalDetailPanel user={user} goal={selectedGoal} onUpdateGoal={handleUpdateGoal} onEditSubtask={(subtask) => setEditingSubtask({ goal: selectedGoal, subtask })}/>
                    ) : (
                        <ExecutionPlan year={currentYear} missions={missions} catalogs={catalogs} onAddMission={(date) => setEditingMission({ parentId: goals[0]?.id || '', startDate: date })} onEditMission={(mission) => setEditingMission(mission)} />
                    )}
                </div>
            </main>
            {editingGoal && <GoalModal goal={editingGoal} year={currentYear} catalogs={catalogs} onSave={handleSaveGoal} onClose={() => setEditingGoal(null)} onDelete={handleDeleteGoal} />}
            {editingMission && <MissionModal mission={editingMission} year={currentYear} goals={goals} workTypes={workTypes} onSave={handleSaveMission} onClose={() => setEditingMission(null)} onDelete={handleDeleteMission} />}
            {isCatalogSettingsOpen && <CatalogSettingsModal catalogs={catalogs} collectionRef={catalogsCollection} onClose={() => setIsCatalogSettingsOpen(false)} />}
            {isWorkTypeSettingsOpen && <WorkTypeSettingsModal workTypes={workTypes} collectionRef={workTypesCollection} onClose={() => setIsWorkTypeSettingsOpen(false)} />}
            {editingSubtask && <SubtaskModal data={editingSubtask} workTypes={workTypes} onClose={() => setEditingSubtask(null)} onSave={handleUpdateGoalSubtasks} />}
            {isPeopleModalOpen && <ManagePeopleModal user={user} onClose={() => setIsPeopleModalOpen(false)} />}
        </div>
    );
};

export default WarPlanner;