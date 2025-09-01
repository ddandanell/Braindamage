

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
  workTypeId?: string;
  knowledgeRequired?: string;
  reach?: number;
  revenueImpact?: number;
  strategicFit?: number;
  confidence?: number;
  effort?: number;
}

export interface Task {
  id:string;
  title: string;
  description: string;
  isCompleted: boolean;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  dueDate: string | null;
  startDate: string | null;
  estimatedTime: number | null; // in minutes
  energyLevel: 'Low' | 'Medium' | 'High' | null;
  catalogId: string;
  tags: string[];
  subtasks: Subtask[];
  createdAt: string; // Firestore Timestamp converted to ISO string
  isFlagged?: boolean;
  sourceNoteId?: string; // Link back to knowledge base note
}

export interface Catalog {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  folderId?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  startDateTime: string; // ISO String
  endDateTime: string; // ISO String
  location: string;
  isAllDay: boolean;
  createdAt: string; // Firestore Timestamp converted to ISO string
}

export interface Tag {
    id:string;
    name: string;
    color: string;
}

export type Stage = 'New' | 'Contacted' | 'Demo' | 'Proposal' | 'Won' | 'Lost';

export interface Deal {
  id: string;
  contactId: string;
  company: string;
  value: number;
  stage: Stage;
  nextStep?: string;
  dueAt?: string | null;      // ISO
  tags?: string[];
  ownerId?: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
  company?: string;
  tags?: string[];
  status?: 'New' | 'Contacted' | 'Won' | 'Lost';
  reminderAt?: string | null;
  updatedAt?: string;
  deletedAt?: string | null;
  ownerId?: string;
  lastActivityAt?: string;
}

export interface KBFolder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: string; // ISO string
  color?: string;
  icon?: string;
  description?: string;
}

export interface KBNote {
  id: string;
  folderId: string | null;
  title: string;
  content: string; // HTML content from the rich-text editor
  order: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}


export interface BookmarkFolder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  folderId: string;
  parentId: string | null; // For outliner functionality
  title: string;
  url: string;
  order: number;
  faviconUrl?: string;
  createdAt: string;
  isArchived?: boolean;
  archivedContent?: string;
  archivedAt?: string;
  // fix: Added missing stickyNotes property to the Bookmark interface.
  stickyNotes?: StickyNote[];
}

export interface StickyNote {
  id: string;
  content: string;
  createdAt: string;
}


export interface Principle {
  id: string;
  text: string;
}

export interface TeamMember {
    id: string;
    name: string;
    role: string;
    hours: number;
    skills: string;
}

export interface GoalDocument {
  id: string;
  name: string;
  description: string;
  url: string;
}

export type Currency = 'USD' | 'EUR' | 'DKK' | 'IDR';
export type TransactionType = 'Expense (for my work)' | 'Income (money I got for work)';

export interface GoalTransaction {
  id: string;
  name: string;
  comment: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  date: string; // ISO String
}

export interface GoalContact {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    agreements: string;
    hoursWorked?: number;
    paymentDetails?: string;
}

export interface WarGoal {
  id: string;
  title: string;
  description: string;
  year: number;
  catalogId: string | null;
  subtasks: Subtask[];
  whatToReach?: string;
  howToReach?: string;
  whyToTakeOn?: string;
  financialTarget?: number;
  estimatedTime?: string;
  knowledgeRequired?: string;
  deadline?: string; // ISO string for goal deadline
  principles?: Principle[];
  team?: TeamMember[];
  documents?: GoalDocument[];
  transactions?: GoalTransaction[];
  goalContacts?: GoalContact[];
  history?: GoalHistoryEntry[];
}

export interface GoalHistoryEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  type: HistoryType;
}

export type HistoryType = 'Update' | 'Achievement' | 'Milestone' | 'Challenge';

export interface Mission {
  id: string;
  title: string;
  description?: string;
  parentId: string; // WarGoal ID
  startDate: string; // ISO String
  endDate: string; // ISO String
  isCompleted: boolean;
  colorGroupId: string | null;
  priority: 'Normal' | 'Urgent';
  subtasks: Subtask[];
  year: number;
  workTypeId?: string;
}

export interface WorkType {
  id: string;
  name: string;
  createdAt: string;
}

export interface RestPeriod {
  id: string;
  title: string;
  type: 'vacation' | 'rest' | 'reflection';
  startDate: string; // ISO String
  endDate: string; // ISO String
  year: number;
}

export interface ProgressLog {
  id: string;
  date: string; // YYYY-MM-DD
  outputPercentage: number; // 0-100
  focusPercentage: number; // 0-100
  year: number;
}

export interface ColorGroup {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  goalId: string;
  text: string;
  type: 'success' | 'learning';
  createdAt: string; // ISO string
}

export type ViewType = 'dashboard' | 'passwords' | 'todolist' | 'knowledge' | 'bookmarks' | 'war_planner' | 'settings' | 'valuta' | 'crm' | 'moneybox' | 'business_ideas' | 'web_development' | 'diary' | 'habit_tracking';

// New types for Zustand store
import { User } from 'firebase/auth';

export interface AppStore {
    user: User | null;
    currentView: ViewType;
    isSidebarOpen: boolean;
    initialNoteToOpen: string | null;
    setUser: (user: User | null) => void;
    setCurrentView: (view: ViewType) => void;
    setSidebarOpen: (isOpen: boolean) => void;
    navigateToNote: (noteId: string) => void;
}
