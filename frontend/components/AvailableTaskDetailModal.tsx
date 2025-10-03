import axios from "axios";
import { X, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";

interface AssignedUser {
    _id: string;
    name: string;
    email: string;
}

interface Task {
    _id: string;
    title: string;
    description: string;
    status: "pending" | "completed";
    priority: "low" | "medium" | "high";
    dueDate: string;
    createdAt: string;
    assignedTo?: AssignedUser | null;
    isPrivate?: boolean;
}

interface Comment {
    _id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: string;
}

interface AvailableTaskDetailModalProps {
    isOpen: boolean;
    task: Task | null;
    API_URL: string;
    getAuthHeader: () => Record<string, string>;
    onClose: () => void;
    onAssignToMe: (taskId: string) => void;
}

export default function AvailableTaskDetailModal({
    isOpen,
    task,
    API_URL,
    getAuthHeader,
    onClose,
    onAssignToMe,
}: AvailableTaskDetailModalProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);

    useEffect(() => {
        if (isOpen && task) {
            fetchComments();
        } else {
            setComments([]);
        }
    }, [isOpen, task]);

    const fetchComments = async (): Promise<void> => {
        if (!task) return;

        setIsLoadingComments(true);
        try {
            const response = await axios.get<Comment[]>(
                `${API_URL}/api/comments/task/${task._id}`,
                {
                    headers: getAuthHeader(),
                }
            );
            setComments(response.data);
        } catch (err) {
            console.error("Error fetching comments:", err);
        } finally {
            setIsLoadingComments(false);
        }
    };

    const getPriorityColor = (priority: string): string => {
        switch (priority) {
            case "high":
                return "bg-red-500/20 text-red-400 border-red-500/30";
            case "medium":
                return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
            case "low":
                return "bg-green-500/20 text-green-400 border-green-500/30";
            default:
                return "bg-gray-500/20 text-gray-400 border-gray-500/30";
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

    const formatCommentTime = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year:
                date.getFullYear() !== now.getFullYear()
                    ? "numeric"
                    : undefined,
        });
    };

    if (!isOpen || !task) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
                onClick={onClose}
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div
                    className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl flex flex-col"
                    style={{ width: "75vw", height: "75vh" }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 flex-shrink-0">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <h2 className="text-2xl font-semibold truncate">
                                {task.title}
                            </h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => onAssignToMe(task._id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 text-sm"
                            >
                                <UserPlus className="w-4 h-4" />
                                Assign to Me
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-md hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 min-h-0">
                        {/* Main Content Area */}
                        <div className="flex-1 overflow-y-auto px-8 py-6">
                            {/* Properties Row */}
                            <div className="flex items-center gap-6 mb-6 pb-6 border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-sm">
                                        Status
                                    </span>
                                    <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded text-xs font-medium uppercase">
                                        {task.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-sm">
                                        Priority
                                    </span>
                                    <span
                                        className={`${getPriorityColor(
                                            task.priority
                                        )} border px-3 py-1 rounded text-xs font-medium uppercase`}
                                    >
                                        {task.priority}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-sm">
                                        Due Date
                                    </span>
                                    <span className="text-white text-sm">
                                        {formatDateTime(task.dueDate)}
                                    </span>
                                </div>
                            </div>

                            {/* Description Section */}
                            <div className="mb-8">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                                    Description
                                </h3>
                                <p className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
                                    {task.description}
                                </p>
                            </div>

                            {/* Comments Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                                    Comments ({comments.length})
                                </h3>
                                <p className="text-xs text-gray-500 mb-4 italic">
                                    Assign this task to add comments
                                </p>
                                {isLoadingComments ? (
                                    <div className="text-center py-8 text-gray-400">
                                        Loading comments...
                                    </div>
                                ) : comments.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 bg-white/5 rounded-lg">
                                        No comments yet
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {comments.map((comment) => (
                                            <div
                                                key={comment._id}
                                                className="bg-white/5 border border-white/10 rounded-lg p-4"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-200">
                                                            {comment.userName}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {formatCommentTime(
                                                                comment.createdAt
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="text-gray-300 text-sm whitespace-pre-wrap">
                                                    {comment.text}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Sidebar */}
                        <div className="w-80 border-l border-white/10 overflow-y-auto p-6 bg-black/20">
                            <div className="space-y-6">
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                        Assigned To
                                    </p>
                                    {task.assignedTo ? (
                                        <div className="bg-white/5 border border-white/10 rounded-md p-3">
                                            <p className="text-sm font-medium text-gray-200">
                                                {task.assignedTo.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {task.assignedTo.email}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">
                                            Unassigned
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                        Created
                                    </p>
                                    <p className="text-sm text-gray-300">
                                        {formatDateTime(task.createdAt)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
