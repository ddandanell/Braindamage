import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, where, getDoc, writeBatch, setDoc } from 'firebase/firestore';
import { KBFolder, KBNote } from '../types';
import Header from './Header';
import { FolderIcon, DocumentTextIcon, PlusIcon, EditIcon, TrashIcon, ChevronRightIcon, BoldIcon, ItalicIcon, UnderlineIcon, ListUlIcon, ListOlIcon, CodeIcon, QuoteIcon, MicrophoneIcon, XIcon, DotsVerticalIcon, TranslateIcon, PaletteIcon, LetterCaseUppercaseIcon, SpeakerWaveIcon, CircleIcon, SquareIcon, StarIcon, SettingsIcon, HighlightIcon, ResetIcon, ChevronLeftIcon } from './Icons';

// fix: Add types for Web Speech API to fix compile errors
interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: SpeechRecognitionEvent) => void;
    start(): void;
    stop(): void;
}
interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
    length: number;
}
interface SpeechRecognitionResult {
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
    length: number;
}
interface SpeechRecognitionAlternative {
    transcript: string;
}
declare var SpeechRecognition: { new(): SpeechRecognition };
declare var webkitSpeechRecognition: { new(): SpeechRecognition };


// --- HELPERS & UTILITIES ---
const FOLDER_ICONS: { [key: string]: React.FC<any> } = { default: FolderIcon, circle: CircleIcon, square: SquareIcon, star: StarIcon };
const FOLDER_COLORS: { [key: string]: string } = { default: 'text-slate-500', blue: 'text-blue-500', green: 'text-green-500', red: 'text-red-500', purple: 'text-purple-500', yellow: 'text-yellow-500' };
const INITIAL_GAP = 1000;

const sanitizeHTML = (html: string): string => {
  const allowedTags = ['b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'p', 'br', 'span', 'u'];
  const tagRegex = /<(\/?)([a-zA-Z0-9]+)\s*[^>]*>/g;
  return html.replace(tagRegex, (match, closing, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match.replace(/ on\w+="[^"]*"/g, ''); // Remove event handlers
    }
    return '';
  });
};

const extractDates = (text: string): string[] => {
  const out = new Set<string>();
  const re = /@(\d{4})-(\d{2})-(\d{2})\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d) {
       out.add(`${m[1]}-${m[2]}-${m[3]}`);
    }
  }
  return [...out];
};

const taskDocIdFor = (noteId: string, dateISO: string) => `${noteId}_${dateISO}`;

const computeInsertOrder = (prev?: number, next?: number): number | null => {
  if (prev == null && next == null) return INITIAL_GAP;
  if (prev == null) return Math.floor((next! - INITIAL_GAP) / 2);
  if (next == null) return prev + INITIAL_GAP;
  const mid = Math.floor((prev + next) / 2);
  return (mid === prev || mid === next) ? null : mid;
};

const reindexOrders = <T extends {id: string}>(items: T[]): Map<string, number> => {
    const map = new Map<string, number>();
    items.sort((a,b) => (a as any).order - (b as any).order).forEach((item, index) => {
        map.set(item.id, (index + 1) * INITIAL_GAP);
    });
    return map;
};

const isDescendant = (folders: KBFolder[], potentialParentId: string, potentialChildId: string): boolean => {
    if (potentialParentId === potentialChildId) return true;
    let currentId: string | null = potentialParentId;
    while(currentId) {
        const parentFolder = folders.find(f => f.id === currentId);
        if (!parentFolder) return false;
        if (parentFolder.parentId === potentialChildId) return true;
        currentId = parentFolder.parentId;
    }
    return false;
};

// --- HOOKS ---
const useSpeech = (onFinal: (text: string) => void) => {
    const recognitionRef = useRef<SpeechRecognition|null>(null);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognitionAPI) {
            const rec: SpeechRecognition = new SpeechRecognitionAPI();
            rec.continuous = true;
            rec.interimResults = false;
            rec.lang = 'en-US';

            rec.onresult = (e: SpeechRecognitionEvent) => {
                let finalText = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
                }
                if (finalText) onFinal(finalText);
            };
            recognitionRef.current = rec;
            setIsSupported(true);
        }
        return () => { try { recognitionRef.current?.stop(); } catch {} };
    }, [onFinal]);

    return {
        isSupported,
        start: () => recognitionRef.current?.start(),
        stop: () => recognitionRef.current?.stop(),
    };
};

const useScopedCollection = <T extends {id: string}>(
    collectionPath: string,
    field: string,
    value: string | null
) => {
    const [items, setItems] = useState<T[]>([]);
    useEffect(() => {
        const coll = collection(db, collectionPath);
        const q = query(coll, where(field, '==', value), orderBy('order', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
            setItems(data);
        });
        return () => unsubscribe();
    }, [collectionPath, field, value]);
    return items;
};

// --- MAIN COMPONENT ---
const KnowledgeBase: React.FC<{ user: User; initialNoteId: string | null; onNoteOpened: () => void; }> = ({ user, initialNoteId, onNoteOpened }) => {
    const [allFolders, setAllFolders] = useState<KBFolder[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [selectedNote, setSelectedNote] = useState<KBNote | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [recentlyDeleted, setRecentlyDeleted] = useState<{ item: (KBFolder & {type: 'folder'}) | (KBNote & {type: 'note'}), timerId: number} | null>(null);
    
    const foldersCollection = useMemo(() => collection(db, 'users', user.uid, 'kbFolders'), [user.uid]);

    useEffect(() => {
        const q = query(foldersCollection, orderBy('order', 'asc'));
        const unsub = onSnapshot(q, snapshot => setAllFolders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KBFolder))));
        return unsub;
    }, [foldersCollection]);
    
    useEffect(() => {
        if (initialNoteId && allFolders.length > 0) {
            getDoc(doc(db, 'users', user.uid, 'kbNotes', initialNoteId)).then(docSnap => {
                 if (docSnap.exists()) {
                    const noteToOpen = {id: docSnap.id, ...docSnap.data()} as KBNote;
                    setCurrentFolderId(noteToOpen.folderId);
                    setSelectedNote(noteToOpen);
                    onNoteOpened();
                }
            });
        }
    }, [initialNoteId, allFolders, user.uid, onNoteOpened]);
    
    const handleUndoDelete = () => {
        if (!recentlyDeleted) return;
        clearTimeout(recentlyDeleted.timerId);
        const { item } = recentlyDeleted;
        const collectionName = item.type === 'folder' ? 'kbFolders' : 'kbNotes';
        const docRef = doc(db, `users/${user.uid}/${collectionName}`, item.id);
        
        const { id, type, ...dataToRestore } = item as any;
        
        setDoc(docRef, dataToRestore);
        setRecentlyDeleted(null);
    };

    const path = useMemo(() => {
        if (!currentFolderId) return [{ id: null, name: 'Knowledge Base' }];
        const pathArray = [];
        let current = allFolders.find(f => f.id === currentFolderId);
        while(current) { pathArray.unshift(current); current = allFolders.find(f => f.id === current.parentId); }
        return [{ id: null, name: 'Knowledge Base' }, ...pathArray];
    }, [currentFolderId, allFolders]);
    
    if (selectedNote) {
        return <NoteEditor key={selectedNote.id} user={user} note={selectedNote} onClose={() => setSelectedNote(null)} />;
    }

    return (
        <div className="h-full flex flex-col">
            <Header title="Knowledge Base" subtitle="Your personal wiki with a file-explorer interface." />
            <div className="flex-grow flex border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden relative">
                <main className="flex-1 flex flex-col w-full">
                    <ContentPane user={user} path={path} allFolders={allFolders} currentFolderId={currentFolderId} onSelectFolder={setCurrentFolderId} onSelectNote={setSelectedNote} searchTerm={searchTerm} onSearchChange={setSearchTerm} setRecentlyDeleted={setRecentlyDeleted} />
                </main>
                {recentlyDeleted && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-4">
                        <span>Item deleted.</span>
                        <button onClick={handleUndoDelete} className="font-semibold text-indigo-400 hover:underline flex items-center gap-1"><ResetIcon className="w-4 h-4" /> Undo</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- CONTENT PANE ---
// fix: Correctly type the `setRecentlyDeleted` prop to fix a type inference issue that was causing the discriminated union type of a folder/note item to be lost, resulting in a compilation error.
const ContentPane: React.FC<{ user: User; path: {id: string | null, name: string}[]; allFolders: KBFolder[]; currentFolderId: string | null; onSelectFolder: (id: string | null) => void; onSelectNote: (note: KBNote) => void; searchTerm: string; onSearchChange: (term: string) => void; setRecentlyDeleted: (val: { item: (KBFolder & {type: 'folder'}) | (KBNote & {type: 'note'}), timerId: number} | null) => void; }> = ({ user, path, allFolders, currentFolderId, onSelectFolder, onSelectNote, searchTerm, onSearchChange, setRecentlyDeleted }) => {
    const [draggedItem, setDraggedItem] = useState<{ id: string, type: 'folder' | 'note' } | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState<KBFolder | null>(null);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    const foldersCollection = useMemo(() => collection(db, 'users', user.uid, 'kbFolders'), [user.uid]);
    const notesCollection = useMemo(() => collection(db, 'users', user.uid, 'kbNotes'), [user.uid]);
    
    const currentSubFolders = useScopedCollection<KBFolder>(`users/${user.uid}/kbFolders`, 'parentId', currentFolderId);
    const currentNotes = useScopedCollection<KBNote>(`users/${user.uid}/kbNotes`, 'folderId', currentFolderId);

    const combinedItems = useMemo(() => {
        const subFolders = currentSubFolders.map(f => ({ ...f, type: 'folder' as const }));
        const notes = currentNotes.map(n => ({ ...n, type: 'note' as const }));
        const allItems = [...subFolders, ...notes];
        
        if (!searchTerm) return allItems;
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        // If searching, we need to query and combine results, not just filter the current view
        return allItems.filter(item => {
             if (item.type === 'note') {
                return item.title.toLowerCase().includes(lowerSearchTerm) || sanitizeHTML(item.content).replace(/<[^>]+>/g, '').toLowerCase().includes(lowerSearchTerm);
             }
             return item.name.toLowerCase().includes(lowerSearchTerm);
        });
    }, [currentSubFolders, currentNotes, searchTerm]);

    const handleDrop = async (targetId: string | null) => {
        if (!draggedItem) return;
        const batch = writeBatch(db);
        const sourceItem = [...currentSubFolders, ...currentNotes].find(i => i.id === draggedItem.id);
        const targetItem = [...currentSubFolders, ...currentNotes].find(i => i.id === targetId);
        
        if (!sourceItem) return;

        // --- Handle Move ---
        if (targetItem && targetItem.type === 'folder' && dropTarget === targetId) { // Dropped ON a folder
            if (draggedItem.type === 'folder' && isDescendant(allFolders, draggedItem.id, targetId)) {
                alert("Cannot move a folder into itself or one of its children.");
                return;
            }
            const itemsInTargetFolder = [...allFolders.filter(f => f.parentId === targetId), ...currentNotes.filter(n => n.folderId === targetId)];
            const maxOrder = Math.max(0, ...itemsInTargetFolder.map(i => i.order));
            const newOrder = maxOrder + INITIAL_GAP;
            const collectionRef = draggedItem.type === 'folder' ? foldersCollection : notesCollection;
            const parentField = draggedItem.type === 'folder' ? 'parentId' : 'folderId';
            batch.update(doc(collectionRef, draggedItem.id), { [parentField]: targetId, order: newOrder });
        } 
        // --- Handle Reorder ---
        else {
            const reorderedList = combinedItems.filter(i => i.id !== draggedItem.id);
            const targetIndex = targetId ? reorderedList.findIndex(i => i.id === targetId) : reorderedList.length;

            const prevItem = reorderedList[targetIndex - 1];
            const nextItem = reorderedList[targetIndex];
            
            let newOrder = computeInsertOrder(prevItem?.order, nextItem?.order);
            
            if (newOrder === null) { // Re-index needed
                const reindexedMap = reindexOrders(reorderedList);
                reorderedList.forEach(item => {
                    const docRef = doc(item.type === 'folder' ? foldersCollection : notesCollection, item.id);
                    batch.update(docRef, { order: reindexedMap.get(item.id) });
                });
                newOrder = computeInsertOrder(reindexedMap.get(prevItem?.id!), reindexedMap.get(nextItem?.id!));
            }
            
            const sourceCollectionRef = draggedItem.type === 'folder' ? foldersCollection : notesCollection;
            batch.update(doc(sourceCollectionRef, draggedItem.id), { order: newOrder });
        }
        
        await batch.commit();
        setDraggedItem(null); setDropTarget(null);
    };

    const handleCreateNote = async () => {
        const maxOrder = Math.max(0, ...combinedItems.map(i => i.order));
        const newOrder = maxOrder + INITIAL_GAP;
        const docRef = await addDoc(notesCollection, { title: 'Untitled Note', content: '', folderId: currentFolderId, order: newOrder, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        const newDoc = await getDoc(docRef);
        onSelectNote({ id: newDoc.id, ...newDoc.data() } as KBNote);
    };
    
    // fix: Explicitly type the item parameter to preserve the discriminated union type.
    const handleDelete = async (item: (KBFolder & { type: 'folder' }) | (KBNote & { type: 'note' })) => {
        const type = item.type;
        const collectionRef = type === 'folder' ? foldersCollection : notesCollection;
        const docRef = doc(collectionRef, item.id);

        if (type === 'folder') {
            const hasContent = allFolders.some(f => f.parentId === item.id) || currentNotes.some(n => n.folderId === item.id);
            if (hasContent) { alert("Delete folder contents first."); return; }
        }
        if (!window.confirm(`Delete ${type} "${type==='folder' ? item.name : item.title}"?`)) return;

        // Optimistic delete
        // fix: Pass item directly instead of spreading to preserve the discriminated union type, which was causing errors on undo.
        setRecentlyDeleted({ item: item, timerId: window.setTimeout(() => {
            deleteDoc(docRef);
            setRecentlyDeleted(null);
        }, 5000)});
    };

    return (
        <div className="flex-1 flex flex-col"><header className="flex-shrink-0 h-14 border-b border-slate-200 px-4 flex justify-between items-center"><Breadcrumbs path={path} onNavigate={onSelectFolder} /><div className="flex items-center gap-2"><input type="text" value={searchTerm} onChange={e => onSearchChange(e.target.value)} placeholder="Search in folder..." className="h-9 px-3 w-48 text-sm border border-slate-300 rounded-lg" /><button onClick={handleCreateNote} className="h-9 px-3 text-sm font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100">New Note</button><button onClick={() => setIsCreatingFolder(true)} className="h-9 px-3 text-sm font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100">New Folder</button></div></header><div onDrop={() => handleDrop(null)} onDragOver={e => {e.preventDefault(); setDropTarget(null); }} className="flex-grow overflow-y-auto p-2"><ul className="space-y-1">{isCreatingFolder && <FolderInputRow parentId={currentFolderId} collectionRef={foldersCollection} onDone={() => setIsCreatingFolder(false)} order={Math.max(0, ...combinedItems.map(i => i.order)) + INITIAL_GAP} />}{combinedItems.map(item => (<ItemRow key={item.id} user={user} item={item} onSelectNote={onSelectNote} onSelectFolder={onSelectFolder} onSetDraggedItem={setDraggedItem} onDrop={handleDrop} onSetDropTarget={setDropTarget} dropTarget={dropTarget} onOpenSettings={setSettingsModalOpen} onDelete={handleDelete}/>))}{combinedItems.length === 0 && !isCreatingFolder && <p className="p-8 text-center text-slate-400">This folder is empty.</p>}</ul></div>{isSettingsModalOpen && <FolderSettingsModal folder={isSettingsModalOpen} onClose={() => setSettingsModalOpen(null)} collectionRef={foldersCollection}/>}</div>
    )
}

const FolderInputRow: React.FC<{ parentId: string | null, collectionRef: any, onDone: () => void, order: number }> = ({ parentId, collectionRef, onDone, order }) => {
    const [name, setName] = useState('New Folder');
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { inputRef.current?.select(); }, []);
    
    const handleAdd = async () => {
        if (name.trim()) {
            await addDoc(collectionRef, { name: name.trim(), parentId, order, createdAt: serverTimestamp() });
        }
        onDone();
    };

    return (
        <li className="flex items-center gap-3 p-2 rounded-lg">
            <FolderIcon className="w-6 h-6 text-slate-500 flex-shrink-0" />
            <input
                ref={inputRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleAdd}
                onKeyDown={e => {if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onDone();}}
                className="w-full h-7 px-2 text-base font-semibold border border-indigo-400 rounded bg-white"
            />
        </li>
    );
};

// fix: In ItemRow's props, explicitly typed the 'item' parameter for the 'onDelete' callback to preserve its discriminated union type. This fixes an issue where type information was lost, causing an error when accessing the 'type' property.
const ItemRow = React.memo<{
    user: User;
    item: (KBFolder & { type: 'folder' }) | (KBNote & { type: 'note' });
    onSelectNote: (note: KBNote) => void;
    onSelectFolder: (id: string | null) => void;
    onSetDraggedItem: (item: { id: string, type: 'folder' | 'note' } | null) => void;
    onDrop: (targetId: string) => void;
    onSetDropTarget: (id: string | null) => void;
    dropTarget: string | null;
    onOpenSettings: (folder: KBFolder) => void;
    onDelete: (item: (KBFolder & { type: 'folder' }) | (KBNote & { type: 'note' })) => void;
}>(({user, item, onSelectNote, onSelectFolder, onSetDraggedItem, onDrop, onSetDropTarget, dropTarget, onOpenSettings, onDelete}) => {
    const [renaming, setRenaming] = useState(false); const [name, setName] = useState(item.type === 'folder' ? item.name : item.title); const inputRef = useRef<HTMLInputElement>(null);
    const handleRename = async () => { if (!name.trim()) { setRenaming(false); return; } const field = item.type === 'folder' ? 'name' : 'title'; const collectionName = item.type === 'folder' ? 'kbFolders' : 'kbNotes'; await updateDoc(doc(db, `users/${user.uid}/${collectionName}`, item.id), { [field]: name }); setRenaming(false); }
    useEffect(() => { if (renaming) inputRef.current?.select(); }, [renaming]);
    const Icon = item.type === 'folder' ? (FOLDER_ICONS[item.icon || 'default'] || FolderIcon) : DocumentTextIcon;
    const colorClass = item.type === 'folder' ? (FOLDER_COLORS[item.color || 'default'] || 'text-slate-500') : 'text-slate-500';
    
    return (<li draggable onDragStart={() => onSetDraggedItem({ id: item.id, type: item.type })} onDragEnd={() => { onSetDraggedItem(null); onSetDropTarget(null); }} onDragOver={e => { e.preventDefault(); onSetDropTarget(item.id); }} onDrop={(e) => { e.stopPropagation(); onDrop(item.id); }} className={`flex items-center gap-3 p-2 rounded-lg group transition-all duration-200 ${item.type==='folder' && dropTarget===item.id ? 'bg-indigo-100 ring-2 ring-indigo-300' : 'hover:bg-slate-100'}`}><div className="flex items-center gap-3 flex-grow text-left cursor-pointer" onClick={() => (item.type === 'folder' ? onSelectFolder(item.id) : onSelectNote(item as KBNote))}><Icon className={`w-6 h-6 ${colorClass} flex-shrink-0`}/>{renaming ? <input ref={inputRef} value={name} onChange={e => setName(e.target.value)} onBlur={handleRename} onKeyDown={e => {if(e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false);}} className="w-full h-7 px-2 text-base font-semibold border border-indigo-400 rounded"/> : <span className="font-semibold text-slate-800">{item.type === 'folder' ? item.name : item.title}</span>}</div><ItemMenu onRename={() => setRenaming(true)} onDelete={() => onDelete(item)} onSettings={() => item.type === 'folder' && onOpenSettings(item as KBFolder)}/></li>);
});

const ItemMenu: React.FC<{onRename: () => void, onDelete: () => void, onSettings?: () => void}> = ({onRename, onDelete, onSettings}) => {
    const [isOpen, setIsOpen] = useState(false); const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false); }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
    return (<div className="relative" ref={menuRef}><button onClick={() => setIsOpen(o => !o)} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 opacity-0 group-hover:opacity-100"><DotsVerticalIcon className="w-5 h-5"/></button>{isOpen && (<div className="absolute z-10 top-full right-0 mt-1 w-36 bg-white border border-slate-200 shadow-lg rounded-lg py-1">{onSettings && <button onClick={() => { onSettings(); setIsOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"><SettingsIcon className="w-4 h-4"/> Settings</button>}<button onClick={() => { onRename(); setIsOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"><EditIcon className="w-4 h-4"/> Rename</button><button onClick={() => { onDelete(); setIsOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><TrashIcon className="w-4 h-4"/> Delete</button></div>)}</div>)
}

// --- EDITOR ---
const NoteEditor: React.FC<{ user: User, note: KBNote, onClose: () => void }> = ({ user, note, onClose }) => {
    const [content, setContent] = useState(note.content);
    const [title, setTitle] = useState(note.title);
    const [isListening, setIsListening] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const debounceTimeout = useRef<number | null>(null);
    const notesCollection = useMemo(() => collection(db, 'users', user.uid, 'kbNotes'), [user.uid]);
    const tasksCollection = useMemo(() => collection(db, 'users', user.uid, 'tasks'), [user.uid]);

    const handleAutoSave = useCallback((data: {title?: string, content?: string}) => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = window.setTimeout(async () => {
            const finalTitle = data.title ?? title;
            const finalContent = data.content ?? content;
            await updateDoc(doc(notesCollection, note.id), { ...data, updatedAt: serverTimestamp() });
            
            const dates = extractDates(sanitizeHTML(finalContent).replace(/<[^>]+>/g, ' '));
            await Promise.all(
              dates.map(async (dateStr) => {
                const id = taskDocIdFor(note.id, dateStr);
                await setDoc(doc(tasksCollection, id), {
                  title: `Task for: ${finalTitle}`,
                  description: `From note, due: ${dateStr}`,
                  dueDate: new Date(dateStr).toISOString(),
                  isCompleted: false,
                  catalogId: 'inbox',
                  priority: 'Medium',
                  subtasks: [],
                  tags: [],
                  sourceNoteId: note.id,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                }, { merge: true });
              })
            );

        }, 1000);
    }, [note.id, title, content, notesCollection, tasksCollection]);
    
    const onDictationResult = useCallback((text: string) => {
        if (editorRef.current) {
            editorRef.current.focus();
            document.execCommand('insertText', false, text);
            const newContent = editorRef.current.innerHTML || '';
            setContent(newContent);
            handleAutoSave({ content: newContent });
        }
    }, [handleAutoSave]);

    const { isSupported: speechSupported, start: startSpeech, stop: stopSpeech } = useSpeech(onDictationResult);

    const toggleListening = () => { if (isListening) { stopSpeech(); } else { startSpeech(); } setIsListening(!isListening); };

    const handleTranslate = async (language: 'Danish' | 'English') => {
        if (!editorRef.current?.textContent?.trim()) return;
        setIsTranslating(true);
        try {
            // This should be a call to a secure server endpoint (e.g., a Cloud Function)
            // const response = await fetch('/api/translate', { method: 'POST', body: JSON.stringify({ text: editorRef.current.textContent, language }) });
            // const data = await response.json();
            // For demo purposes, we simulate this.
            const simulatedResponse = `(Simulated Translation to ${language}) ${editorRef.current.textContent}`;
            if (editorRef.current) { editorRef.current.innerHTML = simulatedResponse.replace(/\n/g, '<br>'); const newContent = editorRef.current.innerHTML; setContent(newContent); handleAutoSave({ content: newContent }); }
        } catch (e) { console.error("Translation failed", e); alert("Translation failed. See console for details."); }
        setIsTranslating(false);
    };

    const handleReadAloud = () => { if (editorRef.current?.textContent) { const utterance = new SpeechSynthesisUtterance(editorRef.current.textContent); window.speechSynthesis.speak(utterance); }};
    const execCmd = (cmd: string, value?: string) => { document.execCommand(cmd, false, value); editorRef.current?.focus(); const newContent = editorRef.current?.innerHTML || ''; setContent(newContent); handleAutoSave({ content: newContent }); };
    
    return (
        <div className="h-full w-full flex flex-col bg-white">
            <header className="flex-shrink-0 h-14 border-b border-slate-200 px-4 flex justify-between items-center">
                <button onClick={onClose} className="flex items-center gap-2 font-semibold text-slate-600 hover:text-slate-900 p-2 -ml-2 rounded-lg">
                    <ChevronLeftIcon className="w-5 h-5"/>
                    <span>Back</span>
                </button>
            </header>
            <div className="flex-grow flex flex-col overflow-hidden">
                <input
                    type="text"
                    value={title}
                    onChange={e => {setTitle(e.target.value); handleAutoSave({title: e.target.value})}}
                    className="font-bold text-3xl w-full bg-transparent focus:outline-none px-6 pt-6 pb-4 flex-shrink-0"
                    placeholder="Untitled Note"
                />
                <div className="flex-shrink-0 px-4 pb-2 border-b border-slate-200 flex items-center gap-1 flex-wrap">
                    <EditorButton onClick={() => execCmd('bold')}><BoldIcon className="w-5 h-5"/></EditorButton>
                    <EditorButton onClick={() => execCmd('italic')}><ItalicIcon className="w-5 h-5"/></EditorButton>
                    <EditorButton onClick={() => execCmd('insertUnorderedList')}><ListUlIcon className="w-5 h-5"/></EditorButton>
                    <EditorButton onClick={() => {const size = prompt("Font size (1-7)"); if(size) execCmd('fontSize', size)}}><LetterCaseUppercaseIcon className="w-5 h-5"/></EditorButton>
                    <EditorButton onClick={() => {const color = prompt("Color name or hex"); if(color) execCmd('foreColor', color)}}><PaletteIcon className="w-5 h-5"/></EditorButton>
                    <EditorButton onClick={() => {const color = prompt("Color name or hex"); if(color) execCmd('backColor', color)}}><HighlightIcon className="w-5 h-5"/></EditorButton>
                    {speechSupported && <EditorButton onClick={toggleListening} active={isListening}><MicrophoneIcon className="w-5 h-5"/></EditorButton>}
                    <EditorButton onClick={handleReadAloud}><SpeakerWaveIcon className="w-5 h-5"/></EditorButton>
                    <div className="relative group inline-block">
                        <EditorButton onClick={() => {}}><TranslateIcon className="w-5 h-5"/></EditorButton>
                        <div className="absolute top-full left-0 mt-1 bg-white shadow-lg rounded-lg border p-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                            <button onClick={() => handleTranslate('English')} className="block w-full text-left px-2 py-1 text-sm rounded hover:bg-slate-100">English</button>
                            <button onClick={() => handleTranslate('Danish')} className="block w-full text-left px-2 py-1 text-sm rounded hover:bg-slate-100">Danish</button>
                        </div>
                    </div>
                </div>
                <div 
                    className="flex-grow overflow-y-auto p-6 prose prose-slate max-w-none focus:outline-none" 
                    ref={editorRef} 
                    contentEditable 
                    suppressContentEditableWarning 
                    onInput={() => { const newContent = editorRef.current?.innerHTML || ''; setContent(newContent); handleAutoSave({content: sanitizeHTML(newContent)}); }} 
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            </div>
             {isTranslating && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><p className="font-semibold">Translating...</p></div>}
        </div>
    );
};

const FolderSettingsModal: React.FC<{folder: KBFolder, onClose: () => void, collectionRef: any}> = ({folder, onClose, collectionRef}) => {
    const [data, setData] = useState({ name: folder.name, description: folder.description || '', color: folder.color || 'default', icon: folder.icon || 'default' });
    const handleSave = async () => { await updateDoc(doc(collectionRef, folder.id), data); onClose(); };
    return (<div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4" onClick={onClose}><div className="bg-white w-full max-w-md rounded-2xl shadow-lg flex flex-col" onClick={e=>e.stopPropagation()}><header className="p-4 border-b flex justify-between items-center"><h2 className="text-xl font-bold">Folder Settings</h2><button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><XIcon className="w-6 h-6"/></button></header><div className="p-6 space-y-4"><input value={data.name} onChange={e=>setData({...data, name: e.target.value})} className="w-full h-11 px-4 border border-slate-300 rounded-xl" /><textarea value={data.description} onChange={e=>setData({...data, description: e.target.value})} placeholder="Description..." rows={3} className="w-full p-3 border border-slate-300 rounded-xl"></textarea><div><p className="text-sm font-semibold text-slate-600 mb-2">Color</p><div className="flex gap-2">{Object.entries(FOLDER_COLORS).map(([name, className]) => <button key={name} onClick={()=>setData({...data, color: name})} className={`w-8 h-8 rounded-full ${className.replace('text-', 'bg-')} ${data.color === name ? 'ring-2 ring-offset-2 ring-indigo-500': ''}`}/>)}</div></div><div><p className="text-sm font-semibold text-slate-600 mb-2">Icon</p><div className="flex gap-2">{Object.entries(FOLDER_ICONS).map(([name, Icon]) => <button key={name} onClick={()=>setData({...data, icon: name})} className={`w-10 h-10 flex items-center justify-center rounded-lg ${data.icon === name ? 'bg-indigo-100 ring-2 ring-indigo-500': 'bg-slate-100'}`}><Icon className="w-6 h-6"/></button>)}</div></div></div><footer className="p-4 border-t flex justify-end"><button onClick={handleSave} className="h-10 px-5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Save</button></footer></div></div>);
};
const EditorButton: React.FC<{onClick: () => void, children: React.ReactNode, active?: boolean}> = ({onClick, children, active}) => (<button onMouseDown={e => e.preventDefault()} onClick={onClick} className={`h-9 w-9 flex items-center justify-center rounded-lg text-slate-600 ${active ? 'bg-red-100 text-red-700' : 'hover:bg-slate-100'}`}>{children}</button>);
const Breadcrumbs: React.FC<{ path: {id: string | null, name: string}[], onNavigate: (id: string | null) => void }> = ({ path, onNavigate }) => (<div className="flex items-center text-sm font-semibold text-slate-500 truncate">{path.map((p, i) => (<React.Fragment key={p.id ?? 'root'}><button onClick={() => onNavigate(p.id)} className="hover:text-indigo-600 p-1 -m-1 rounded truncate">{p.name}</button>{i < path.length - 1 && <span className="mx-2 flex-shrink-0">/</span>}</React.Fragment>))}</div>);

export default KnowledgeBase;