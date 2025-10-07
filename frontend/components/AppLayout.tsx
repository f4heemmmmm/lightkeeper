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

type PageType =
    | "tasks"
    | "meetings"
    | "notetaker"
    | "calendar"
    | "upcoming"
    | "event-designer";

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

    return (
        <div className="min-h-screen bg-black text-white">
            <Header
                user={user}
                pageTitle="Organize your workflow."
                onLogout={handleLogout}
            />
            <NavigationTabs currentPage={currentPage} />
            {children}
        </div>
    );
}
