import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebaseConfig';
import {
  collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Contact } from '../types';
import Header from './Header';
import { PlusIcon, EditIcon, TrashIcon, XIcon } from './Icons';
import { useAppStore } from '../store';

// ---- Helpers --------------------------------------------------------------

type PartialContact = Omit<Contact, 'id' | 'createdAt'> & {
  company?: string;
  tags?: string[];
  status?: 'New' | 'Contacted' | 'Won' | 'Lost';
  reminderAt?: string | null; // ISO date (yyyy-mm-dd) for simplicity
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function safeISO(ts?: unknown): string {
  try {
    if (ts && typeof (ts as any).toDate === 'function') return (ts as any).toDate().toISOString();
    if (typeof ts === 'string') return new Date(ts).toISOString();
  } catch {}
  return new Date().toISOString();
}

function normalizePhoneForWA(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

function csvEscape(val: string | undefined | null) {
  const s = (val ?? '').toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = smartSplitCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = smartSplitCSVLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = (cols[i] ?? '').trim()));
    return row;
  });
}
function smartSplitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') { inQuotes = true; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

// ---- Component ------------------------------------------------------------

const CRM: React.FC = () => {
  const user = useAppStore(state => state.user);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name'>('createdAt');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const contactsCollection = useMemo(
    () => user ? collection(db, 'users', user.uid, 'contacts') : null,
    [user]
  );

  useEffect(() => {
    if (!contactsCollection) return;
    const q = query(contactsCollection, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const contactsData = snapshot.docs.map(d => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
            createdAt: safeISO(data?.createdAt),
            tags: Array.isArray(data?.tags) ? data.tags : [],
            status: data?.status ?? 'New',
            company: data?.company ?? '',
            reminderAt: data?.reminderAt ?? null,
            notes: data?.notes ?? '',
            name: data?.name ?? '',
            email: data?.email ?? '',
            phone: data?.phone ?? '',
          } as Contact & PartialContact;
        });
        setContacts(contactsData);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [contactsCollection]);

  const handleSaveContact = async (contactData: PartialContact) => {
    if (!contactsCollection) return;
    try {
      if (editingContact) {
        await updateDoc(doc(contactsCollection, editingContact.id), contactData as any);
      } else {
        await addDoc(contactsCollection, { ...contactData, createdAt: serverTimestamp() } as any);
      }
      setIsModalOpen(false);
      setEditingContact(null);
    } catch (err: any) {
      alert(`Failed to save contact: ${err?.message ?? err}`);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!contactsCollection) return;
    if (!window.confirm(`Delete this contact permanently?`)) return;
    try {
      await deleteDoc(doc(contactsCollection, contactId));
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message ?? err}`);
    }
  };

  const openAddModal = () => {
    setEditingContact(null);
    setIsModalOpen(true);
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setIsModalOpen(true);
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => (c as any).tags?.forEach((t: string) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    let list = contacts.filter(c => {
      const cc = c as Contact & PartialContact;
      const matchesTerm =
        !term ||
        cc.name?.toLowerCase().includes(term) ||
        cc.email?.toLowerCase().includes(term) ||
        cc.phone?.toLowerCase().includes(term) ||
        cc.company?.toLowerCase().includes(term);
      const matchesTag = !tagFilter || (cc.tags ?? []).includes(tagFilter);
      const matchesStatus = !statusFilter || (cc.status ?? 'New') === statusFilter;
      return matchesTerm && matchesTag && matchesStatus;
    });
    if (sortBy === 'name') {
      list = list.slice().sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    } else {
      list = list.slice().sort((a, b) => {
        const ad = new Date((a as any).createdAt ?? 0).getTime();
        const bd = new Date((b as any).createdAt ?? 0).getTime();
        return bd - ad;
      });
    }
    return list;
  }, [contacts, debouncedSearchTerm, tagFilter, statusFilter, sortBy]);

  const exportCSV = () => {
    const header = [
      'name','email','phone','company','tags','status','notes','reminderAt','createdAt','id'
    ];
    const rows = filteredContacts.map((c: any) => [
      csvEscape(c.name),
      csvEscape(c.email),
      csvEscape(c.phone),
      csvEscape(c.company),
      csvEscape((c.tags ?? []).join('|')),
      csvEscape(c.status ?? 'New'),
      csvEscape(c.notes ?? ''),
      csvEscape(c.reminderAt ?? ''),
      csvEscape(c.createdAt ?? ''),
      csvEscape(c.id ?? ''),
    ].join(','));
    const blob = new Blob([header.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = async (file: File) => {
    if (!contactsCollection) return;
    const text = await file.text();
    const rows = parseCSV(text);
    const toAdd: PartialContact[] = rows.map(r => ({
      name: r.name || '',
      email: r.email || '',
      phone: r.phone || '',
      company: r.company || '',
      tags: (r.tags || '').split('|').map(s => s.trim()).filter(Boolean),
      status: (['New','Contacted','Won','Lost'].includes(r.status) ? r.status : 'New') as any,
      notes: r.notes || '',
      reminderAt: r.reminderAt || null,
    }));
    for (const row of toAdd) {
      try {
        await addDoc(contactsCollection, { ...row, createdAt: serverTimestamp() } as any);
      } catch (err: any) {
        alert(`Failed to import a row: ${err?.message ?? err}`);
      }
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <Header title="CRM" subtitle="Manage your professional and personal contacts." />

      <div className="mb-6 grid gap-3 md:flex md:items-center md:justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search name, email, phone, company…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-11 px-4 text-base text-slate-900 placeholder-slate-500 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full md:w-80"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 h-11 px-5 bg-indigo-600 text-white rounded-xl font-semibold text-base hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5"/>
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading contacts…</p>
        ) : filteredContacts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-slate-700 font-medium mb-2">No contacts found</p>
            <p className="text-slate-500 text-sm">Try adjusting search or filters, or add a new contact.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filteredContacts.map((contact: any) => {
              const waNumber = normalizePhoneForWA(contact.phone ?? '');
              const due =
                contact.reminderAt &&
                new Date(contact.reminderAt).setHours(23,59,59,999) < Date.now();
              return (
                <li key={contact.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 truncate">{contact.name || '—'}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-600 mt-1">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                      )}
                      {contact.phone && (
                        <>
                          <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="hover:underline">
                            WhatsApp
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEditModal(contact)}
                      className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded-lg"
                      title="Edit"
                    >
                      <EditIcon className="w-5 h-5"/>
                    </button>
                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-slate-200 rounded-lg"
                      title="Delete"
                    >
                      <TrashIcon className="w-5 h-5"/>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <ContactModal
            contact={editingContact}
            onSave={handleSaveContact}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ContactModal: React.FC<{
  contact: Contact | null;
  onSave: (data: PartialContact) => Promise<void>;
  onClose: () => void;
}> = ({ contact, onSave, onClose }) => {
  // fix: Initialize all fields for PartialContact to satisfy the type, especially the required 'notes' field.
  const [formData, setFormData] = useState<PartialContact>({
    name: contact?.name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    notes: contact?.notes || '',
    company: contact?.company || '',
    tags: contact?.tags || [],
    status: contact?.status || 'New',
    reminderAt: contact?.reminderAt || null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.name.trim() === '' || isSubmitting) return;
    setIsSubmitting(true);
    await onSave({
      ...formData,
      email: formData.email?.trim() || '',
      phone: formData.phone?.trim() || '',
    });
    setIsSubmitting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-40 flex justify-center items-center p-4" onClick={onClose}
    >
      <motion.form
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        onSubmit={handleSubmit}
        className="bg-slate-50 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-bold">{contact ? 'Edit Contact' : 'Add New Contact'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"
            aria-label="Close"
          >
            <XIcon className="w-6 h-6"/>
          </button>
        </header>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            ref={nameInputRef}
            type="text" name="name" value={formData.name} onChange={handleChange}
            placeholder="Full Name" required
            className="relative block w-full h-11 px-4 text-base text-slate-900 placeholder-slate-500 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 md:col-span-2"
          />
          <input
            type="email" name="email" value={formData.email} onChange={handleChange}
            placeholder="Email Address"
            className="relative block w-full h-11 px-4 text-base text-slate-900 placeholder-slate-500 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          />
          <input
            type="tel" name="phone" value={formData.phone} onChange={handleChange}
            placeholder="Phone Number"
            className="relative block w-full h-11 px-4 text-base text-slate-900 placeholder-slate-500 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          />
        </div>

        <footer className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button" onClick={onClose}
            className="h-11 px-6 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 px-6 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
          >
            {isSubmitting ? 'Saving...' : (contact ? 'Save Changes' : 'Add Contact')}
          </button>
        </footer>
      </motion.form>
    </motion.div>
  );
};

export default CRM;