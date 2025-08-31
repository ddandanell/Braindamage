import { create } from 'zustand';
import { AppStore, ViewType } from './types';
import { User } from 'firebase/auth';

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  currentView: 'dashboard',
  isSidebarOpen: false,
  initialNoteToOpen: null,
  
  setUser: (user: User | null) => set({ user }),
  
  setCurrentView: (view: ViewType) => set({ currentView: view }),
  
  setSidebarOpen: (isOpen: boolean) => set({ isSidebarOpen: isOpen }),
  
  navigateToNote: (noteId: string) => set({ 
    initialNoteToOpen: noteId,
    currentView: 'knowledge' 
  }),
}));
