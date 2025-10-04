import { useState, useEffect } from "react";
import {
    X,
    Trash2,
    UserMinus,
    UserCheck,
    RotateCcw,
    Send,
    Edit2,
    Check,
} from "lucide-react";
import axios, { AxiosError } from "axios";

interface AssignedUser {
    _id: string;
    name: string;
    email: string;
}

interface Member {
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
    dueDate: string | null;
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

interface ErrorResponse {
    message?: string;
}

interface TaskDetailModalProps {
    isOpen: boolean;
    task: Task | null;
    members?: Member[];
    userRole: "organisation" | "member";
    userId: string;
    API_URL: string;
    getAuthHeader: () => Record<string, string>;
    onClose: () => void;
    onDelete: (taskId: string) => void;
    onUnassign?: (taskId: string) => void;
    onAssign?: (taskId: string, memberId: string) => void;
    onRestoreTask?: (taskId: string) => void;
}

export default function TaskDetailModal({
    isOpen,
    task,
    members = [],
    userRole,
    userId,
    API_URL,
    getAuthHeader,
    onClose,
    onDelete,
    onUnassign,
    onAssign,
    onRestoreTask,
}: TaskDetailModalProps) {
    const [selectedMemberId, setSelectedMemberId] = useState<string>("");
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState<string>("");
    const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
    const [commentError, setCommentError] = useState<string | null>(null);
    const [isSubmittingComment, setIsSubmittingComment] =
        useState<boolean>(false);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(
        null
    );
    const [editCommentText, setEditCommentText] = useState<string>("");
    const [isEditingTask, setIsEditingTask] = useState<boolean>(false);
    const [editedTask, setEditedTask] = useState<Task | null>(null);

    useEffect(() => {
        if (isOpen && task) {
            fetchComments();
            setEditedTask(task);
        } else {
            setComments([]);
            setNewComment("");
            setCommentError(null);
            setEditingCommentId(null);
            setEditCommentText("");
            setIsEditingTask(false);
            setEditedTask(null);
        }
    }, [isOpen, task]);

    const fetchComments = async (): Promise<void> => {
        if (!task) return;

        setIsLoadingComments(true);
        setCommentError(null);
        try {
            const response = await axios.get<Comment[]>(
                `${API_URL}/api/comments/task/${task._id}`,
                {
                    headers: getAuthHeader(),
                }
            );
            setComments(response.data);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setCommentError(
                axiosError.response?.data?.message || "Failed to load comments"
            );
            console.error("Error fetching comments:", err);
        } finally {
            setIsLoadingComments(false);
        }
    };

    const handleSubmitComment = async (): Promise<void> => {
        if (!task || !newComment.trim()) return;

        setIsSubmittingComment(true);
        setCommentError(null);
        try {
            const response = await axios.post<Comment>(
                `${API_URL}/api/comments/task/${task._id}`,
                { text: newComment.trim() },
                {
                    headers: getAuthHeader(),
                }
            );
            setComments([...comments, response.data]);
            setNewComment("");
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setCommentError(
                axiosError.response?.data?.message || "Failed to post comment"
            );
            console.error("Error posting comment:", err);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleEditComment = (comment: Comment): void => {
        setEditingCommentId(comment._id);
        setEditCommentText(comment.text);
    };

    const handleUpdateComment = async (commentId: string): Promise<void> => {
        if (!editCommentText.trim()) return;

        try {
            const response = await axios.put<Comment>(
                `${API_URL}/api/comments/${commentId}`,
                { text: editCommentText.trim() },
                {
                    headers: getAuthHeader(),
                }
            );
            setComments(
                comments.map((c) => (c._id === commentId ? response.data : c))
            );
            setEditingCommentId(null);
            setEditCommentText("");
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setCommentError(
                axiosError.response?.data?.message || "Failed to update comment"
            );
            console.error("Error updating comment:", err);
        }
    };

    const handleCancelEditComment = (): void => {
        setEditingCommentId(null);
        setEditCommentText("");
    };

    const handleDeleteComment = async (commentId: string): Promise<void> => {
        try {
            await axios.delete(`${API_URL}/api/comments/${commentId}`, {
                headers: getAuthHeader(),
            });
            setComments(comments.filter((c) => c._id !== commentId));
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setCommentError(
                axiosError.response?.data?.message || "Failed to delete comment"
            );
            console.error("Error deleting comment:", err);
        }
    };

    const handleEditTask = (): void => {
        setIsEditingTask(true);
    };

    const handleSaveTask = async (): Promise<void> => {
        if (!editedTask || !task) return;

        try {
            const dueDateTimeISO = new Date(editedTask.dueDate).toISOString();

            await axios.put(
                `${API_URL}/api/tasks/${task._id}`,
                {
                    title: editedTask.title,
                    description: editedTask.description,
                    priority: editedTask.priority,
                    dueDate: dueDateTimeISO,
                },
                {
                    headers: getAuthHeader(),
                }
            );

            setIsEditingTask(false);
            window.location.reload();
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setCommentError(
                axiosError.response?.data?.message || "Failed to update task"
            );
            console.error("Error updating task:", err);
        }
    };

    const handleCancelEditTask = (): void => {
        setIsEditingTask(false);
        setEditedTask(task);
    };

    const handleKeyPress = (
        e: React.KeyboardEvent<HTMLTextAreaElement>
    ): void => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmitComment();
        }
    };

    if (!isOpen || !task || !editedTask) return null;

    const handleAssign = (): void => {
        if (selectedMemberId && onAssign) {
            onAssign(task._id, selectedMemberId);
            setSelectedMemberId("");
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

    const formatDateTime = (dateString: string | null): string | null => {
        if (!dateString) return null;
        const date = new Date(dateString);
        // Check for invalid date
        if (isNaN(date.getTime())) return null;
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const formatDateForInput = (dateString: string | null): string => {
        if (!dateString) return "";
        const date = new Date(dateString);
        // Check for invalid date
        if (isNaN(date.getTime())) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
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

    const renderActionButtons = () => {
        if (userRole === "organisation") {
            return (
                <>
                    {!isEditingTask && (
                        <button
                            onClick={handleEditTask}
                            className="text-gray-400 hover:text-blue-400 transition-colors p-2 rounded-md hover:bg-white/10"
                            title="Edit task"
                        >
                            <Edit2 className="w-5 h-5" />
                        </button>
                    )}
                    {task.status === "completed" && onRestoreTask && (
                        <button
                            onClick={() => onRestoreTask(task._id)}
                            className="text-gray-400 hover:text-blue-400 transition-colors p-2 rounded-md hover:bg-white/10"
                            title="Restore task"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    )}
                    {task.assignedTo &&
                        onUnassign &&
                        task.status !== "completed" && (
                            <button
                                onClick={() => onUnassign(task._id)}
                                className="text-gray-400 hover:text-yellow-400 transition-colors p-2 rounded-md hover:bg-white/10"
                                title="Unassign task"
                            >
                                <UserMinus className="w-5 h-5" />
                            </button>
                        )}
                    <button
                        onClick={() => onDelete(task._id)}
                        className="text-gray-400 hover:text-red-400 transition-colors p-2 rounded-md hover:bg-white/10"
                        title="Delete task"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </>
            );
        } else {
            return (
                <>
                    {task.isPrivate && !isEditingTask && (
                        <button
                            onClick={handleEditTask}
                            className="text-gray-400 hover:text-blue-400 transition-colors p-2 rounded-md hover:bg-white/10"
                            title="Edit task"
                        >
                            <Edit2 className="w-5 h-5" />
                        </button>
                    )}
                    {task.isPrivate ? (
                        <button
                            onClick={() => onDelete(task._id)}
                            className="text-gray-400 hover:text-red-400 transition-colors p-2 rounded-md hover:bg-white/10"
                            title="Delete private task"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    ) : (
                        task.assignedTo &&
                        onUnassign && (
                            <button
                                onClick={() => onUnassign(task._id)}
                                className="text-gray-400 hover:text-yellow-400 transition-colors p-2 rounded-md hover:bg-white/10"
                                title="Unassign from me"
                            >
                                <UserMinus className="w-5 h-5" />
                            </button>
                        )
                    )}
                </>
            );
        }
    };

    const canComment = task.isPrivate
        ? true // Private task creators can always comment on their own tasks
        : userRole === "organisation" || task.assignedTo?._id === userId;

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
                            {isEditingTask ? (
                                <input
                                    type="text"
                                    value={editedTask.title}
                                    onChange={(e) =>
                                        setEditedTask({
                                            ...editedTask,
                                            title: e.target.value,
                                        })
                                    }
                                    className="text-2xl font-semibold bg-white/5 border border-white/10 rounded-md px-3 py-1 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    maxLength={100}
                                />
                            ) : (
                                <h2 className="text-2xl font-semibold truncate">
                                    {task.title}
                                </h2>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {isEditingTask ? (
                                <>
                                    <button
                                        onClick={handleSaveTask}
                                        className="text-green-400 hover:text-green-300 transition-colors p-2 rounded-md hover:bg-white/10"
                                        title="Save changes"
                                    >
                                        <Check className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={handleCancelEditTask}
                                        className="text-gray-400 hover:text-white transition-colors p-2 rounded-md hover:bg-white/10"
                                        title="Cancel editing"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    {renderActionButtons()}
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-md hover:bg-white/10 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </>
                            )}
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
                                    {isEditingTask ? (
                                        <select
                                            value={editedTask.priority}
                                            onChange={(e) =>
                                                setEditedTask({
                                                    ...editedTask,
                                                    priority: e.target.value as
                                                        | "low"
                                                        | "medium"
                                                        | "high",
                                                })
                                            }
                                            className="bg-white/5 border border-white/10 rounded px-3 py-1 text-xs font-medium uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white"
                                        >
                                            <option
                                                value="low"
                                                className="bg-black"
                                            >
                                                LOW
                                            </option>
                                            <option
                                                value="medium"
                                                className="bg-black"
                                            >
                                                MEDIUM
                                            </option>
                                            <option
                                                value="high"
                                                className="bg-black"
                                            >
                                                HIGH
                                            </option>
                                        </select>
                                    ) : (
                                        <span
                                            className={`${getPriorityColor(
                                                task.priority
                                            )} border px-3 py-1 rounded text-xs font-medium uppercase`}
                                        >
                                            {task.priority}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-sm">
                                        Due Date <span className="text-gray-500 text-xs">(Optional)</span>
                                    </span>
                                    {isEditingTask ? (
                                        <input
                                            type="datetime-local"
                                            value={formatDateForInput(
                                                editedTask.dueDate
                                            )}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setEditedTask({
                                                    ...editedTask,
                                                    dueDate: value ? new Date(value).toISOString() : null,
                                                });
                                            }}
                                            className="bg-white/5 border border-white/10 rounded px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        />
                                    ) : (
                                        <span className="text-white text-sm">
                                            {task.dueDate && formatDateTime(task.dueDate) ? formatDateTime(task.dueDate) : "No due date set"}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Description Section */}
                            <div className="mb-8">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                                    Description
                                </h3>
                                {isEditingTask ? (
                                    <textarea
                                        value={editedTask.description}
                                        onChange={(e) =>
                                            setEditedTask({
                                                ...editedTask,
                                                description: e.target.value,
                                            })
                                        }
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                        rows={5}
                                        maxLength={500}
                                    />
                                ) : (
                                    <p className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
                                        {task.description}
                                    </p>
                                )}
                            </div>

                            {/* Comments Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                                    Comments ({comments.length})
                                </h3>
                                {isLoadingComments ? (
                                    <div className="text-center py-8 text-gray-400">
                                        Loading comments...
                                    </div>
                                ) : commentError ? (
                                    <div className="text-center py-8 text-red-400">
                                        {commentError}
                                    </div>
                                ) : comments.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 bg-white/5 rounded-lg">
                                        No comments yet. Be the first to
                                        comment!
                                    </div>
                                ) : (
                                    <div className="space-y-3 mb-6">
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
                                                    {comment.userId ===
                                                        userId && (
                                                        <div className="flex gap-1">
                                                            {editingCommentId !==
                                                                comment._id && (
                                                                <button
                                                                    onClick={() =>
                                                                        handleEditComment(
                                                                            comment
                                                                        )
                                                                    }
                                                                    className="text-gray-500 hover:text-blue-400 transition-colors p-1 rounded hover:bg-white/10"
                                                                    title="Edit comment"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {(comment.userId ===
                                                                userId ||
                                                                userRole ===
                                                                    "organisation") && (
                                                                <button
                                                                    onClick={() =>
                                                                        handleDeleteComment(
                                                                            comment._id
                                                                        )
                                                                    }
                                                                    className="text-gray-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-white/10"
                                                                    title="Delete comment"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {editingCommentId ===
                                                comment._id ? (
                                                    <div className="space-y-2">
                                                        <textarea
                                                            value={
                                                                editCommentText
                                                            }
                                                            onChange={(e) =>
                                                                setEditCommentText(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                                            rows={3}
                                                            maxLength={500}
                                                        />
                                                        <div className="flex gap-2 justify-end">
                                                            <button
                                                                onClick={
                                                                    handleCancelEditComment
                                                                }
                                                                className="px-3 py-1 text-sm text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    handleUpdateComment(
                                                                        comment._id
                                                                    )
                                                                }
                                                                disabled={
                                                                    !editCommentText.trim()
                                                                }
                                                                className="px-3 py-1 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md transition-colors"
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-300 text-sm whitespace-pre-wrap">
                                                        {comment.text}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Comment Input */}
                                {canComment && (
                                    <div className="mt-4">
                                        <div className="relative">
                                            <textarea
                                                value={newComment}
                                                onChange={(e) =>
                                                    setNewComment(
                                                        e.target.value
                                                    )
                                                }
                                                onKeyPress={handleKeyPress}
                                                placeholder="Add a comment..."
                                                maxLength={500}
                                                rows={3}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none placeholder-gray-500"
                                            />
                                            <button
                                                onClick={handleSubmitComment}
                                                disabled={
                                                    !newComment.trim() ||
                                                    isSubmittingComment
                                                }
                                                className="absolute bottom-3 right-3 p-2 bg-white/10 hover:bg-white/20 text-white rounded-md disabled:bg-white/5 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Press Enter to send, Shift+Enter for
                                            new line
                                        </p>
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
                                    {isEditingTask && userRole === "organisation" ? (
                                        // Edit mode - show assignment controls
                                        <div className="space-y-3">
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
                                                    Not assigned yet
                                                </p>
                                            )}
                                            
                                            {/* Assignment Controls */}
                                            <div className="space-y-2">
                                                <select
                                                    value={selectedMemberId}
                                                    onChange={(e) =>
                                                        setSelectedMemberId(
                                                            e.target.value
                                                        )
                                                    }
                                                    className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                >
                                                    <option value="">
                                                        {task.assignedTo ? "Change assignment..." : "Select a member..."}
                                                    </option>
                                                    {members.map((member) => (
                                                        <option
                                                            key={member._id}
                                                            value={member._id}
                                                            className="bg-black"
                                                        >
                                                            {member.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                
                                                <div className="flex gap-2">
                                                    {selectedMemberId && (
                                                        <button
                                                            onClick={handleAssign}
                                                            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <UserCheck className="w-4 h-4" />
                                                            {task.assignedTo ? "Reassign" : "Assign"}
                                                        </button>
                                                    )}
                                                    
                                                    {task.assignedTo && onUnassign && (
                                                        <button
                                                            onClick={() => onUnassign(task._id)}
                                                            className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <UserMinus className="w-4 h-4" />
                                                            Unassign
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : task.assignedTo ? (
                                        // View mode - show current assignee
                                        <div className="bg-white/5 border border-white/10 rounded-md p-3">
                                            <p className="text-sm font-medium text-gray-200">
                                                {task.assignedTo.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {task.assignedTo.email}
                                            </p>
                                        </div>
                                    ) : userRole === "organisation" &&
                                      onAssign ? (
                                        // View mode - show assignment option
                                        <div className="space-y-2">
                                            <select
                                                value={selectedMemberId}
                                                onChange={(e) =>
                                                    setSelectedMemberId(
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            >
                                                <option value="">
                                                    Select a member...
                                                </option>
                                                {members.map((member) => (
                                                    <option
                                                        key={member._id}
                                                        value={member._id}
                                                        className="bg-black"
                                                    >
                                                        {member.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={handleAssign}
                                                disabled={!selectedMemberId}
                                                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                            >
                                                <UserCheck className="w-4 h-4" />
                                                Assign
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">
                                            Not assigned yet
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

                                {task.isPrivate && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                            Visibility
                                        </p>
                                        <span className="inline-flex items-center bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded text-xs font-medium">
                                            Private
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
