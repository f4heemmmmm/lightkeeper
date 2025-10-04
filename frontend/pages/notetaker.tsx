import axios, { AxiosError } from "axios";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AppLayout from "@/components/AppLayout";
import { Plus, X, Clock, CheckCircle, XCircle, Loader } from "lucide-react";

interface User {
    id: string;
    email: string;
    name: string;
    role: "organisation" | "member";
}

interface NotetakerSession {
    _id: string;
    nylasSessionId: string;
    meetingUrl: string;
    meetingTitle?: string;
    status:
        | "scheduled"
        | "joining"
        | "in_progress"
        | "completed"
        | "failed"
        | "cancelled";
    scheduledByName: string;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    meetingId?: {
        _id: string;
        title: string;
        summary?: string;
        actionItems?: string[];
    };
}

interface ErrorResponse {
    message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function NotetakerPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [sessions, setSessions] = useState<NotetakerSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleData, setScheduleData] = useState({
        meetingUrl: "",
        meetingTitle: "",
    });
    const [isScheduling, setIsScheduling] = useState(false);

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
            fetchSessions();
        } catch (err) {
            console.error("Error parsing user data:", err);
            router.push("/login");
        }

        const interval = setInterval(fetchSessions, 30000);
        return () => clearInterval(interval);
    }, [router]);

    const fetchSessions = async (): Promise<void> => {
        try {
            setIsLoading(true);
            const response = await axios.get<NotetakerSession[]>(
                `${API_URL}/api/notetaker`,
                { headers: getAuthHeader() }
            );
            setSessions(response.data);
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            if (axiosError.response?.status === 401) {
                router.push("/login");
                return;
            }
            setError("Failed to fetch sessions.");
            console.error("Error fetching sessions:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSchedule = async (): Promise<void> => {
        if (!scheduleData.meetingUrl.trim()) {
            setError("Meeting URL is required");
            return;
        }

        setIsScheduling(true);
        try {
            await axios.post(`${API_URL}/api/notetaker`, scheduleData, {
                headers: getAuthHeader(),
            });

            await fetchSessions();
            setScheduleData({ meetingUrl: "", meetingTitle: "" });
            setShowScheduleModal(false);
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setError(
                axiosError.response?.data?.message ||
                    "Failed to schedule notetaker"
            );
            console.error("Error scheduling notetaker:", err);
        } finally {
            setIsScheduling(false);
        }
    };

    const handleCancel = async (sessionId: string): Promise<void> => {
        try {
            await axios.delete(`${API_URL}/api/notetaker/${sessionId}`, {
                headers: getAuthHeader(),
            });
            await fetchSessions();
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setError(
                axiosError.response?.data?.message || "Failed to cancel session"
            );
            console.error("Error cancelling session:", err);
        }
    };

    const getStatusIcon = (status: NotetakerSession["status"]) => {
        switch (status) {
            case "scheduled":
                return <Clock className="w-5 h-5 text-blue-400" />;
            case "joining":
            case "in_progress":
                return (
                    <Loader className="w-5 h-5 text-yellow-400 animate-spin" />
                );
            case "completed":
                return <CheckCircle className="w-5 h-5 text-green-400" />;
            case "failed":
            case "cancelled":
                return <XCircle className="w-5 h-5 text-red-400" />;
            default:
                return <Clock className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusColor = (status: NotetakerSession["status"]): string => {
        switch (status) {
            case "scheduled":
                return "text-blue-400";
            case "joining":
            case "in_progress":
                return "text-yellow-400";
            case "completed":
                return "text-green-400";
            case "failed":
            case "cancelled":
                return "text-red-400";
            default:
                return "text-gray-400";
        }
    };

    const formatDateTime = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    if (!user) {
        return null;
    }

    return (
        <AppLayout user={user} currentPage="notetaker">
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

            <div className="max-w-7xl mx-auto px-8 py-6">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <p className="text-sm text-blue-400">
                        Schedule the AI notetaker to automatically join your
                        meetings, record transcripts, and generate summaries
                        with action items. Simply provide the meeting URL (Zoom,
                        Google Meet, etc.).
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                        <p className="text-gray-400 text-md mb-1 font-semibold">
                            Total Sessions
                        </p>
                        <p className="text-4xl font-thin">{sessions.length}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                        <p className="text-gray-400 text-md mb-1 font-semibold">
                            In Progress
                        </p>
                        <p className="text-4xl font-thin">
                            {
                                sessions.filter(
                                    (s) =>
                                        s.status === "in_progress" ||
                                        s.status === "joining"
                                ).length
                            }
                        </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                        <p className="text-gray-400 text-md mb-1 font-semibold">
                            Completed
                        </p>
                        <p className="text-4xl font-thin">
                            {
                                sessions.filter((s) => s.status === "completed")
                                    .length
                            }
                        </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                        <p className="text-gray-400 text-md mb-1 font-semibold">
                            Scheduled
                        </p>
                        <p className="text-4xl font-thin">
                            {
                                sessions.filter((s) => s.status === "scheduled")
                                    .length
                            }
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 pb-8">
                <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10">
                        <h2 className="text-xl font-medium">
                            Notetaker Sessions ({sessions.length})
                        </h2>
                    </div>
                    <div className="max-h-[calc(100vh-600px)] overflow-y-auto">
                        {isLoading ? (
                            <div className="text-center py-12 text-gray-400">
                                Loading sessions...
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <p>
                                    No sessions yet. Schedule your first AI
                                    notetaker.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/10">
                                {sessions.map((session) => (
                                    <div
                                        key={session._id}
                                        className="p-4 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            {getStatusIcon(session.status)}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-base font-medium mb-2">
                                                    {session.meetingTitle ||
                                                        "Untitled Meeting"}
                                                </h3>
                                                <div className="flex flex-wrap gap-3 text-xs mb-2">
                                                    <span
                                                        className={getStatusColor(
                                                            session.status
                                                        )}
                                                    >
                                                        {session.status
                                                            .toUpperCase()
                                                            .replace("_", " ")}
                                                    </span>
                                                    <span className="text-gray-400">
                                                        Scheduled by{" "}
                                                        {
                                                            session.scheduledByName
                                                        }
                                                    </span>
                                                    <span className="text-gray-400">
                                                        {formatDateTime(
                                                            session.createdAt
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {session.meetingUrl}
                                                </p>
                                                {session.meetingId && (
                                                    <button
                                                        onClick={() =>
                                                            router.push(
                                                                "/meetings"
                                                            )
                                                        }
                                                        className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                                                    >
                                                        View processed meeting →
                                                    </button>
                                                )}
                                            </div>
                                            {(session.status === "scheduled" ||
                                                session.status ===
                                                    "joining") && (
                                                <button
                                                    onClick={() =>
                                                        handleCancel(
                                                            session._id
                                                        )
                                                    }
                                                    className="text-gray-400 hover:text-red-400 transition-colors p-2 rounded-md hover:bg-white/10"
                                                    title="Cancel session"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="fixed bottom-8 right-8">
                <button
                    onClick={() => setShowScheduleModal(true)}
                    className="bg-white text-black p-4 rounded-full shadow-lg hover:bg-gray-100 transition-colors flex items-center justify-center group"
                    title="Schedule AI notetaker"
                >
                    <Plus className="w-6 h-6" />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap ml-0 group-hover:ml-2 font-medium">
                        Schedule Notetaker
                    </span>
                </button>
            </div>

            {showScheduleModal && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                    onClick={() => {
                        setShowScheduleModal(false);
                        setScheduleData({ meetingUrl: "", meetingTitle: "" });
                    }}
                >
                    <div
                        className="bg-black border border-white/10 rounded-2xl max-w-md w-full shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
                            <h2 className="text-2xl font-light">
                                Schedule AI Notetaker
                            </h2>
                            <button
                                onClick={() => {
                                    setShowScheduleModal(false);
                                    setScheduleData({
                                        meetingUrl: "",
                                        meetingTitle: "",
                                    });
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Meeting URL{" "}
                                    <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="url"
                                    value={scheduleData.meetingUrl}
                                    onChange={(e) =>
                                        setScheduleData({
                                            ...scheduleData,
                                            meetingUrl: e.target.value,
                                        })
                                    }
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                                    placeholder="https://zoom.us/j/123456789 or https://meet.google.com/abc-defg-hij"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    Supports Zoom, Google Meet, Microsoft Teams,
                                    and other platforms
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Meeting Title (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={scheduleData.meetingTitle}
                                    onChange={(e) =>
                                        setScheduleData({
                                            ...scheduleData,
                                            meetingTitle: e.target.value,
                                        })
                                    }
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                                    placeholder="e.g., Weekly Team Sync"
                                    maxLength={100}
                                />
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                <p className="text-xs text-blue-400">
                                    The AI notetaker will join your meeting,
                                    record the transcript, and automatically
                                    generate a summary with action items.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                onClick={() => {
                                    setShowScheduleModal(false);
                                    setScheduleData({
                                        meetingUrl: "",
                                        meetingTitle: "",
                                    });
                                }}
                                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSchedule}
                                disabled={
                                    !scheduleData.meetingUrl.trim() ||
                                    isScheduling
                                }
                                className="flex-1 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isScheduling ? "Scheduling..." : "Schedule"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
