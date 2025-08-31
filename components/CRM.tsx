import React, { useState, useMemo, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Contact } from '../types';
import Header from './Header';
import { PlusIcon, EditIcon, TrashIcon, XIcon } from './Icons';

const CRM: React.FC<{ user: User }> = ({ user }) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    
    const contactsCollection = useMemo(() => collection(db, 'users', user.uid, 'contacts'), [user.uid]);

    useEffect(() => {
        const q = query(contactsCollection, orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, snapshot => {
            const contactsData = snapshot.docs.map(d => ({ 
                id: d.id, 
                ...d.data(),
                createdAt: (d.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
            } as Contact));
            setContacts(contactsData);
        });
        return unsubscribe;
    }, [contactsCollection]);

    const handleSaveContact = async (contactData: Omit<Contact, 'id' | 'createdAt'>) => {
        if (editingContact) {
            await updateDoc(doc(contactsCollection, editingContact.id), contactData);
        } else {
            await addDoc(contactsCollection, { ...contactData, createdAt: serverTimestamp() });
        }
        setIsModalOpen(false);
        setEditingContact(null);
    };

    const handleDeleteContact = async (contactId: string) => {
        if (window.confirm('Are you sure you want to delete this contact?')) {
            await deleteDoc(doc(contactsCollection, contactId));
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

    const filteredContacts = useMemo(() => 
        contacts.filter(contact => 
            contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.phone.toLowerCase().includes(searchTerm.toLowerCase())
        ), [contacts, searchTerm]);

    return (
        <div>
            <Header title="CRM" subtitle="Manage your professional and personal contacts." />
            <div className="mb-6 flex justify-between items-center">
                <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-11 px-4 text-slate-900 placeholder-slate-500 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full max-w-sm"
                />
                <button
                    onClick={openAddModal}
                    className="flex items-center justify-center gap-2 h-11 px-5 bg-indigo-600 text-white rounded-xl font-semibold text-base hover:bg-indigo-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5"/>
                    <span>Add Contact</span>
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                <ul className="divide-y divide-slate-200">
                    {filteredContacts.map(contact => (
                        <li key={contact.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                            <div>
                                <p className="font-semibold text-slate-800">{contact.name}</p>
                                <p className="text-sm text-slate-500">{contact.email}</p>
                                <p className="text-sm text-slate-500">{contact.phone}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => openEditModal(contact)} className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded-lg"><EditIcon className="w-5 h-5"/></button>
                                <button onClick={() => handleDeleteContact(contact.id)} className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-slate-200 rounded-lg"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        </li>
                    ))}
                     {filteredContacts.length === 0 && (
                        <p className="p-8 text-center text-slate-500">No contacts found.</p>
                    )}
                </ul>
            </div>

            {isModalOpen && (
                <ContactModal 
                    contact={editingContact}
                    onSave={handleSaveContact}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};

const ContactModal: React.FC<{
    contact: Contact | null;
    onSave: (data: Omit<Contact, 'id' | 'createdAt'>) => void;
    onClose: () => void;
}> = ({ contact, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: contact?.name || '',
        email: contact?.email || '',
        phone: contact?.phone || '',
        notes: contact?.notes || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.name.trim() === '') return;
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-40 flex justify-center items-center p-4" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-slate-50 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold">{contact ? 'Edit Contact' : 'Add New Contact'}</h2>
                    <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200"><XIcon className="w-6 h-6"/></button>
                </header>
                <div className="p-6 space-y-4">
                     <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" required className="relative block w-full h-11 px-4 text-slate-900 placeholder-slate-500 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"/>
                     <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email Address" className="relative block w-full h-11 px-4 text-slate-900 placeholder-slate-500 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"/>
                     <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone Number" className="relative block w-full h-11 px-4 text-slate-900 placeholder-slate-500 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"/>
                     <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4} placeholder="Notes..." className="w-full text-base p-3 border border-slate-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white"></textarea>
                </div>
                 <footer className="p-4 border-t border-slate-200 flex justify-end">
                    <button type="submit" className="h-11 px-6 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                        {contact ? 'Save Changes' : 'Add Contact'}
                    </button>
                </footer>
            </form>
        </div>
    );
};

export default CRM;
