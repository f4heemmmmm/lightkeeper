import { Filter, Calendar, ChevronDown } from "lucide-react";
import { useState } from "react";

interface FilterPickerProps {
    priorityFilter: string;
    setPriorityFilter: (filter: string) => void;
    activeTasksCount: number;
    completedTasksCount: number;
    sortBy?: string;
    setSortBy?: (sort: string) => void;
}

export default function FilterPicker({
    priorityFilter,
    setPriorityFilter,
    activeTasksCount,
    completedTasksCount,
    sortBy = "default",
    setSortBy = () => {},
}: FilterPickerProps) {
    const [isPriorityOpen, setIsPriorityOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);

    const priorityFilters = [
        { value: "all", label: "All Priorities" },
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
    ];

    const sortOptions = [
        { value: "default", label: "Default Order" },
        { value: "dueDate-asc", label: "Due Date (Earliest)" },
        { value: "dueDate-desc", label: "Due Date (Latest)" },
    ];

    const handlePrioritySelect = (value: string): void => {
        setPriorityFilter(value);
        setIsPriorityOpen(false);
    };

    const handleSortSelect = (value: string): void => {
        setSortBy(value);
        setIsSortOpen(false);
    };

    const handleResetFilters = (): void => {
        setPriorityFilter("all");
        setSortBy("default");
    };

    const hasActiveFilters = priorityFilter !== "all" || sortBy !== "default";

    const getCurrentPriorityLabel = (): string => {
        return (
            priorityFilters.find((f) => f.value === priorityFilter)?.label ||
            "All Priorities"
        );
    };

    const getCurrentSortLabel = (): string => {
        return (
            sortOptions.find((s) => s.value === sortBy)?.label ||
            "Default Order"
        );
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
                {/* Left side - Filter and Sort dropdowns */}
                <div className="flex items-center gap-4">
                    {/* Priority Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setIsPriorityOpen(!isPriorityOpen);
                                setIsSortOpen(false);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all duration-200 min-w-[200px]"
                        >
                            <Filter className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300 flex-1 text-left">
                                {getCurrentPriorityLabel()}
                            </span>
                            <ChevronDown
                                className={`w-4 h-4 text-gray-400 transition-transform ${
                                    isPriorityOpen ? "rotate-180" : ""
                                }`}
                            />
                        </button>

                        {/* Priority Dropdown Menu */}
                        {isPriorityOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsPriorityOpen(false)}
                                />
                                <div className="absolute top-full left-0 mt-2 w-full bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                                    {priorityFilters.map((filter) => (
                                        <button
                                            key={filter.value}
                                            onClick={() =>
                                                handlePrioritySelect(
                                                    filter.value
                                                )
                                            }
                                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${
                                                priorityFilter === filter.value
                                                    ? "bg-white/5"
                                                    : ""
                                            }`}
                                        >
                                            <span className="text-gray-300">
                                                {filter.label}
                                            </span>
                                            {priorityFilter ===
                                                filter.value && (
                                                <span className="text-gray-400">
                                                    ✓
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setIsSortOpen(!isSortOpen);
                                setIsPriorityOpen(false);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all duration-200 min-w-[240px]"
                        >
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300 flex-1 text-left">
                                {getCurrentSortLabel()}
                            </span>
                            <ChevronDown
                                className={`w-4 h-4 text-gray-400 transition-transform ${
                                    isSortOpen ? "rotate-180" : ""
                                }`}
                            />
                        </button>

                        {/* Sort Dropdown Menu */}
                        {isSortOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsSortOpen(false)}
                                />
                                <div className="absolute top-full left-0 mt-2 w-full bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                                    {sortOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() =>
                                                handleSortSelect(option.value)
                                            }
                                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${
                                                sortBy === option.value
                                                    ? "bg-white/5"
                                                    : ""
                                            }`}
                                        >
                                            <span className="text-gray-300">
                                                {option.label}
                                            </span>
                                            {sortBy === option.value && (
                                                <span className="text-gray-400">
                                                    ✓
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Right side - Active filters indicator and reset button */}
                <div className="flex items-center gap-3">
                    {hasActiveFilters && (
                        <>
                            <button
                                onClick={handleResetFilters}
                                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
                                title="Reset all filters"
                            >
                                Reset
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
