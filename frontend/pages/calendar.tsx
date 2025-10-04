import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import axios, { AxiosError } from "axios";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { LogOut, Plus, Calendar as CalendarIcon } from "lucide-react";

const locales = {
    "en-US": require("date-fns/locale/en-US"),
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

interface User {
    id: string;
    email: string;
    name: string;
    role: "organisation" | "member";
}

interface Task {
    _id: string;
    title: string;
    description: string;
    status: "pending" | "completed";
    priority: "low" | "medium" | "high";
    dueDate: string | null;
    createdAt: string;
    assignedTo?: {
        _id: string;
        name: string;
        email: string;
    } | null;
    isPrivate?: boolean;
    source?: "manual" | "email" | "calendar";
}

interface NylasEvent {
    id: string;
    title: string;
    description?: string;
    when: {
        start_time?: number;
        end_time?: number;
        start_date?: string;
        end_date?: string;
        object: string;
    };
    location?: string;
    participants?: Array<{
        email: string;
        name?: string;
    }>;
}

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource: Task | NylasEvent;
    type: "task" | "event";
}

interface ErrorResponse {
    message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function CalendarPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [nylasEvents, setNylasEvents] = useState<NylasEvent[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<View>("month");
    const [date, setDate] = useState(new Date());
    const [showTasks, setShowTasks] = useState(true);
    const [showNylasEvents, setShowNylasEvents] = useState(true);

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem("token");
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        const userStr = localStorage.getItem("user");

        if (!token || !userStr) {
            router.push("/login");
            return;
        }

        try {
            const parsedUser = JSON.parse(userStr);
            setUser(parsedUser);
            fetchTasks();
        } catch (err) {
            console.error("Error parsing user data:", err);
            router.push("/login");
        }
    }, [router]);

    const fetchTasks = async (): Promise<void> => {
        try {
            setIsLoading(true);
            
            // Fetch tasks
            const tasksResponse = await axios.get<Task[]>(`${API_URL}/api/tasks`, {
                headers: getAuthHeader(),
            });
            setTasks(tasksResponse.data);
            
            // Fetch Nylas calendar events
            let fetchedNylasEvents: NylasEvent[] = [];
            try {
                const eventsResponse = await axios.get(`${API_URL}/api/calendar/events`, {
                    headers: getAuthHeader(),
                });
                fetchedNylasEvents = eventsResponse.data.events || [];
                setNylasEvents(fetchedNylasEvents);
            } catch (eventsErr) {
                console.warn("Failed to fetch Nylas events:", eventsErr);
                // Don't fail the whole page if Nylas events fail
            }
            
            // Convert tasks to calendar events
            const taskEvents: CalendarEvent[] = tasksResponse.data
                .filter(task => task.dueDate && task.status === "pending")
                .map(task => {
                    const dueDate = new Date(task.dueDate!);
                    return {
                        id: `task-${task._id}`,
                        title: `${task.source === 'calendar' ? '📅 ' : task.source === 'email' ? '📧 ' : ''}${task.title}`,
                        start: dueDate,
                        end: dueDate,
                        resource: task,
                        type: "task" as const,
                    };
                });
            
            // Convert Nylas events to calendar events
            const nylasCalendarEvents: CalendarEvent[] = fetchedNylasEvents.map(event => {
                let start: Date;
                let end: Date;
                
                if (event.when.start_time) {
                    start = new Date(event.when.start_time * 1000);
                    end = event.when.end_time
                        ? new Date(event.when.end_time * 1000)
                        : new Date(start.getTime() + 60 * 60 * 1000); // 1 hour default
                } else if (event.when.start_date) {
                    start = new Date(event.when.start_date);
                    end = event.when.end_date
                        ? new Date(event.when.end_date)
                        : start;
                } else {
                    start = new Date();
                    end = new Date();
                }
                
                return {
                    id: `nylas-${event.id}`,
                    title: `🗓️ ${event.title}`,
                    start,
                    end,
                    resource: event,
                    type: "event" as const,
                };
            });
            
            // Combine all events
            setEvents([...taskEvents, ...nylasCalendarEvents]);
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            if (axiosError.response?.status === 401) {
                router.push("/login");
                return;
            }
            setError("Failed to fetch calendar data.");
            console.error("Error fetching calendar data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = (): void => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login");
    };

    const eventStyleGetter = (event: CalendarEvent) => {
        let backgroundColor = "#6366f1"; // Default blue
        
        if (event.type === "task") {
            const task = event.resource as Task;
            if (task.priority === "high") {
                backgroundColor = "#ef4444"; // Red
            } else if (task.priority === "medium") {
                backgroundColor = "#f59e0b"; // Yellow/Orange
            } else if (task.priority === "low") {
                backgroundColor = "#10b981"; // Green
            }
        } else {
            // Nylas calendar events
            backgroundColor = "#8b5cf6"; // Purple
        }

        return {
            style: {
                backgroundColor,
                borderRadius: "4px",
                opacity: 0.9,
                color: "white",
                border: "0px",
                display: "block",
                fontSize: "0.875rem",
                padding: "2px 5px",
            },
        };
    };

    const filteredEvents = events.filter(event => {
        if (event.type === "task" && !showTasks) return false;
        if (event.type === "event" && !showNylasEvents) return false;
        return true;
    });

    const handleSelectEvent = useCallback(
        (event: CalendarEvent) => {
            // TODO: Open task detail modal
            console.log("Selected event:", event);
        },
        []
    );

    const handleNavigate = useCallback((newDate: Date) => {
        setDate(newDate);
    }, []);

    const handleViewChange = useCallback((newView: View) => {
        setView(newView);
    }, []);

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="border-b border-white/10 p-8">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8" />
                        <div>
                            <h1 className="text-2xl font-light">Calendar</h1>
                            <p className="text-gray-400 text-sm">
                                View your tasks and events
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-400 text-sm">
                            {user.email}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-white/10">
                <div className="max-w-7xl mx-auto px-8">
                    <div className="flex gap-6">
                        <button
                            onClick={() => router.push("/")}
                            className="py-4 text-gray-400 hover:text-white transition-colors"
                        >
                            Tasks
                        </button>
                        <button
                            onClick={() => router.push("/meetings")}
                            className="py-4 text-gray-400 hover:text-white transition-colors"
                        >
                            Meetings
                        </button>
                        <button
                            onClick={() => router.push("/notetaker")}
                            className="py-4 text-gray-400 hover:text-white transition-colors"
                        >
                            AI Notetaker
                        </button>
                        <button className="py-4 text-white border-b-2 border-white">
                            Calendar
                        </button>
                        <button
                            onClick={() => router.push("/upcoming")}
                            className="py-4 text-gray-400 hover:text-white transition-colors"
                        >
                            Upcoming Events
                        </button>
                        <button
                            onClick={() => router.push("/event-designer")}
                            className="py-4 text-gray-400 hover:text-white transition-colors"
                        >
                            Event Designer
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="max-w-7xl mx-auto px-8 pt-4">
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex justify-between items-center">
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="text-red-400 hover:text-red-300"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Calendar Content */}
            <div className="max-w-7xl mx-auto px-8 py-8">
                {/* Calendar Controls */}
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowTasks(!showTasks)}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                showTasks
                                    ? "bg-blue-500/20 border border-blue-500/50 text-blue-400"
                                    : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10"
                            }`}
                        >
                            {showTasks ? "Hide" : "Show"} Tasks
                        </button>
                        <button
                            onClick={() => setShowNylasEvents(!showNylasEvents)}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                showNylasEvents
                                    ? "bg-purple-500/20 border border-purple-500/50 text-purple-400"
                                    : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10"
                            }`}
                        >
                            {showNylasEvents ? "Hide" : "Show"} Calendar Events
                        </button>
                    </div>
                    <button
                        onClick={async () => {
                            try {
                                setIsLoading(true);
                                await axios.post(
                                    `${API_URL}/api/calendar/sync`,
                                    {},
                                    { headers: getAuthHeader() }
                                );
                                await fetchTasks();
                            } catch (err) {
                                console.error("Sync error:", err);
                                setError("Failed to sync calendar");
                            } finally {
                                setIsLoading(false);
                            }
                        }}
                        className="px-4 py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                    >
                        Sync Calendar
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                        <p className="text-gray-400">Loading calendar...</p>
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                        <div className="calendar-container">
                            <style jsx global>{`
                                .calendar-container {
                                    height: calc(100vh - 350px);
                                    min-height: 500px;
                                }
                                
                                .rbc-calendar {
                                    color: white;
                                    background: transparent;
                                }
                                
                                .rbc-header {
                                    color: #9ca3af;
                                    font-weight: 600;
                                    padding: 12px 6px;
                                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                                    background: rgba(255, 255, 255, 0.02);
                                }
                                
                                .rbc-month-view {
                                    border: 1px solid rgba(255, 255, 255, 0.1);
                                    border-radius: 8px;
                                    overflow: hidden;
                                    background: rgba(0, 0, 0, 0.2);
                                }
                                
                                .rbc-month-row {
                                    border-color: rgba(255, 255, 255, 0.1);
                                }
                                
                                .rbc-day-bg {
                                    border-color: rgba(255, 255, 255, 0.1);
                                }
                                
                                .rbc-off-range-bg {
                                    background: rgba(255, 255, 255, 0.02);
                                }
                                
                                .rbc-today {
                                    background: rgba(99, 102, 241, 0.1);
                                }
                                
                                .rbc-date-cell {
                                    padding: 6px;
                                }
                                
                                .rbc-button-link {
                                    color: #e5e7eb;
                                }
                                
                                .rbc-off-range .rbc-button-link {
                                    color: #6b7280;
                                }
                                
                                .rbc-toolbar {
                                    padding: 16px;
                                    margin-bottom: 16px;
                                    background: rgba(255, 255, 255, 0.02);
                                    border: 1px solid rgba(255, 255, 255, 0.1);
                                    border-radius: 8px;
                                }
                                
                                .rbc-toolbar button {
                                    color: white;
                                    border: 1px solid rgba(255, 255, 255, 0.1);
                                    background: rgba(255, 255, 255, 0.05);
                                    padding: 8px 16px;
                                    border-radius: 6px;
                                    transition: all 0.2s;
                                }
                                
                                .rbc-toolbar button:hover {
                                    background: rgba(255, 255, 255, 0.1);
                                }
                                
                                .rbc-toolbar button.rbc-active {
                                    background: rgba(99, 102, 241, 0.3);
                                    border-color: rgba(99, 102, 241, 0.5);
                                }
                                
                                .rbc-toolbar-label {
                                    color: white;
                                    font-weight: 500;
                                    font-size: 1.125rem;
                                }
                                
                                .rbc-event {
                                    cursor: pointer;
                                    transition: transform 0.2s;
                                }
                                
                                .rbc-event:hover {
                                    transform: scale(1.02);
                                }
                                
                                .rbc-show-more {
                                    color: #6366f1;
                                    background: rgba(99, 102, 241, 0.1);
                                    padding: 2px 6px;
                                    border-radius: 4px;
                                }
                                
                                .rbc-agenda-view {
                                    border: 1px solid rgba(255, 255, 255, 0.1);
                                    border-radius: 8px;
                                    overflow: hidden;
                                }
                                
                                .rbc-agenda-table {
                                    border-color: rgba(255, 255, 255, 0.1);
                                }
                                
                                .rbc-agenda-date-cell,
                                .rbc-agenda-time-cell {
                                    color: #9ca3af;
                                }
                                
                                .rbc-agenda-event-cell {
                                    color: white;
                                }
                            `}</style>
                            <Calendar
                                localizer={localizer}
                                events={filteredEvents}
                                startAccessor="start"
                                endAccessor="end"
                                style={{ height: "100%" }}
                                eventPropGetter={eventStyleGetter}
                                onSelectEvent={handleSelectEvent}
                                onNavigate={handleNavigate}
                                onView={handleViewChange}
                                view={view}
                                date={date}
                                views={["month", "week", "day", "agenda"]}
                            />
                        </div>
                        
                        {/* Legend */}
                        <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-red-500 rounded"></div>
                                <span className="text-gray-400">High Priority</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                                <span className="text-gray-400">Medium Priority</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-green-500 rounded"></div>
                                <span className="text-gray-400">Low Priority</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                                <span className="text-gray-400">Calendar Events</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

