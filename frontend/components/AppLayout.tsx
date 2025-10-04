import { useRouter } from "next/router";
import { ReactNode } from "react";
import Header from "./Header";
import NavigationTabs from "./ NavigationTabs";

interface User {
    id: string;
    email: string;
    name: string;
    role: "organisation" | "member";
}

type PageType = "tasks" | "meetings" | "notetaker";

interface AppLayoutProps {
    user: User;
    currentPage: PageType;
    children: ReactNode;
}

export default function AppLayout({
    user,
    currentPage,
    children,
}: AppLayoutProps) {
    const router = useRouter();

    const handleLogout = (): void => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login");
    };

    const getPageTitle = (): string => {
        switch (currentPage) {
            case "tasks":
                return user.role === "organisation"
                    ? "Organisation Dashboard - Manage all tasks"
                    : "Member Dashboard - Your assigned tasks";
            case "meetings":
                return "Meetings - Upload and manage meeting notes";
            case "notetaker":
                return "AI Notetaker - Automatically join and transcribe meetings";
            default:
                return "";
        }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            <Header
                user={user}
                pageTitle={getPageTitle()}
                onLogout={handleLogout}
            />
            <NavigationTabs currentPage={currentPage} />
            {children}
        </div>
    );
}
