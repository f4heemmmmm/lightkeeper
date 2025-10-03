import { useState } from "react";
import axios, { AxiosError } from "axios";
import CreateTaskModal from "../CreateTaskModal";
import TaskDetailModal from "../TaskDetailModal";

import {
    ChevronRight,
    CheckCircle2,
    Circle,
    Plus,
    LogOut,
    RotateCcw,
} from "lucide-react";

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
    dueDate: string;
    createdAt: string;
    assignedTo?: AssignedUser | null;
}

interface NewTask {
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    dueDate: string;
    dueTime: string;
}

interface ErrorResponse {
    message?: string;
}

interface OrganisationHomepageProps {
    user: User;
    tasks: Task[];
    setTasks: (tasks: Task[]) => void;
    members: Member[];
    isLoading: boolean;
    error: string | null;
    setError: (error: string | null) => void;
    selectedTask: Task | null;
    setSelectedTask: (task: Task | null) => void;
    getAuthHeader: () => Record<string, string>;
    handleLogout: () => void;
    API_URL: string;
}

export default function OrganisationHomepage({
    user,
    tasks,
    setTasks,
    members,
    isLoading,
    error,
    setError,
    selectedTask,
    setSelectedTask,
    getAuthHeader,
    handleLogout,
    API_URL,
}: OrganisationHomepageProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
    const [newTask, setNewTask] = useState<NewTask>({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        dueTime: "",
    });

    const allTasks = tasks.filter((t) => t.status !== "completed");
    const completedTasks = tasks.filter((t) => t.status === "completed");

    const createTask = async (): Promise<void> => {
        if (
            !newTask.title.trim() ||
            !newTask.description.trim() ||
            !newTask.dueDate ||
            !newTask.dueTime
        ) {
            setError("All fields are required");
            return;
        }

        try {
            const dueDateTimeISO = new Date(
                `${newTask.dueDate}T${newTask.dueTime}`
            ).toISOString();

            const response = await axios.post<Task>(
                `${API_URL}/api/tasks`,
                {
                    title: newTask.title,
                    description: newTask.description,
                    priority: newTask.priority,
                    dueDate: dueDateTimeISO,
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
            });
            setIsModalOpen(false);
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setError(
                axiosError.response?.data?.message || "Failed to create task"
            );
            console.error("Error creating task:", err);
        }
    };

    const updateTaskStatus = async (
        taskId: string,
        status: Task["status"]
    ): Promise<void> => {
        try {
            const response = await axios.put<Task>(
                `${API_URL}/api/tasks/${taskId}`,
                { status },
                { headers: getAuthHeader() }
            );

            const updatedTasks = tasks.map((task) =>
                task._id === taskId ? response.data : task
            );
            setTasks(updatedTasks);

            if (selectedTask?._id === taskId) {
                setSelectedTask(response.data);
            }
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setError(
                axiosError.response?.data?.message ||
                    "Failed to update task status"
            );
            console.error("Error updating task status:", err);
        }
    };

    const toggleTaskCompletion = async (
        task: Task,
        e: React.MouseEvent<HTMLButtonElement>
    ): Promise<void> => {
        e.stopPropagation();
        const newStatus = task.status === "completed" ? "pending" : "completed";
        await updateTaskStatus(task._id, newStatus);
    };

    const restoreTask = async (taskId: string): Promise<void> => {
        await updateTaskStatus(taskId, "pending");
        if (selectedTask?._id === taskId) {
            setIsTaskDetailModalOpen(false);
            setSelectedTask(null);
        }
    };

    const assignTaskToMember = async (
        taskId: string,
        memberId: string
    ): Promise<void> => {
        try {
            const response = await axios.put<Task>(
                `${API_URL}/api/tasks/${taskId}/assign`,
                { userId: memberId },
                { headers: getAuthHeader() }
            );

            const updatedTasks = tasks.map((t) =>
                t._id === taskId ? response.data : t
            );
            setTasks(updatedTasks);

            if (selectedTask?._id === taskId) {
                setSelectedTask(response.data);
            }

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

            const updatedTasks = tasks.map((t) =>
                t._id === taskId ? { ...t, assignedTo: null } : t
            );
            setTasks(updatedTasks);
            if (selectedTask?._id === taskId) {
                setSelectedTask({
                    ...selectedTask,
                    assignedTo: null,
                });
            }
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setError(
                axiosError.response?.data?.message || "Failed to unassign task"
            );
            console.error("Error unassigning task:", err);
        }
    };

    const deleteTask = async (id: string): Promise<void> => {
        try {
            await axios.delete(`${API_URL}/api/tasks/${id}`, {
                headers: getAuthHeader(),
            });
            setTasks(tasks.filter((task) => task._id !== id));
            if (selectedTask?._id === id) {
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

    const handleCloseModal = (): void => {
        setIsModalOpen(false);
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
                            Organisation Dashboard - Manage all tasks
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
                            Total Tasks
                        </p>
                        <p className="text-4xl font-thin">{tasks.length}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                        <p className="text-gray-400 text-md mb-1 font-semibold">
                            Completed
                        </p>
                        <p className="text-4xl font-thin">
                            {completedTasks.length}
                        </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                        <p className="text-gray-400 text-md mb-1 font-semibold">
                            Pending
                        </p>
                        <p className="text-4xl font-thin">{allTasks.length}</p>
                    </div>
                </div>
            </div>

            {/* Two Column Layout: All Tasks + Completed Tasks */}
            <div className="max-w-7xl mx-auto px-8 pb-8">
                <div className="flex gap-6 h-[calc(100vh-500px)] min-h-[400px]">
                    {/* Left Column - All Tasks */}
                    <div className="w-1/2 bg-white/5 border border-white/10 rounded-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-white/10">
                            <h2 className="text-xl font-medium">
                                All Tasks ({allTasks.length})
                            </h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="text-center py-12 text-gray-400">
                                    Loading tasks...
                                </div>
                            ) : allTasks.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <p>
                                        No active tasks. Create your first task.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/10">
                                    {allTasks.map((task) => (
                                        <div
                                            key={task._id}
                                            className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                            onClick={() =>
                                                handleTaskClick(task)
                                            }
                                        >
                                            <div className="flex items-start gap-4">
                                                <button
                                                    onClick={(e) =>
                                                        toggleTaskCompletion(
                                                            task,
                                                            e
                                                        )
                                                    }
                                                    className="flex-shrink-0 hover:scale-110 transition-transform mt-1"
                                                >
                                                    <Circle className="w-5 h-5 text-gray-400 hover:text-gray-300" />
                                                </button>
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
                                                        {task.assignedTo ? (
                                                            <span className="text-gray-400">
                                                                Assigned to:{" "}
                                                                {
                                                                    task
                                                                        .assignedTo
                                                                        .name
                                                                }
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-500">
                                                                Unassigned
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

                    {/* Right Column - Completed Tasks */}
                    <div className="w-1/2 bg-white/5 border border-white/10 rounded-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-white/10">
                            <h2 className="text-xl font-medium">
                                Completed Tasks ({completedTasks.length})
                            </h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {completedTasks.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <p>No completed tasks yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/10">
                                    {completedTasks.map((task) => (
                                        <div
                                            key={task._id}
                                            className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                            onClick={() =>
                                                handleTaskClick(task)
                                            }
                                        >
                                            <div className="flex items-start gap-4">
                                                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-base font-medium line-through text-gray-500 mb-2">
                                                        {task.title}
                                                    </h3>
                                                    <div className="flex flex-wrap gap-3 text-xs">
                                                        <span className="text-gray-500">
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
                                                        {task.assignedTo && (
                                                            <span className="text-gray-500">
                                                                Assigned to:{" "}
                                                                {
                                                                    task
                                                                        .assignedTo
                                                                        .name
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) =>
                                                        toggleTaskCompletion(
                                                            task,
                                                            e
                                                        )
                                                    }
                                                    className="flex-shrink-0 p-2 text-gray-400 hover:text-blue-400 transition-colors"
                                                    title="Restore task"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Action Button */}
            <div className="fixed bottom-8 right-8 flex flex-col gap-3">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-white text-black p-4 rounded-full shadow-lg hover:bg-gray-100 transition-colors flex items-center justify-center group"
                    title="Create new task"
                >
                    <Plus className="w-6 h-6" />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap ml-0 group-hover:ml-2 font-medium">
                        Create Task
                    </span>
                </button>
            </div>

            {/* Task Detail Modal */}
            <TaskDetailModal
                isOpen={isTaskDetailModalOpen}
                task={selectedTask}
                members={members}
                userRole="organisation"
                userId={user.id}
                API_URL={API_URL}
                getAuthHeader={getAuthHeader}
                onClose={handleCloseTaskDetailModal}
                onDelete={deleteTask}
                onUnassign={unassignTask}
                onAssign={assignTaskToMember}
                onRestoreTask={restoreTask}
            />

            {/* Create Task Modal */}
            <CreateTaskModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={createTask}
                newTask={newTask}
                setNewTask={setNewTask}
            />
        </div>
    );
}
