import { LogOut } from "lucide-react";

interface User {
    id: string;
    email: string;
    name: string;
    role: "organisation" | "member";
}

interface HeaderProps {
    user: User;
    pageTitle: string;
    onLogout: () => void;
}

export default function Header({ user, pageTitle, onLogout }: HeaderProps) {
    return (
        <div className="border-b border-white/10 py-6 px-20">
            <div className="max-w-9xl mx-auto flex justify-between items-center">
                <div>
                    <h1 className="text-5xl font-light tracking-tight mb-1">
                        Lightkeeper
                    </h1>
                    <p className="text-sm text-gray-500">
                        {pageTitle}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm text-gray-400">{user.email}</p>
                        <p className="text-xs text-gray-500 capitalize">
                            {user.role}
                        </p>
                    </div>
                    <button
                        onClick={onLogout}
                        className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
