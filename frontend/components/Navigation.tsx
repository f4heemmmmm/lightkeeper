import { useRouter } from "next/router";

interface NavigationProps {
    currentPage: "tasks" | "meetings";
}

export default function Navigation({ currentPage }: NavigationProps) {
    const router = useRouter();

    return (
        <div className="border-b border-white/10">
            <div className="max-w-7xl mx-auto px-8">
                <div className="flex gap-6">
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
                </div>
            </div>
        </div>
    );
}
