import { useRouter } from "next/router";
import axios, { AxiosError } from "axios";
import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";

interface User {
    id: string;
    email: string;
    name: string;
    role: "organisation" | "member";
}

interface TaskAnalytics {
    overview: {
        totalTasks: number;
        completedTasks: number;
        pendingTasks: number;
        overdueTasks: number;
        tasksCreatedThisMonth: number;
        tasksCompletedThisMonth: number;
        completionRate: number;
        averageCompletionTime: number;
    };
    priorityDistribution: {
        low: number;
        medium: number;
        high: number;
    };
    topAssignees: Array<{
        _id: string;
        name: string;
        email: string;
        totalTasks: number;
        completedTasks: number;
        completionRate: number;
    }>;
    trends: {
        tasksCreatedThisMonth: number;
        tasksCompletedThisMonth: number;
        netGrowth: number;
    };
}

interface MeetingEffectiveness {
    meetingTaskConversion: Array<{
        _id: string;
        meetingTitle: string;
        meetingDate: string;
        totalTasks: number;
        completedTasks: number;
        conversionRate: number;
    }>;
    actionItemFollowThrough: Array<{
        _id: string;
        meetingTitle: string;
        totalActionItems: number;
        completedActionItems: number;
        overdueActionItems: number;
        followThroughRate: number;
        avgCompletionTime: number;
    }>;
    meetingProductivity: Array<{
        _id: string;
        title: string;
        createdAt: string;
        taskCount: number;
        completedTaskCount: number;
        overdueTaskCount: number;
        productivityScore: number;
        completionRate: number;
    }>;
    informationRetention: Array<{
        _id: {
            year: number;
            month: number;
        };
        uniqueMeetings: number;
        totalActionItems: number;
        completedActionItems: number;
        retentionRate: number;
        avgDaysToComplete: number;
    }>;
    stakeholderEngagement: Array<{
        _id: string;
        name: string;
        email: string;
        totalTasks: number;
        completedTasks: number;
        overdueTasks: number;
        engagementScore: number;
        completionRate: number;
        avgCompletionTime: number;
        meetingTasks: number;
    }>;
}

interface ProductivityInsights {
    weeklyProductivity: Array<{
        _id: {
            year: number;
            week: number;
        };
        completedTasks: number;
    }>;
    monthlyProductivity: Array<{
        _id: {
            year: number;
            month: number;
        };
        completedTasks: number;
    }>;
    bestPerformingDays: Array<{
        _id: number;
        completedTasks: number;
    }>;
    taskCompletionPatterns: Array<{
        _id: number;
        completedTasks: number;
    }>;
    insights: {
        tasksFromMeetings: number;
        meetingTaskRatio: number;
        totalTasks: number;
    };
}

interface ErrorResponse {
    message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function AnalyticsPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [taskAnalytics, setTaskAnalytics] = useState<TaskAnalytics | null>(null);
    const [meetingEffectiveness, setMeetingEffectiveness] = useState<MeetingEffectiveness | null>(null);
    const [productivityInsights, setProductivityInsights] = useState<ProductivityInsights | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'meetings' | 'productivity'>('overview');

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
            fetchAnalytics();
        } catch (err) {
            console.error("Error parsing user data:", err);
            router.push("/login");
        }
    }, [router]);

    const fetchAnalytics = async (): Promise<void> => {
        try {
            setIsLoading(true);
            
            const [taskAnalyticsRes, meetingEffectivenessRes, productivityInsightsRes] = await Promise.all([
                axios.get<TaskAnalytics>(`${API_URL}/api/analytics/tasks`, {
                    headers: getAuthHeader(),
                }),
                axios.get<MeetingEffectiveness>(`${API_URL}/api/analytics/meetings/effectiveness`, {
                    headers: getAuthHeader(),
                }),
                axios.get<ProductivityInsights>(`${API_URL}/api/analytics/productivity`, {
                    headers: getAuthHeader(),
                })
            ]);

            setTaskAnalytics(taskAnalyticsRes.data);
            setMeetingEffectiveness(meetingEffectivenessRes.data);
            setProductivityInsights(productivityInsightsRes.data);
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            if (axiosError.response?.status === 401) {
                router.push("/login");
                return;
            }
            setError("Failed to fetch analytics data.");
            console.error("Error fetching analytics:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = (): void => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login");
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString();
    };

    const getCompletionRateColor = (rate: number): string => {
        if (rate >= 80) return "text-green-400";
        if (rate >= 60) return "text-yellow-400";
        return "text-red-400";
    };


    if (!user) {
        return null;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black text-white">
                {/* Header */}
                <div className="border-b border-white/10 p-8">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div>
                            <h1 className="text-8xl font-light tracking-tight mb-2">
                                Lightkeeper
                            </h1>
                            <p className="text-gray-400 font-medium">
                                Analytics - Track meeting effectiveness and productivity
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-sm text-gray-400">
                                    {user?.email}
                                </p>
                                <p className="text-xs text-gray-500 capitalize">
                                    {user?.role}
                                </p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-8">
                        <div className="flex gap-6">
                            <button className="py-4 text-white border-b-2 border-white">
                                Analytics
                            </button>
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
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-8 py-8">
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="border-b border-white/10 p-8">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-8xl font-light tracking-tight mb-2">
                            Lightkeeper
                        </h1>
                        <p className="text-gray-400 font-medium">
                            Analytics - Track meeting effectiveness and productivity
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm text-gray-400">
                                {user.email}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                                {user.role}
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="border-b border-white/10">
                <div className="max-w-7xl mx-auto px-8">
                    <div className="flex gap-6">
                        <button className="py-4 text-white border-b-2 border-white">
                            Analytics
                        </button>
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
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 py-8">

                {/* Error Message */}
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="mb-8">
                    <div className="flex space-x-1 bg-white/5 p-1 rounded-lg border border-white/10">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-6 py-3 rounded-md transition-colors ${
                                activeTab === 'overview'
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('meetings')}
                            className={`px-6 py-3 rounded-md transition-colors ${
                                activeTab === 'meetings'
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Meeting Effectiveness
                        </button>
                        <button
                            onClick={() => setActiveTab('productivity')}
                            className={`px-6 py-3 rounded-md transition-colors ${
                                activeTab === 'productivity'
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Productivity Insights
                        </button>
                    </div>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && taskAnalytics && (
                    <div className="space-y-8">
                        {/* Key Metrics Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-400 text-sm">Total Tasks</p>
                                        <p className="text-2xl font-bold text-white">{taskAnalytics.overview.totalTasks}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                        <span className="text-blue-400 text-xl">📋</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-400 text-sm">Completion Rate</p>
                                        <p className={`text-2xl font-bold ${getCompletionRateColor(taskAnalytics.overview.completionRate)}`}>
                                            {taskAnalytics.overview.completionRate}%
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                                        <span className="text-green-400 text-xl">✅</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-400 text-sm">Overdue Tasks</p>
                                        <p className="text-2xl font-bold text-red-400">{taskAnalytics.overview.overdueTasks}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                                        <span className="text-red-400 text-xl">⚠️</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-400 text-sm">Avg. Completion Time</p>
                                        <p className="text-2xl font-bold text-white">{taskAnalytics.overview.averageCompletionTime} days</p>
                                    </div>
                                    <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                        <span className="text-purple-400 text-xl">⏱️</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Priority Distribution */}
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold text-white mb-4">Task Priority Distribution</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-green-400 mb-2">
                                        {taskAnalytics.priorityDistribution.low}
                                    </div>
                                    <div className="text-gray-400">Low Priority</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-yellow-400 mb-2">
                                        {taskAnalytics.priorityDistribution.medium}
                                    </div>
                                    <div className="text-gray-400">Medium Priority</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-red-400 mb-2">
                                        {taskAnalytics.priorityDistribution.high}
                                    </div>
                                    <div className="text-gray-400">High Priority</div>
                                </div>
                            </div>
                        </div>

                        {/* Top Performers */}
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold text-white mb-4">Top Performing Team Members</h3>
                            <div className="space-y-3">
                                {taskAnalytics.topAssignees.slice(0, 5).map((assignee, index) => (
                                    <div key={assignee._id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{assignee.name}</p>
                                                <p className="text-gray-400 text-sm">{assignee.email}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-medium">{assignee.completedTasks}/{assignee.totalTasks}</p>
                                            <p className={`text-sm ${getCompletionRateColor(assignee.completionRate)}`}>
                                                {assignee.completionRate}%
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Meeting Effectiveness Tab */}
                {activeTab === 'meetings' && meetingEffectiveness && (
                    <div className="space-y-8">
                        {/* Meeting Task Conversion */}
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold text-white mb-4">Meeting to Task Conversion</h3>
                            <div className="space-y-3">
                                {meetingEffectiveness.meetingTaskConversion.slice(0, 5).map((meeting) => (
                                    <div key={meeting._id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">{meeting.meetingTitle}</p>
                                            <p className="text-gray-400 text-sm">{formatDate(meeting.meetingDate)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-medium">{meeting.completedTasks}/{meeting.totalTasks}</p>
                                            <p className={`text-sm ${getCompletionRateColor(meeting.conversionRate)}`}>
                                                {meeting.conversionRate}% converted
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Item Follow-through */}
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold text-white mb-4">Action Item Follow-through</h3>
                            <div className="space-y-3">
                                {meetingEffectiveness.actionItemFollowThrough.slice(0, 5).map((meeting) => (
                                    <div key={meeting._id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">{meeting.meetingTitle}</p>
                                            <p className="text-gray-400 text-sm">
                                                {meeting.overdueActionItems > 0 && (
                                                    <span className="text-red-400">{meeting.overdueActionItems} overdue</span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-medium">{meeting.completedActionItems}/{meeting.totalActionItems}</p>
                                            <p className={`text-sm ${getCompletionRateColor(meeting.followThroughRate)}`}>
                                                {meeting.followThroughRate}% follow-through
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stakeholder Engagement */}
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold text-white mb-4">Stakeholder Engagement</h3>
                            <div className="space-y-3">
                                {meetingEffectiveness.stakeholderEngagement.slice(0, 5).map((stakeholder) => (
                                    <div key={stakeholder._id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">{stakeholder.name}</p>
                                            <p className="text-gray-400 text-sm">{stakeholder.email}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-medium">Score: {stakeholder.engagementScore}</p>
                                            <p className={`text-sm ${getCompletionRateColor(stakeholder.completionRate)}`}>
                                                {stakeholder.completionRate}% completion
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Productivity Insights Tab */}
                {activeTab === 'productivity' && productivityInsights && (
                    <div className="space-y-8">
                        {/* Key Insights */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                                <h4 className="text-lg font-semibold text-white mb-2">Tasks from Meetings</h4>
                                <p className="text-3xl font-bold text-blue-400 mb-2">{productivityInsights.insights.tasksFromMeetings}</p>
                                <p className="text-gray-400 text-sm">
                                    {productivityInsights.insights.meetingTaskRatio}% of all tasks
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                                <h4 className="text-lg font-semibold text-white mb-2">Total Tasks</h4>
                                <p className="text-3xl font-bold text-green-400 mb-2">{productivityInsights.insights.totalTasks}</p>
                                <p className="text-gray-400 text-sm">Across all sources</p>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                                <h4 className="text-lg font-semibold text-white mb-2">Meeting Impact</h4>
                                <p className="text-3xl font-bold text-purple-400 mb-2">
                                    {Math.round(productivityInsights.insights.meetingTaskRatio)}%
                                </p>
                                <p className="text-gray-400 text-sm">Meeting-driven tasks</p>
                            </div>
                        </div>

                        {/* Weekly Productivity */}
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold text-white mb-4">Weekly Productivity (Last 4 Weeks)</h3>
                            <div className="grid grid-cols-4 gap-4">
                                {productivityInsights.weeklyProductivity.map((week, index) => (
                                    <div key={index} className="text-center">
                                        <div className="text-2xl font-bold text-white mb-2">Week {week._id.week}</div>
                                        <div className="text-3xl font-bold text-blue-400">{week.completedTasks}</div>
                                        <div className="text-gray-400 text-sm">tasks completed</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Best Performing Days */}
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold text-white mb-4">Best Performing Days</h3>
                            <div className="grid grid-cols-7 gap-2">
                                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => {
                                    const dayData = productivityInsights.bestPerformingDays.find(d => d._id === index + 1);
                                    return (
                                        <div key={index} className="text-center">
                                            <div className="text-sm text-gray-400 mb-1">{day.slice(0, 3)}</div>
                                            <div className="text-lg font-bold text-white">
                                                {dayData?.completedTasks || 0}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Task Completion Patterns */}
                        <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold text-white mb-4">Task Completion by Hour</h3>
                            <div className="grid grid-cols-12 gap-1">
                                {Array.from({ length: 24 }, (_, hour) => {
                                    const hourData = productivityInsights.taskCompletionPatterns.find(h => h._id === hour);
                                    const height = hourData ? (hourData.completedTasks / Math.max(...productivityInsights.taskCompletionPatterns.map(h => h.completedTasks))) * 100 : 0;
                                    return (
                                        <div key={hour} className="flex flex-col items-center">
                                            <div className="text-xs text-gray-400 mb-1">{hour}</div>
                                            <div 
                                                className="bg-blue-500 w-full rounded-t"
                                                style={{ height: `${Math.max(height, 5)}px` }}
                                                title={`${hourData?.completedTasks || 0} tasks`}
                                            ></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
