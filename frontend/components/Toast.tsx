import { useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

export default function Toast({ id, message, type, duration = 5000, onClose }: ToastProps) {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose(id);
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [id, duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case "success":
                return <CheckCircle className="w-5 h-5 text-green-400" />;
            case "error":
                return <XCircle className="w-5 h-5 text-red-400" />;
            case "warning":
                return <AlertCircle className="w-5 h-5 text-yellow-400" />;
            case "info":
                return <Info className="w-5 h-5 text-blue-400" />;
        }
    };

    const getStyles = () => {
        switch (type) {
            case "success":
                return "bg-green-500/10 border-green-500/20 text-green-400";
            case "error":
                return "bg-red-500/10 border-red-500/20 text-red-400";
            case "warning":
                return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
            case "info":
                return "bg-blue-500/10 border-blue-500/20 text-blue-400";
        }
    };

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${getStyles()} shadow-lg animate-slide-in-right`}
            style={{
                minWidth: "300px",
                maxWidth: "500px",
            }}
        >
            {getIcon()}
            <p className="flex-1 text-sm">{message}</p>
            <button
                onClick={() => onClose(id)}
                className="text-current hover:opacity-70 transition-opacity"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

