import { useState } from "react";

interface CreateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    newTask: {
        title: string;
        description: string;
        priority: "low" | "medium" | "high";
        dueDate: string;
        dueTime: string;
    };
    setNewTask: (task: CreateTaskModalProps["newTask"]) => void;
}

export default function CreateTaskModal({
    isOpen,
    onClose,
    onSubmit,
    newTask,
    setNewTask,
}: CreateTaskModalProps) {
    const [errors, setErrors] = useState({
        title: "",
        description: "",
        dueDate: "",
        dueTime: "",
    });
    const [touched, setTouched] = useState({
        title: false,
        description: false,
        dueDate: false,
        dueTime: false,
    });

    if (!isOpen) return null;

    const validateTitle = (value: string): string => {
        if (!value.trim()) {
            return "Title is required";
        }
        if (value.trim().length < 3) {
            return "Title must be at least 3 characters";
        }
        if (value.length > 100) {
            return "Title must not exceed 100 characters";
        }
        return "";
    };

    const validateDescription = (value: string): string => {
        if (!value.trim()) {
            return "Description is required";
        }
        if (value.trim().length < 10) {
            return "Description must be at least 10 characters";
        }
        if (value.length > 500) {
            return "Description must not exceed 500 characters";
        }
        return "";
    };

    const validateDueDate = (value: string): string => {
        if (!value) {
            return ""; // Date is now optional
        }
        const selectedDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            return "Due date cannot be in the past";
        }

        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 5);
        if (selectedDate > maxDate) {
            return "Due date cannot be more than 5 years in the future";
        }

        return "";
    };

    const validateDueTime = (value: string): string => {
        // Time is optional if no date is set
        if (!value && !newTask.dueDate) {
            return "";
        }

        // If date is set, time should be provided
        if (newTask.dueDate && !value) {
            return "Due time is required when date is set";
        }

        // Check if datetime is in the past
        if (newTask.dueDate && value) {
            const datetime = new Date(`${newTask.dueDate}T${value}`);
            const now = new Date();

            if (datetime < now) {
                return "Due time cannot be in the past";
            }
        }

        return "";
    };

    const handleBlur = (
        field: "title" | "description" | "dueDate" | "dueTime"
    ) => {
        setTouched((prev) => ({ ...prev, [field]: true }));

        let error = "";
        if (field === "title") {
            error = validateTitle(newTask.title);
        } else if (field === "description") {
            error = validateDescription(newTask.description);
        } else if (field === "dueDate") {
            error = validateDueDate(newTask.dueDate);
        } else if (field === "dueTime") {
            error = validateDueTime(newTask.dueTime);
        }

        setErrors((prev) => ({ ...prev, [field]: error }));
    };

    const handleSubmit = () => {
        const titleError = validateTitle(newTask.title);
        const descriptionError = validateDescription(newTask.description);
        const dueDateError = validateDueDate(newTask.dueDate);
        const dueTimeError = validateDueTime(newTask.dueTime);

        setErrors({
            title: titleError,
            description: descriptionError,
            dueDate: dueDateError,
            dueTime: dueTimeError,
        });

        setTouched({
            title: true,
            description: true,
            dueDate: true,
            dueTime: true,
        });

        if (
            !titleError &&
            !descriptionError &&
            !dueDateError &&
            !dueTimeError
        ) {
            onSubmit();
            setErrors({ title: "", description: "", dueDate: "", dueTime: "" });
            setTouched({
                title: false,
                description: false,
                dueDate: false,
                dueTime: false,
            });
        }
    };

    const handleClose = () => {
        setErrors({ title: "", description: "", dueDate: "", dueTime: "" });
        setTouched({
            title: false,
            description: false,
            dueDate: false,
            dueTime: false,
        });
        onClose();
    };

    const getTodayDate = () => {
        return new Date().toISOString().split("T")[0];
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high":
                return "bg-red-500/10 border-red-500/30 text-red-400";
            case "medium":
                return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
            case "low":
                return "bg-green-500/10 border-green-500/30 text-green-400";
            default:
                return "bg-white/5 border-white/10 text-gray-400";
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
            onClick={handleClose}
        >
            <div
                className="bg-black border border-white/10 rounded-2xl max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <h2 className="text-2xl font-light text-white">New Task</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg"
                        aria-label="Close"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 18 18"
                            fill="none"
                        >
                            <path
                                d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 pb-6 pt-4 space-y-5">
                    {/* Title */}
                    <div>
                        <input
                            type="text"
                            value={newTask.title}
                            onChange={(e) => {
                                setNewTask({
                                    ...newTask,
                                    title: e.target.value,
                                });
                                if (touched.title) {
                                    setErrors((prev) => ({
                                        ...prev,
                                        title: validateTitle(e.target.value),
                                    }));
                                }
                            }}
                            onBlur={() => handleBlur("title")}
                            className={`w-full bg-transparent border-0 border-b-2 px-0 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-0 transition-colors text-lg font-light ${
                                touched.title && errors.title
                                    ? "border-red-500/50 focus:border-red-500"
                                    : "border-white/10 focus:border-white/30"
                            }`}
                            placeholder="Task title"
                            maxLength={100}
                        />
                        {touched.title && errors.title && (
                            <p className="text-red-400 text-xs mt-2">
                                {errors.title}
                            </p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <textarea
                            value={newTask.description}
                            onChange={(e) => {
                                setNewTask({
                                    ...newTask,
                                    description: e.target.value,
                                });
                                if (touched.description) {
                                    setErrors((prev) => ({
                                        ...prev,
                                        description: validateDescription(
                                            e.target.value
                                        ),
                                    }));
                                }
                            }}
                            onBlur={() => handleBlur("description")}
                            className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-all resize-none text-sm ${
                                touched.description && errors.description
                                    ? "border-red-500/50 focus:ring-red-500/50 bg-red-500/5"
                                    : "border-white/10 focus:ring-white/20 focus:border-white/20"
                            }`}
                            rows={3}
                            placeholder="Add description"
                            maxLength={500}
                        />
                        {touched.description && errors.description && (
                            <p className="text-red-400 text-xs mt-2">
                                {errors.description}
                            </p>
                        )}
                    </div>

                    {/* Priority Pills */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2.5 uppercase tracking-wider">
                            Priority
                        </label>
                        <div className="flex gap-2">
                            {(["low", "medium", "high"] as const).map(
                                (priority) => (
                                    <button
                                        key={priority}
                                        type="button"
                                        onClick={() =>
                                            setNewTask({ ...newTask, priority })
                                        }
                                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all capitalize ${
                                            newTask.priority === priority
                                                ? getPriorityColor(priority)
                                                : "bg-transparent border-white/10 text-gray-400 hover:bg-white/5 hover:border-white/20"
                                        }`}
                                    >
                                        {priority}
                                    </button>
                                )
                            )}
                        </div>
                    </div>

                    {/* Due Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-2.5 uppercase tracking-wider">
                                Due Date <span className="text-gray-500 text-[10px] normal-case">(Optional)</span>
                            </label>
                            <input
                                type="date"
                                value={newTask.dueDate}
                                onChange={(e) => {
                                    // Ensure the date is in correct format
                                    const dateValue = e.target.value;
                                    if (dateValue && dateValue.length === 10) {
                                        setNewTask({
                                            ...newTask,
                                            dueDate: dateValue,
                                        });
                                        if (touched.dueDate) {
                                            setErrors((prev) => ({
                                                ...prev,
                                                dueDate: validateDueDate(dateValue),
                                            }));
                                        }
                                        // Revalidate time when date changes
                                        if (touched.dueTime && newTask.dueTime) {
                                            setErrors((prev) => ({
                                                ...prev,
                                                dueTime: validateDueTime(newTask.dueTime),
                                            }));
                                        }
                                    }
                                }}
                                onBlur={() => handleBlur("dueDate")}
                                min={getTodayDate()}
                                max="2030-12-31"
                                className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 transition-all text-sm ${
                                    touched.dueDate && errors.dueDate
                                        ? "border-red-500/50 focus:ring-red-500/50 bg-red-500/5"
                                        : "border-white/10 focus:ring-white/20 focus:border-white/20"
                                }`}
                                style={{
                                    colorScheme: 'dark'
                                }}
                            />
                            {touched.dueDate && errors.dueDate && (
                                <p className="text-red-400 text-xs mt-2">
                                    {errors.dueDate}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-2.5 uppercase tracking-wider">
                                Due Time <span className="text-gray-500 text-[10px] normal-case">(Optional)</span>
                            </label>
                            <input
                                type="time"
                                value={newTask.dueTime}
                                onChange={(e) => {
                                    setNewTask({
                                        ...newTask,
                                        dueTime: e.target.value,
                                    });
                                    if (touched.dueTime) {
                                        setErrors((prev) => ({
                                            ...prev,
                                            dueTime: validateDueTime(
                                                e.target.value
                                            ),
                                        }));
                                    }
                                }}
                                onBlur={() => handleBlur("dueTime")}
                                className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 transition-all text-sm ${
                                    touched.dueTime && errors.dueTime
                                        ? "border-red-500/50 focus:ring-red-500/50 bg-red-500/5"
                                        : "border-white/10 focus:ring-white/20 focus:border-white/20"
                                }`}
                            />
                            {touched.dueTime && errors.dueTime && (
                                <p className="text-red-400 text-xs mt-2">
                                    {errors.dueTime}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 pb-6 pt-2">
                    <button
                        onClick={handleClose}
                        className="flex-1 px-5 py-2.5 rounded-xl font-medium text-gray-400 hover:bg-white/5 border border-white/10 hover:border-white/20 transition-all text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 bg-white text-black px-5 py-2.5 rounded-xl font-medium hover:bg-gray-200 active:scale-[0.98] transition-all text-sm"
                    >
                        Create Task
                    </button>
                </div>
            </div>
        </div>
    );
}
