import axios, { AxiosError } from "axios";
import { useState, useEffect } from "react";
import TaskDetailModal from "../TaskDetailModal";
import { ChevronRight, LogOut, X, Plus } from "lucide-react";
import AvailableTaskDetailModal from "../AvailableTaskDetailModal";

interface User {
    id: string;
    email: string;
    name: string;
    role: "organisation" | "member";
}

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

interface NewTask {
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    dueDate: string;
    dueTime: string;
    isPrivate?: boolean;
}

interface ErrorResponse {
    message?: string;
}

interface MemberHomepageProps {
    user: User;
    tasks: Task[];
    setTasks: (tasks: Task[]) => void;
    isLoading: boolean;
    error: string | null;
    setError: (error: string | null) => void;
    selectedTask: Task | null;
    setSelectedTask: (task: Task | null) => void;
    getAuthHeader: () => Record<string, string>;
    handleLogout: () => void;
    API_URL: string;
}

export default function MemberHomepage({
    user,
    tasks,
    setTasks,
    isLoading,
    error,
    setError,
    selectedTask,
    setSelectedTask,
    getAuthHeader,
    handleLogout,
    API_URL,
}: MemberHomepageProps) {
    const [unassignedTasks, setUnassignedTasks] = useState<Task[]>([]);
    const [loadingUnassigned, setLoadingUnassigned] = useState<boolean>(false);
    const [showAvailableTasksPanel, setShowAvailableTasksPanel] =
        useState<boolean>(false);
    const [showCreateTaskModal, setShowCreateTaskModal] =
        useState<boolean>(false);
    const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
    const [isAvailableTaskModalOpen, setIsAvailableTaskModalOpen] =
        useState(false);
    const [selectedAvailableTask, setSelectedAvailableTask] =
        useState<Task | null>(null);
    const [newTask, setNewTask] = useState<NewTask>({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        dueTime: "",
        isPrivate: true,
    });

    const fetchUnassignedTasks = async (): Promise<void> => {
        setLoadingUnassigned(true);
        try {
            const response = await axios.get<Task[]>(
                `${API_URL}/api/tasks/unassigned`,
                {
                    headers: getAuthHeader(),
                }
            );
            setUnassignedTasks(response.data);
        } catch (err) {
            console.error("Error fetching unassigned tasks:", err);
        } finally {
            setLoadingUnassigned(false);
        }
    };

    useEffect(() => {
        fetchUnassignedTasks();
    }, []);

    const createTask = async (): Promise<void> => {
        if (
            !newTask.title.trim() ||
            !newTask.description.trim()
        ) {
            setError("Title and description are required");
            return;
        }

        // If date is provided, time must also be provided
        if (newTask.dueDate && !newTask.dueTime) {
            setError("Time is required when date is set");
            return;
        }

        try {
            let dueDateTimeISO = null;
            if (newTask.dueDate && newTask.dueTime) {
                dueDateTimeISO = new Date(
                    `${newTask.dueDate}T${newTask.dueTime}`
                ).toISOString();
            }

            const response = await axios.post<Task>(
                `${API_URL}/api/tasks`,
                {
                    title: newTask.title,
                    description: newTask.description,
                    priority: newTask.priority,
                    dueDate: dueDateTimeISO,
                    isPrivate: true,
                    status: "pending",
                },
                {
                    headers: getAuthHeader(),
                }
            );

            setTasks([response.data, ...tasks]);
            setNewTask({
                title: "",
                description: "",
                priority: "medium",
                dueDate: "",
                dueTime: "",
                isPrivate: true,
            });
            setShowCreateTaskModal(false);
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setError(
                axiosError.response?.data?.message || "Failed to create task"
            );
            console.error("Error creating task:", err);
        }
    };

    const assignTaskToSelf = async (taskId: string): Promise<void> => {
        try {
            const response = await axios.put<Task>(
                `${API_URL}/api/tasks/${taskId}/assign`,
                {},
                { headers: getAuthHeader() }
            );

            setTasks([response.data, ...tasks]);
            setUnassignedTasks(unassignedTasks.filter((t) => t._id !== taskId));

            // Close modals after assignment
            setIsAvailableTaskModalOpen(false);
            setSelectedAvailableTask(null);
            setShowAvailableTasksPanel(false);

            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setError(
                axiosError.response?.data?.message || "Failed to assign task"
            );
            console.error("Error assigning task:", err);
        }
    };

    const unassignTask = async (taskId: string): Promise<void> => {
        try {
            await axios.put(
                `${API_URL}/api/tasks/${taskId}/unassign`,
                {},
                { headers: getAuthHeader() }
            );

            setTasks(tasks.filter((t) => t._id !== taskId));
            if (selectedTask?._id === taskId) {
                setSelectedTask(null);
                setIsTaskDetailModalOpen(false);
            }
            await fetchUnassignedTasks();
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setError(
                axiosError.response?.data?.message || "Failed to unassign task"
            );
            console.error("Error unassigning task:", err);
        }
    };

    const deleteTask = async (taskId: string): Promise<void> => {
        try {
            await axios.delete(`${API_URL}/api/tasks/${taskId}`, {
                headers: getAuthHeader(),
            });

            setTasks(tasks.filter((task) => task._id !== taskId));
            if (selectedTask?._id === taskId) {
                setSelectedTask(null);
                setIsTaskDetailModalOpen(false);
            }
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setError(
                axiosError.response?.data?.message || "Failed to delete task"
            );
            console.error("Error deleting task:", err);
        }
    };

    const handleAvailableTasksClick = async (): Promise<void> => {
        if (!showAvailableTasksPanel) {
            await fetchUnassignedTasks();
        }
        setShowAvailableTasksPanel(!showAvailableTasksPanel);
    };

    const handleCloseCreateModal = (): void => {
        setShowCreateTaskModal(false);
        setError(null);
    };

    const handleTaskClick = (task: Task): void => {
        setSelectedTask(task);
        setIsTaskDetailModalOpen(true);
    };

    const handleCloseTaskDetailModal = (): void => {
        setIsTaskDetailModalOpen(false);
        setSelectedTask(null);
    };

    const handleAvailableTaskClick = (task: Task): void => {
        setSelectedAvailableTask(task);
        setIsAvailableTaskModalOpen(true);
    };

    const handleCloseAvailableTaskModal = (): void => {
        setIsAvailableTaskModalOpen(false);
        setSelectedAvailableTask(null);
    };

    const getPriorityColor = (priority: string): string => {
        switch (priority) {
            case "high":
                return "text-red-400";
            case "medium":
                return "text-yellow-400";
            case "low":
                return "text-green-400";
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
                            Member Dashboard - Your assigned tasks
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
                        <button
                            onClick={() => (window.location.href = "/analytics")}
                            className="py-4 text-gray-400 hover:text-white transition-colors"
                        >
                            Analytics
                        </button>
                        <button className="py-4 text-white border-b-2 border-white">
                            Tasks
                        </button>
                        <button
                            onClick={() => (window.location.href = "/meetings")}
                            className="py-4 text-gray-400 hover:text-white transition-colors"
                        >
                            Meetings
                        </button>
                        <button
                            onClick={() =>
                                (window.location.href = "/notetaker")
                            }
                            className="py-4 text-gray-400 hover:text-white transition-colors"
                        >
                            AI Notetaker
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

            {/* Stats */}
            <div className="max-w-7xl mx-auto px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                        <p className="text-gray-400 text-md mb-1 font-semibold">
                            My Tasks
                        </p>
                        <p className="text-4xl font-thin">{tasks.length}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                        <p className="text-gray-400 text-md mb-1 font-semibold">
                            Assigned to Me
                        </p>
                        <p className="text-4xl font-thin">
                            {tasks.filter((t) => !t.isPrivate).length}
                        </p>
                    </div>
                    <div
                        className="bg-white/5 border border-white/10 rounded-lg p-6 cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={handleAvailableTasksClick}
                    >
                        <p className="text-gray-400 text-md mb-1 font-semibold">
                            Available Tasks
                        </p>
                        <p className="text-4xl font-thin">
                            {unassignedTasks.length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Task List */}
            <div className="max-w-7xl mx-auto px-8 pb-8">
                <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10">
                        <h2 className="text-xl font-medium">
                            My Tasks ({tasks.length})
                        </h2>
                    </div>
                    <div className="max-h-[calc(100vh-450px)] overflow-y-auto">
                        {isLoading ? (
                            <div className="text-center py-12 text-gray-400">
                                Loading tasks...
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <p>
                                    No tasks yet. Browse available tasks or
                                    create your own.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/10">
                                {tasks.map((task) => (
                                    <div
                                        key={task._id}
                                        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() => handleTaskClick(task)}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-base font-medium mb-2">
                                                    {task.title}
                                                </h3>
                                                <div className="flex flex-wrap gap-3 text-xs">
                                                    <span className="text-gray-400">
                                                        Due:{" "}
                                                        {formatDateTime(
                                                            task.dueDate
                                                        )}
                                                    </span>
                                                    <span
                                                        className={getPriorityColor(
                                                            task.priority
                                                        )}
                                                    >
                                                        {task.priority.toUpperCase()}
                                                    </span>
                                                    {task.isPrivate && (
                                                        <span className="text-purple-400">
                                                            PRIVATE
                                                        </span>
                                                    )}
                                                    {task.assignedTo && (
                                                        <span className="text-gray-400">
                                                            Assigned to:{" "}
                                                            {
                                                                task.assignedTo
                                                                    .name
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Action Button */}
            <div className="fixed bottom-8 right-8 flex flex-col gap-3">
                <button
                    onClick={() => setShowCreateTaskModal(true)}
                    className="bg-white text-black p-4 rounded-full shadow-lg hover:bg-gray-100 transition-colors flex items-center justify-center group"
                    title="Create new task"
                >
                    <Plus className="w-6 h-6" />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap ml-0 group-hover:ml-2 font-medium">
                        Create Task
                    </span>
                </button>
            </div>

            {/* Task Detail Modal - For Member's Own Tasks */}
            <TaskDetailModal
                isOpen={isTaskDetailModalOpen}
                task={selectedTask}
                userRole="member"
                userId={user.id}
                API_URL={API_URL}
                getAuthHeader={getAuthHeader}
                onClose={handleCloseTaskDetailModal}
                onDelete={deleteTask}
                onUnassign={unassignTask}
            />

            {/* Available Task Detail Modal - With Assign to Me Button */}
            <AvailableTaskDetailModal
                isOpen={isAvailableTaskModalOpen}
                task={selectedAvailableTask}
                API_URL={API_URL}
                getAuthHeader={getAuthHeader}
                onClose={handleCloseAvailableTaskModal}
                onAssignToMe={assignTaskToSelf}
            />

            {/* Available Tasks Side Panel */}
            <>
                <div
                    className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
                        showAvailableTasksPanel
                            ? "opacity-100"
                            : "opacity-0 pointer-events-none"
                    }`}
                    onClick={() => setShowAvailableTasksPanel(false)}
                />

                <div
                    className={`fixed right-0 top-0 h-full w-[500px] bg-black border-l border-white/10 z-50 shadow-2xl transition-transform duration-300 ease-in-out ${
                        showAvailableTasksPanel
                            ? "translate-x-0"
                            : "translate-x-full"
                    }`}
                >
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                            <h2 className="text-2xl font-light">
                                Available Tasks
                            </h2>
                            <button
                                onClick={() =>
                                    setShowAvailableTasksPanel(false)
                                }
                                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingUnassigned ? (
                                <div className="text-center py-12 text-gray-400">
                                    Loading available tasks...
                                </div>
                            ) : unassignedTasks.length === 0 ? (
                                <p className="text-center text-gray-400 py-8">
                                    No available tasks at the moment
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {unassignedTasks.map((task) => (
                                        <div
                                            key={task._id}
                                            className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
                                            onClick={() =>
                                                handleAvailableTaskClick(task)
                                            }
                                        >
                                            <div className="mb-3">
                                                <h3 className="font-medium text-base mb-2">
                                                    {task.title}
                                                </h3>
                                                <p className="text-gray-400 text-xs mb-3 line-clamp-2">
                                                    {task.description}
                                                </p>
                                                <div className="flex gap-3 text-xs">
                                                    <span
                                                        className={getPriorityColor(
                                                            task.priority
                                                        )}
                                                    >
                                                        {task.priority.toUpperCase()}
                                                    </span>
                                                    <span className="text-gray-500">
                                                        Due:{" "}
                                                        {formatDateTime(
                                                            task.dueDate
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </>

            {/* Create Task Modal */}
            {showCreateTaskModal && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                    onClick={handleCloseCreateModal}
                >
                    <div
                        className="bg-black border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
                            <div>
                                <h2 className="text-2xl font-light">
                                    Create Personal Task
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    Private to-do item, only visible to you
                                </p>
                            </div>
                            <button
                                onClick={handleCloseCreateModal}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Task Title
                                </label>
                                <input
                                    type="text"
                                    value={newTask.title}
                                    onChange={(e) =>
                                        setNewTask({
                                            ...newTask,
                                            title: e.target.value,
                                        })
                                    }
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                                    placeholder="Enter task title"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={newTask.description}
                                    onChange={(e) =>
                                        setNewTask({
                                            ...newTask,
                                            description: e.target.value,
                                        })
                                    }
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-white/20 min-h-[100px]"
                                    placeholder="Enter task description"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">
                                        Priority
                                    </label>
                                    <select
                                        value={newTask.priority}
                                        onChange={(e) =>
                                            setNewTask({
                                                ...newTask,
                                                priority: e.target
                                                    .value as NewTask["priority"],
                                            })
                                        }
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                                    >
                                        <option
                                            value="low"
                                            className="bg-black"
                                        >
                                            Low
                                        </option>
                                        <option
                                            value="medium"
                                            className="bg-black"
                                        >
                                            Medium
                                        </option>
                                        <option
                                            value="high"
                                            className="bg-black"
                                        >
                                            High
                                        </option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">
                                        Due Date
                                    </label>
                                    <input
                                        type="date"
                                        value={newTask.dueDate}
                                        onChange={(e) =>
                                            setNewTask({
                                                ...newTask,
                                                dueDate: e.target.value,
                                            })
                                        }
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Due Time
                                </label>
                                <input
                                    type="time"
                                    value={newTask.dueTime}
                                    onChange={(e) =>
                                        setNewTask({
                                            ...newTask,
                                            dueTime: e.target.value,
                                        })
                                    }
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                onClick={handleCloseCreateModal}
                                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createTask}
                                className="flex-1 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors"
                            >
                                Create Task
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
