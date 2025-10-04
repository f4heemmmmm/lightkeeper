import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios, { AxiosError } from "axios";
import { useToast } from "@/components/ToastContainer";
import {
    Calendar,
    FileText,
    LogOut,
    ChevronRight,
    AlertCircle,
    Clock,
    Users,
    Sparkles,
} from "lucide-react";

interface User {
    id: string;
    email: string;
    name: string;
    role: "organisation" | "member";
}

interface Meeting {
    _id: string;
    title: string;
    description?: string;
    summary?: string;
    actionItems?: string[];
    tags?: string[];
    internalTags?: string[];
    fileName: string;
    fileSize: number;
    fileUrl: string;
    uploaderName: string;
    createdAt: string;
}

interface AgendaItem {
    topic: string;
    description: string;
    estimatedDuration: string;
    relatedMeetings: Meeting[];
}

interface ErrorResponse {
    message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function UpcomingEventsPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [followUpMeetings, setFollowUpMeetings] = useState<Meeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generatedAgenda, setGeneratedAgenda] = useState<AgendaItem[]>([]);
    const [isGeneratingAgenda, setIsGeneratingAgenda] = useState(false);

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
            fetchMeetings();
        } catch (err) {
            console.error("Error parsing user data:", err);
            router.push("/login");
        }
    }, [router]);

    const fetchMeetings = async (): Promise<void> => {
        try {
            setIsLoading(true);
            const response = await axios.get<Meeting[]>(
                `${API_URL}/api/meetings`,
                {
                    headers: getAuthHeader(),
                }
            );
            
            const allMeetings = response.data;
            setMeetings(allMeetings);
            
            // Filter meetings that need follow-up
            const followUps = allMeetings.filter(meeting => 
                meeting.internalTags?.includes('follow-up-required') ||
                meeting.internalTags?.includes('action-heavy') ||
                meeting.internalTags?.includes('urgent')
            );
            
            setFollowUpMeetings(followUps);
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            if (axiosError.response?.status === 401) {
                router.push("/login");
                return;
            }
            setError("Failed to fetch meetings.");
            console.error("Error fetching meetings:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const generateAgenda = async (): Promise<void> => {
        if (followUpMeetings.length === 0) {
            showToast("No meetings requiring follow-up found", "warning");
            return;
        }

        setIsGeneratingAgenda(true);
        try {
            // Create a summary of follow-up items
            const followUpSummary = followUpMeetings.map(meeting => ({
                title: meeting.title,
                actionItems: meeting.actionItems || [],
                tags: meeting.tags || [],
                date: meeting.createdAt
            }));

            // Generate agenda based on patterns and tags
            const topicGroups = new Map<string, Meeting[]>();
            
            // Group meetings by similar topics
            followUpMeetings.forEach(meeting => {
                const topicTags = meeting.internalTags?.filter(tag => 
                    tag.includes('-discussion') || 
                    tag.includes('-planning') || 
                    tag.includes('-matters')
                ) || [];
                
                topicTags.forEach(tag => {
                    if (!topicGroups.has(tag)) {
                        topicGroups.set(tag, []);
                    }
                    topicGroups.get(tag)!.push(meeting);
                });
                
                // Also group by main tags
                meeting.tags?.forEach(tag => {
                    const normalizedTag = tag.toLowerCase().replace(/\s+/g, '-');
                    if (!topicGroups.has(normalizedTag)) {
                        topicGroups.set(normalizedTag, []);
                    }
                    topicGroups.get(normalizedTag)!.push(meeting);
                });
            });

            // Create agenda items
            const agenda: AgendaItem[] = [];
            
            // Add urgent items first
            const urgentMeetings = followUpMeetings.filter(m => 
                m.internalTags?.includes('urgent')
            );
            
            if (urgentMeetings.length > 0) {
                agenda.push({
                    topic: "Urgent Items Review",
                    description: "Critical items requiring immediate attention from previous meetings",
                    estimatedDuration: `${urgentMeetings.length * 5} minutes`,
                    relatedMeetings: urgentMeetings
                });
            }

            // Add grouped topics
            topicGroups.forEach((meetings, topic) => {
                if (meetings.length > 0) {
                    const topicName = topic
                        .replace(/-/g, ' ')
                        .replace(/\b\w/g, c => c.toUpperCase())
                        .replace(' Discussion', '')
                        .replace(' Planning', '')
                        .replace(' Matters', '');
                    
                    const actionItemsCount = meetings.reduce((sum, m) => 
                        sum + (m.actionItems?.length || 0), 0
                    );
                    
                    agenda.push({
                        topic: `${topicName} Updates`,
                        description: `Review progress on ${actionItemsCount} action items from ${meetings.length} related meetings`,
                        estimatedDuration: `${Math.max(10, actionItemsCount * 3)} minutes`,
                        relatedMeetings: meetings.slice(0, 3) // Limit to 3 most recent
                    });
                }
            });

            // Sort agenda by priority
            agenda.sort((a, b) => {
                if (a.topic.includes("Urgent")) return -1;
                if (b.topic.includes("Urgent")) return 1;
                return b.relatedMeetings.length - a.relatedMeetings.length;
            });

            setGeneratedAgenda(agenda.slice(0, 5)); // Limit to 5 agenda items
            showToast("Agenda generated successfully!", "success");
        } catch (err) {
            console.error("Error generating agenda:", err);
            showToast("Failed to generate agenda", "error");
        } finally {
            setIsGeneratingAgenda(false);
        }
    };

    const handleLogout = (): void => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login");
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="border-b border-white/10 p-8">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-light mb-2">
                            Upcoming Events & Agenda
                        </h1>
                        <p className="text-gray-400">
                            Review follow-ups and generate meeting agendas
                        </p>
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

            {/* Navigation */}
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
                        <button
                            onClick={() => router.push("/calendar")}
                            className="py-4 text-gray-400 hover:text-white transition-colors"
                        >
                            Calendar
                        </button>
                        <button className="py-4 text-white border-b-2 border-white">
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

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-8 py-8">
                {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                        <p className="text-gray-400">Loading meetings...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Follow-up Required Section */}
                        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-medium flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                                    Follow-up Required
                                </h2>
                                <span className="text-sm text-gray-400">
                                    {followUpMeetings.length} meetings
                                </span>
                            </div>
                            
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {followUpMeetings.length === 0 ? (
                                    <p className="text-gray-400 text-center py-8">
                                        No meetings requiring follow-up
                                    </p>
                                ) : (
                                    followUpMeetings.map((meeting) => (
                                        <div
                                            key={meeting._id}
                                            onClick={() => router.push(`/meetings?selected=${meeting._id}`)}
                                            className="bg-white/5 border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
                                        >
                                            <div className="flex items-start gap-3">
                                                <FileText className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                                                <div className="flex-1">
                                                    <h3 className="font-medium mb-1">
                                                        {meeting.title}
                                                    </h3>
                                                    {meeting.actionItems && meeting.actionItems.length > 0 && (
                                                        <p className="text-sm text-gray-400 mb-2">
                                                            {meeting.actionItems.length} action items
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{formatDate(meeting.createdAt)}</span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Generated Agenda Section */}
                        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-medium flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-400" />
                                    Next Meeting Agenda
                                </h2>
                                <button
                                    onClick={generateAgenda}
                                    disabled={isGeneratingAgenda || followUpMeetings.length === 0}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isGeneratingAgenda ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Generate Agenda
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            <div className="space-y-4 max-h-96 overflow-y-auto">
                                {generatedAgenda.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                        <p className="text-gray-400">
                                            Click "Generate Agenda" to create an agenda based on follow-up items
                                        </p>
                                    </div>
                                ) : (
                                    generatedAgenda.map((item, index) => (
                                        <div
                                            key={index}
                                            className="bg-white/5 border border-white/10 rounded-lg p-4"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="font-medium text-purple-300">
                                                    {index + 1}. {item.topic}
                                                </h3>
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {item.estimatedDuration}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 mb-3">
                                                {item.description}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <Users className="w-3 h-3" />
                                                <span>Based on {item.relatedMeetings.length} related meetings</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
