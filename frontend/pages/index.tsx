import { useRouter } from "next/router";
import axios, { AxiosError } from "axios";
import { useState, useEffect } from "react";
import MemberHomepage from "@/components/homepage/MemberHomepage";
import OrganisationHomepage from "@/components/homepage/OrganisationHomepage";

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
    isPrivate?: boolean;
}

interface ErrorResponse {
    message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function TaskDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
            if (parsedUser.role === "organisation") {
                fetchMembers();
            }
        } catch (err) {
            console.error("Error parsing user data:", err);
            router.push("/login");
        }
    }, [router]);

    const fetchTasks = async (): Promise<void> => {
        try {
            setIsLoading(true);
            const response = await axios.get<Task[]>(`${API_URL}/api/tasks`, {
                headers: getAuthHeader(),
            });
            setTasks(response.data);
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            if (axiosError.response?.status === 401) {
                router.push("/login");
                return;
            }
            setError("Failed to fetch tasks.");
            console.error("Error fetching tasks:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMembers = async (): Promise<void> => {
        try {
            const response = await axios.get<Member[]>(
                `${API_URL}/api/users/members`,
                {
                    headers: getAuthHeader(),
                }
            );
            setMembers(response.data);
        } catch (err) {
            console.error("Error fetching members:", err);
        }
    };

    const handleLogout = (): void => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login");
    };

    if (!user) {
        return null;
    }

    return user.role === "organisation" ? (
        <OrganisationHomepage
            user={user}
            tasks={tasks}
            setTasks={setTasks}
            members={members}
            isLoading={isLoading}
            error={error}
            setError={setError}
            selectedTask={selectedTask}
            setSelectedTask={setSelectedTask}
            getAuthHeader={getAuthHeader}
            handleLogout={handleLogout}
            API_URL={API_URL}
        />
    ) : (
        <MemberHomepage
            user={user}
            tasks={tasks}
            setTasks={setTasks}
            isLoading={isLoading}
            error={error}
            setError={setError}
            selectedTask={selectedTask}
            setSelectedTask={setSelectedTask}
            getAuthHeader={getAuthHeader}
            handleLogout={handleLogout}
            API_URL={API_URL}
        />
    );
}
