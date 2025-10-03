import axios from "axios";
import { useState } from "react";
import { useRouter } from "next/router";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type AccountType = "member" | "organisation";

export default function Login() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [accountType, setAccountType] = useState<AccountType>("member");
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        name: "",
        role: "member" as AccountType,
    });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
            const payload = isLogin
                ? { email: formData.email, password: formData.password }
                : formData;

            const response = await axios.post(`${API_URL}${endpoint}`, payload);

            // Verify the logged-in user matches the expected account type
            if (isLogin && response.data.user.role !== accountType) {
                setError(
                    `This is ${
                        response.data.user.role === "organisation"
                            ? "an organisation"
                            : "a member"
                    } account. Please use the correct login page.`
                );
                setIsLoading(false);
                return;
            }

            // Store token and user info in localStorage
            localStorage.setItem("token", response.data.token);
            localStorage.setItem("user", JSON.stringify(response.data.user));

            // Redirect to dashboard
            router.push("/");
        } catch (err: any) {
            setError(
                err.response?.data?.message ||
                    "An error occurred. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    const switchAccountType = () => {
        setAccountType(accountType === "member" ? "organisation" : "member");
        setError("");
        setFormData({
            email: "",
            password: "",
            name: "",
            role: accountType === "member" ? "organisation" : "member",
        });
    };

    const getThemeColors = () => {
        if (accountType === "organisation") {
            return {
                primary: "bg-purple-600 hover:bg-purple-700",
                accent: "text-purple-400",
                border: "border-purple-500/30",
                bg: "bg-purple-500/10",
            };
        }
        return {
            primary: "bg-blue-600 hover:bg-blue-700",
            accent: "text-blue-400",
            border: "border-blue-500/30",
            bg: "bg-blue-500/10",
        };
    };

    const theme = getThemeColors();

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-6xl font-light tracking-tight mb-2">
                        Lightkeeper
                    </h1>
                    <p className="text-gray-400">
                        {accountType === "member" ? (
                            <>Staff Login</>
                        ) : (
                            <>Organisation Login</>
                        )}
                    </p>
                </div>

                {/* Form Container */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                    {/* Toggle */}
                    <div className="flex gap-2 mb-8 bg-white/5 p-1 rounded-lg">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                                isLogin
                                    ? "bg-white text-black"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                                !isLogin
                                    ? "bg-white text-black"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Register
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            name: e.target.value,
                                        })
                                    }
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        email: e.target.value,
                                    })
                                }
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                                Password
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        password: e.target.value,
                                    })
                                }
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        {!isLogin && (
                            <div
                                className={`p-4 rounded-xl ${theme.bg} border ${theme.border}`}
                            >
                                <p className="text-sm text-gray-300 mb-1">
                                    <span className="font-semibold">
                                        {accountType === "member"
                                            ? "Staff Member Account"
                                            : "Organisation Account"}
                                    </span>
                                </p>
                                <p className="text-xs text-gray-400">
                                    {accountType === "member"
                                        ? "Can select and complete assigned tasks"
                                        : "Full access to create and manage all tasks"}
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full text-white py-3 rounded-xl font-medium active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8 ${theme.primary}`}
                        >
                            {isLoading
                                ? "Please wait..."
                                : isLogin
                                ? "Login"
                                : "Create Account"}
                        </button>
                    </form>

                    {/* Switch Account Type */}
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <button
                            onClick={switchAccountType}
                            className="w-full text-center text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            {accountType === "member" ? (
                                <>
                                    Are you an admin?{" "}
                                    <span className="text-purple-400 font-medium">
                                        Switch to Organisation Login →
                                    </span>
                                </>
                            ) : (
                                <>
                                    Are you a staff member?{" "}
                                    <span className="text-blue-400 font-medium">
                                        Switch to Staff Login →
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
