import { useRouter } from "next/router";

interface NavigationProps {
    currentPage?: "tasks" | "meetings" | "analytics";
    user?: {
        id: string;
        email: string;
        name: string;
        role: "organisation" | "member";
    };
    handleLogout?: () => void;
}

export default function Navigation({ currentPage, user, handleLogout }: NavigationProps) {
    const router = useRouter();

    return (
        <div className="border-b border-white/10">
            <div className="max-w-7xl mx-auto px-8">
                <div className="flex justify-between items-center">
                    <div className="flex gap-6">
                        <button
                            onClick={() => router.push("/analytics")}
                            className={`py-4 transition-colors ${
                                currentPage === "analytics"
                                    ? "text-white border-b-2 border-white"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Analytics
                        </button>
                        <button
                            onClick={() => router.push("/")}
                            className={`py-4 transition-colors ${
                                currentPage === "tasks"
                                    ? "text-white border-b-2 border-white"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Tasks
                        </button>
                        <button
                            onClick={() => router.push("/meetings")}
                            className={`py-4 transition-colors ${
                                currentPage === "meetings"
                                    ? "text-white border-b-2 border-white"
                                    : "text-gray-400 hover:text-white"
                            }`}
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
                    
                    {user && handleLogout && (
                        <div className="flex items-center gap-4">
                            <span className="text-gray-400">Welcome, {user.name}</span>
                            <button
                                onClick={handleLogout}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
