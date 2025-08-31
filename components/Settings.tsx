import React, { useState } from 'react';
import { updateProfile, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useAppStore } from '../store';
import Header from './Header';

const Settings: React.FC = () => {
    const user = useAppStore(state => state.user);
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [newEmail, setNewEmail] = useState(user?.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    if (!user) return <div>Loading user settings...</div>;

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
    
    return (
        <div>
            <Header title="Settings" subtitle="Manage your account details and app configurations." />
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

export default Settings;
