import { Filter } from "lucide-react";

interface FilterPickerProps {
    priorityFilter: string;
    setPriorityFilter: (filter: string) => void;
    activeTasksCount: number;
    completedTasksCount: number;
}

export default function FilterPicker({
    priorityFilter,
    setPriorityFilter,
    activeTasksCount,
    completedTasksCount,
}: FilterPickerProps) {
    const filters = [
        {
            value: "all",
            label: "All",
            color: "bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30",
            activeColor: "bg-gray-500/30 text-gray-300 border-gray-500/50",
        },
        {
            value: "high",
            label: "High",
            color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30",
            activeColor: "bg-red-500/30 text-red-300 border-red-500/50",
        },
        {
            value: "medium",
            label: "Medium",
            color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30",
            activeColor:
                "bg-yellow-500/30 text-yellow-300 border-yellow-500/50",
        },
        {
            value: "low",
            label: "Low",
            color: "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30",
            activeColor: "bg-green-500/30 text-green-300 border-green-500/50",
        },
    ];

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-300 text-sm font-medium">
                            Filter by Priority
                        </span>
                    </div>
                    {priorityFilter !== "all" && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-blue-400 capitalize">
                                Showing {priorityFilter} priority tasks
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {filters.map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setPriorityFilter(filter.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
                                priorityFilter === filter.value
                                    ? filter.activeColor
                                    : filter.color
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}

                    {priorityFilter !== "all" && (
                        <button
                            onClick={() => setPriorityFilter("all")}
                            className="ml-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
                            title="Clear filter"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
