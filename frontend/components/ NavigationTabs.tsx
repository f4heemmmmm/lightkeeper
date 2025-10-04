import { useRouter } from "next/router";

type PageType = "tasks" | "meetings" | "notetaker";

interface NavigationTabsProps {
    currentPage: PageType;
}

export default function NavigationTabs({ currentPage }: NavigationTabsProps) {
    const router = useRouter();

    const navigateToPage = (path: string): void => {
        router.push(path);
    };

    return (
        <div className="border-b border-white/10">
            <div className="max-w-7xl mx-auto px-8">
                <div className="flex gap-6">
                    <button
                        onClick={() => navigateToPage("/")}
                        className={`py-4 transition-colors ${
                            currentPage === "tasks"
                                ? "text-white border-b-2 border-white"
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        Tasks
                    </button>
                    <button
                        onClick={() => navigateToPage("/meetings")}
                        className={`py-4 transition-colors ${
                            currentPage === "meetings"
                                ? "text-white border-b-2 border-white"
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        Meetings
                    </button>
                    <button
                        onClick={() => navigateToPage("/notetaker")}
                        className={`py-4 transition-colors ${
                            currentPage === "notetaker"
                                ? "text-white border-b-2 border-white"
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        AI Notetaker
                    </button>
                </div>
            </div>
        </div>
    );
}
