import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { ViewType } from '../types';
import Header from './Header';
import { TodoListIcon, KnowledgeIcon, BookmarksIcon, WarMapIcon, SettingsIcon, UsersIcon, LightBulbIcon, ResetIcon } from './Icons';

const Clock: React.FC<{ timeZone: string; label: string }> = ({ timeZone, label }) => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const timeString = time.toLocaleTimeString('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    
    const dateString = time.toLocaleDateString('en-US', {
        timeZone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });

    return (
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-base font-bold text-slate-800">{label}</p>
            <p className="text-3xl font-mono font-bold text-indigo-700 tracking-tight">{timeString}</p>
            <p className="text-sm text-slate-500">{dateString}</p>
        </div>
    );
};

const InternationalClocks: React.FC = () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <Clock timeZone="Asia/Makassar" label="Bali, Indonesia" />
        <Clock timeZone="Europe/Copenhagen" label="Denmark" />
        <Clock timeZone="Europe/Moscow" label="Moscow, Russia" />
    </div>
);

const suggestions = [
  "Review your long-term goals and break one down into smaller, actionable steps for this week.",
  "Dedicate 25 minutes to a single task using the Pomodoro Technique, followed by a 5-minute break.",
  "Identify your Most Important Task (MIT) for tomorrow before you finish work today.",
  "Declutter your physical workspace for 15 minutes. A clean space promotes a clear mind.",
  "Unsubscribe from 5 email newsletters you no longer read.",
  "Schedule a 30-minute 'deep work' block with no distractions—turn off all notifications.",
  "Write down three things you are grateful for. This practice boosts positivity and focus.",
  "Plan your meals for the next three days to save time and reduce decision fatigue.",
  "Go for a 10-minute walk outside without your phone to clear your head.",
  "Listen to a podcast or watch a TED talk on a topic outside your industry.",
  "Organize your digital files: clean up your desktop and downloads folder.",
  "Use the 'Two-Minute Rule': if a task takes less than two minutes, do it immediately.",
  "Practice mindfulness for 5 minutes. Focus on your breath and nothing else.",
  "Identify one recurring, low-value task and look for a way to automate it.",
  "Reach out to one person in your network just to say hello and see how they are.",
  "Read a chapter of a book.",
  "Stretch for 10 minutes, focusing on areas of tension like your neck, shoulders, and back.",
  "Review your calendar for the upcoming week and cancel or delegate non-essential meetings.",
  "Learn a new keyboard shortcut for an application you use daily.",
  "Hydrate! Drink a full glass of water right now.",
  "Tidy up your Task Master inbox. Sort all untriaged tasks into the right lists.",
  "Think of one thing you've been procrastinating on and do the very first step, no matter how small.",
  "Set a specific, measurable, achievable, relevant, and time-bound (SMART) goal for a personal project.",
  "Create a simple 'done' list at the end of the day to acknowledge your accomplishments.",
  "Turn on some focus music—instrumental, classical, or electronic—to help you concentrate.",
  "Review your monthly budget or spending for 15 minutes.",
  "Brainstorm 10 ideas—good or bad—about a problem you're trying to solve.",
  "Put your phone in another room for one hour.",
  "Do a 'brain dump'—write down everything on your mind onto a piece of paper to clear your mental clutter.",
  "Compliment a colleague or friend on their recent work.",
  "Identify one bad habit and one good habit you want to change or build. Write down a plan.",
  "Spend 20 minutes learning a new skill on a platform like Khan Academy or Coursera.",
  "Stand up and do 20 jumping jacks or a quick set of exercises to get your blood flowing.",
  "Review your 'Completed' tasks from the last week. What patterns do you notice?",
  "Set clear boundaries for your workday. Define a start and end time and stick to it.",
  "Visualize your perfect day. What would it look like from morning to night?",
  "Create a reusable checklist for a recurring task, like preparing for a weekly meeting.",
  "Block out 'personal time' on your calendar for hobbies or relaxation.",
  "Try the 'Eat the Frog' method: tackle your biggest, most challenging task first thing in the morning.",
  "Reflect on a recent failure. What did you learn from it?",
  "Clean your computer screen and keyboard.",
  "Set up a recurring calendar event to review your weekly progress.",
  "Practice single-tasking. Focus on one browser tab and one application at a time.",
  "Make your bed. It's a small win that starts the day with a sense of accomplishment.",
  "Prepare your clothes and bag for tomorrow morning to streamline your routine.",
  "Identify a source of recurring stress and brainstorm one small step to reduce it.",
  "Send a thank-you note or email to someone who has helped you recently.",
  "Review your recurring subscriptions. Cancel any you no longer get value from.",
  "Take a different route on your daily walk or commute to stimulate your brain.",
  "Define what 'done' looks like for your current project before you start.",
  "Use the Eisenhower Matrix: categorize tasks as Urgent/Important to prioritize better.",
  "Schedule a 15-minute 'worry time' to deal with anxieties, then let them go for the rest of the day.",
  "Look for an opportunity to delegate a task that doesn't require your unique skills.",
  "Take a few deep, diaphragmatic breaths to reduce stress and reset your nervous system.",
  "Create a 'distraction list'. When a random thought pops up, write it down to deal with later.",
  "Turn off all non-essential notifications on your phone and computer.",
  "Find an article or research paper related to your field and read the abstract.",
  "Map out a project's dependencies to identify potential bottlenecks early.",
  "Plan a reward for yourself for when you complete a major task or project.",
  "Review your email filtering rules. Can you create a new one to automate sorting?",
  "Step away from your screen and look at something 20 feet away for 20 seconds (the 20-20-20 rule).",
  "Think about your energy levels. Schedule demanding tasks for when you're most alert.",
  "Identify one area of your life that feels disorganized and create a plan to tackle it.",
  "Set a timer for 5 minutes and write continuously about whatever is on your mind (freewriting).",
  "Watch an inspiring video about someone who overcame a great challenge.",
  "Review your social media feeds. Unfollow accounts that don't add value or positivity to your life.",
  "Create a 'waiting for' list to track tasks you've delegated to others.",
  "Practice active listening in your next conversation. Don't plan your response while the other person is speaking.",
  "Identify the 'why' behind your most important goal. Connect with your motivation.",
  "Try a new healthy recipe or snack.",
  "Set up your workspace to be more ergonomic. Adjust your chair, monitor height, and keyboard position.",
  "Batch similar tasks together, like answering all your emails at once rather than throughout the day.",
  "Review a past success. What factors contributed to it, and can you replicate them?",
  "Learn how to say 'no' politely to a request that doesn't align with your priorities.",
  "If you're stuck on a problem, try explaining it to someone else (or even an inanimate object).",
  "Set your phone to grayscale to make it less appealing and reduce screen time.",
  "Create a quick 'anti-distraction' ritual, like closing all tabs before starting a focus block.",
  "Break a large goal into milestones and celebrate when you hit each one.",
  "Plan a day with no meetings to allow for uninterrupted deep work.",
  "Do something creative for 15 minutes: sketch, write, play an instrument.",
  "Identify your biggest time-waster and track it for a day to build awareness.",
  "Create a 'parking lot' document for ideas that arise during meetings but are off-topic.",
  "Set an alarm 30 minutes before you want to go to bed to start your wind-down routine.",
  "Review your personal principles. Are your actions aligned with your values?",
  "Find a quiet place and do nothing for 10 minutes. Let your mind wander.",
  "Think of a skill you want to learn. Spend 15 minutes researching the first step.",
  "Create a recurring task to back up your important digital files.",
  "Identify one process at work that could be improved. Write down your suggestions.",
  "Schedule your next haircut, dentist appointment, or other personal errand.",
  "Look at your War Planner. Is there a long-term mission that needs your attention this week?",
  "Create a 'someday/maybe' list for ideas that aren't a priority right now.",
  "End your workday with a clear shutdown ritual, like reviewing what you did and planning for tomorrow.",
  "Choose one book you want to read next and put it on your desk or bedside table.",
  "Identify one person you admire and think about what qualities make them successful.",
  "If you have a cluttered inbox, archive all emails older than one month to start fresh.",
  "Write down a single sentence that defines success for you this week.",
];

const SuggestionWidget: React.FC = () => {
    const [suggestion, setSuggestion] = useState('');
    const getNewSuggestion = () => {
        const randomIndex = Math.floor(Math.random() * suggestions.length);
        setSuggestion(suggestions[randomIndex]);
    };
    useEffect(getNewSuggestion, []);
    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <LightBulbIcon className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-bold text-lg text-slate-800">Spark of Genius</h3>
            </div>
            <p className="text-slate-600 flex-grow text-left">
                {suggestion}
            </p>
            <button
                onClick={getNewSuggestion}
                className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
                <ResetIcon className="w-4 h-4" />
                Get another suggestion
            </button>
        </div>
    );
};


const DashboardHome: React.FC = () => {
    const { setCurrentView } = useAppStore();

    const cardItems = [
        { id: 'todolist' as ViewType, label: 'Task Master', icon: TodoListIcon, description: "Organize, prioritize, and conquer your daily tasks." },
        { id: 'war_planner' as ViewType, label: 'War Planner', icon: WarMapIcon, description: "Strategize your long-term goals and missions." },
        { id: 'crm' as ViewType, label: 'CRM', icon: UsersIcon, description: "Manage all your important contacts in one place." },
        { id: 'knowledge' as ViewType, label: 'Knowledge Base', icon: KnowledgeIcon, description: "Build your personal wiki and store valuable info." },
        { id: 'bookmarks' as ViewType, label: 'Bookmarks', icon: BookmarksIcon, description: "Save and organize important links and resources." },
        { id: 'settings' as ViewType, label: 'Settings', icon: SettingsIcon, description: "Configure your application and account settings." },
    ];

    return (
        <div>
            <InternationalClocks />
            <Header title="Welcome to Brain Damage" subtitle="Your central command for a more organized life." />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SuggestionWidget />
                {cardItems.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className="text-left p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all flex flex-col"
                    >
                        <item.icon className="w-8 h-8 text-indigo-600 mb-4" />
                        <h3 className="font-bold text-lg text-slate-800">{item.label}</h3>
                        <p className="text-slate-500 mt-2 flex-grow">{item.description}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default DashboardHome;
