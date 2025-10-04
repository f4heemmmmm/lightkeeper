import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios, { AxiosError } from "axios";
import AppLayout from "@/components/AppLayout";
import MeetingDetailModal from "@/components/MeetingDetailModal";
import { useToast } from "@/components/ToastContainer";

import {
    Upload,
    FileText,
    ChevronRight,
    X,
    RotateCcw,
    Search,
    Tag,
    Languages,
} from "lucide-react";

interface User {
    id: string;
    email: string;
    name: string;
    role: "organisation" | "member";
}

interface Meeting {
    _id: string;
    title: string;
    description?: string;
    summary?: string;
    actionItems?: string[];
    tags?: string[];
    internalTags?: string[];
    fileName: string;
    fileSize: number;
    fileUrl: string;
    uploaderName: string;
    createdAt: string;
    translatedFrom?: string;
}

interface ErrorResponse {
    message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const decodeBase64Content = (base64String: string): string => {
    try {
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const decoder = new TextDecoder("utf-8");
        return decoder.decode(bytes);
    } catch (error) {
        console.error("Error decoding base64 content:", error);
        try {
            return atob(base64String);
        } catch {
            return "Error decoding content";
        }
    }
};

export default function MeetingsPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(
        null
    );
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [fileContent, setFileContent] = useState<string>("");
    const [isMigrating, setIsMigrating] = useState(false);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [translatedMeetings, setTranslatedMeetings] = useState<Map<string, Meeting>>(new Map());
    const [translationMetadata, setTranslationMetadata] = useState<Map<string, { sourceLanguage: string; targetLanguage: string }>>(new Map());
    const [isTranslating, setIsTranslating] = useState<string | null>(null);
    const [showTranslationModal, setShowTranslationModal] = useState(false);
    const [translationTargetMeetingId, setTranslationTargetMeetingId] = useState<string | null>(null);
    const [targetLanguage, setTargetLanguage] = useState<string>("English");

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem("token");
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        const userStr = localStorage.getItem("user");

        if (!token || !userStr) {
            router.push("/login");
            return;
        }

        try {
            const parsedUser = JSON.parse(userStr);
            setUser(parsedUser);
            fetchMeetings();
        } catch (err) {
            console.error("Error parsing user data:", err);
            router.push("/login");
        }
    }, [router]);

    const fetchMeetings = async (): Promise<void> => {
        try {
            setIsLoading(true);
            const response = await axios.get<Meeting[]>(
                `${API_URL}/api/meetings`,
                { headers: getAuthHeader() }
            );
            setMeetings(response.data);
            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            if (axiosError.response?.status === 401) {
                router.push("/login");
                return;
            }
            setError("Failed to fetch meetings.");
            console.error("Error fetching meetings:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.name.endsWith(".txt")) {
                showToast("Only .txt files are allowed", "warning");
                return;
            }
            setSelectedFile(file);
            setError(null);
        }
    };

    const readFileContent = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    resolve(e.target.result as string);
                } else {
                    reject(new Error("Failed to read file"));
                }
            };
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsText(file, "utf-8");
        });
    };

    const handleUpload = async (): Promise<void> => {
        if (!selectedFile) {
            showToast("Please select a file", "warning");
            return;
        }

        setIsUploading(true);
        try {
            const content = await readFileContent(selectedFile);
            const base64Content = btoa(unescape(encodeURIComponent(content)));
            const dataUrl = `data:text/plain;base64,${base64Content}`;

            const response = await axios.post<Meeting>(
                `${API_URL}/api/meetings`,
                {
                    fileUrl: dataUrl,
                    fileName: selectedFile.name,
                    fileSize: selectedFile.size,
                    fileContent: dataUrl, // Send the same base64 data URL
                },
                { headers: getAuthHeader() }
            );

            setMeetings([response.data, ...meetings]);
            setSelectedFile(null);
            setShowUploadModal(false);
            setError(null);
            showToast("Meeting notes uploaded successfully!", "success");
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            const errorMessage = axiosError.response?.data?.message || "Failed to upload meeting";
            showToast(errorMessage, "error");
            console.error("Error uploading meeting:", err);
        } finally {
            setIsUploading(false);
        }
    };

    const loadFileContent = async (meeting: Meeting): Promise<void> => {
        setIsLoadingContent(true);
        try {
            if (!meeting.fileUrl) {
                setFileContent("No transcript available");
                return;
            }

            if (meeting.fileUrl.startsWith("data:text/plain;base64,")) {
                const base64Content = meeting.fileUrl.split(",")[1];
                if (!base64Content) {
                    setFileContent("Invalid transcript format");
                    return;
                }

                try {
                    const decodedContent = decodeBase64Content(base64Content);
                    setFileContent(decodedContent);
                } catch (decodeError) {
                    console.error("Base64 decode error:", decodeError);
                    setFileContent("Failed to decode transcript");
                }
            } else {
                setFileContent("Unsupported transcript format");
            }
        } catch (err) {
            console.error("Error loading file content:", err);
            setFileContent("Error loading content");
        } finally {
            setIsLoadingContent(false);
        }
    };

    const handleMeetingClick = async (meeting: Meeting): Promise<void> => {
        setSelectedMeeting(meeting);
        setShowDetailModal(true);
        await loadFileContent(meeting);
    };

    const handleCloseModal = (): void => {
        setShowDetailModal(false);
        setFileContent("");
    };

    const deleteMeeting = async (id: string): Promise<void> => {
        try {
            await axios.delete(`${API_URL}/api/meetings/${id}`, {
                headers: getAuthHeader(),
            });
            setMeetings(meetings.filter((m) => m._id !== id));
            setShowDetailModal(false);
            setSelectedMeeting(null);
            setFileContent("");
            setError(null);
            showToast("Meeting deleted successfully", "success");
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            const errorMessage = axiosError.response?.data?.message || "Failed to delete meeting";
            showToast(errorMessage, "error");
            console.error("Error deleting meeting:", err);
        }
    };

    const handleMigrateTasks = async (): Promise<void> => {
        if (
            !confirm(
                "This will create tasks from action items in all your existing meetings. Continue?"
            )
        ) {
            return;
        }

        setIsMigrating(true);
        try {
            const response = await axios.post(
                `${API_URL}/api/meetings/migrate-tasks`,
                {},
                { headers: getAuthHeader() }
            );

            const result = response.data;
            alert(
                `Migration completed!\n\nCreated ${result.totalTasksCreated} tasks from ${result.meetingsProcessed} meetings.`
            );
            fetchMeetings();
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            setError(
                axiosError.response?.data?.message || "Failed to migrate tasks"
            );
            console.error("Error migrating tasks:", err);
        } finally {
            setIsMigrating(false);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    const formatDateTime = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const handleTranslateMeeting = async (meetingId: string, language: string): Promise<void> => {
        setIsTranslating(meetingId);
        try {
            const response = await axios.post(
                `${API_URL}/api/meetings/${meetingId}/translate`,
                { targetLanguage: language },
                {
                    headers: getAuthHeader(),
                }
            );

            const translationData = response.data.translation;
            
            // Create a translated version of the meeting
            const originalMeeting = meetings.find(m => m._id === meetingId);
            if (originalMeeting) {
                const translatedMeeting: Meeting = {
                    ...originalMeeting,
                    title: translationData.title,
                    description: translationData.description,
                    summary: translationData.summary,
                    actionItems: translationData.actionItems,
                    translatedFrom: translationData.detectedSourceLanguage,
                };
                
                // Store the translation and metadata
                setTranslatedMeetings(prev => new Map(prev).set(meetingId, translatedMeeting));
                setTranslationMetadata(prev => new Map(prev).set(meetingId, {
                    sourceLanguage: translationData.detectedSourceLanguage,
                    targetLanguage: translationData.targetLanguage
                }));
                
                showToast(
                    `Translation completed! Translated from ${translationData.detectedSourceLanguage} to ${translationData.targetLanguage}`,
                    "success"
                );
            } else {
                showToast("Failed to find original meeting", "error");
            }

            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            const errorMessage = axiosError.response?.data?.message || "Failed to translate meeting";
            showToast(errorMessage, "error");
            console.error("Error translating meeting:", err);
        } finally {
            setIsTranslating(null);
            setShowTranslationModal(false);
            setTranslationTargetMeetingId(null);
        }
    };

    const getMeetingToDisplay = (meetingId: string): Meeting => {
        return translatedMeetings.get(meetingId) || meetings.find(m => m._id === meetingId)!;
    };

    const clearTranslation = (meetingId: string): void => {
        setTranslatedMeetings(prev => {
            const newMap = new Map(prev);
            newMap.delete(meetingId);
            return newMap;
        });
        setTranslationMetadata(prev => {
            const newMap = new Map(prev);
            newMap.delete(meetingId);
            return newMap;
        });
    };

    if (!user) {
        return null;
    }

    return (
        <AppLayout user={user} currentPage="meetings">
            {error && (
                <div className="max-w-7xl mx-auto px-8 pt-4">
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex justify-between items-center">
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="text-red-400 hover:text-red-300"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                        <p className="text-gray-400 text-md mb-1 font-semibold">
                            Total Meetings
                        </p>
                        <p className="text-4xl font-thin">{meetings.length}</p>
                    </div>
                    {user.role === "organisation" && (
                        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-md mb-1 font-semibold">
                                        Migrate Tasks
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        Create tasks from existing meeting
                                        action items
                                    </p>
                                </div>
                                <button
                                    onClick={handleMigrateTasks}
                                    disabled={isMigrating}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    {isMigrating ? "Migrating..." : "Migrate"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 pb-8">
                <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10">
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <h2 className="text-xl font-medium">
                                Meeting Notes ({meetings.filter(meeting => {
                                    if (!searchQuery.trim()) return true;
                                    const query = searchQuery.toLowerCase();
                                    return (
                                        meeting.title.toLowerCase().includes(query) ||
                                        meeting.description?.toLowerCase().includes(query) ||
                                        meeting.summary?.toLowerCase().includes(query) ||
                                        meeting.tags?.some(tag => tag.toLowerCase().includes(query))
                                    );
                                }).length})
                            </h2>
                        </div>
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search meetings by title, description, tags..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-[calc(100vh-500px)] overflow-y-auto">
                        {isLoading ? (
                            <div className="text-center py-12 text-gray-400">
                                Loading meetings...
                            </div>
                        ) : meetings.filter(meeting => {
                            if (!searchQuery.trim()) return true;
                            const query = searchQuery.toLowerCase();
                            return (
                                meeting.title.toLowerCase().includes(query) ||
                                meeting.description?.toLowerCase().includes(query) ||
                                meeting.summary?.toLowerCase().includes(query) ||
                                meeting.tags?.some(tag => tag.toLowerCase().includes(query))
                            );
                        }).length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <p>
                                    {searchQuery ? `No meetings found matching "${searchQuery}"` : "No meetings yet. Upload your first meeting notes."}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/10">
                                {meetings.filter(meeting => {
                                    if (!searchQuery.trim()) return true;
                                    const query = searchQuery.toLowerCase();
                                    return (
                                        meeting.title.toLowerCase().includes(query) ||
                                        meeting.description?.toLowerCase().includes(query) ||
                                        meeting.summary?.toLowerCase().includes(query) ||
                                        meeting.tags?.some(tag => tag.toLowerCase().includes(query))
                                    );
                                }).map((meeting) => {
                                    const displayMeeting = getMeetingToDisplay(meeting._id);
                                    const isTranslated = translatedMeetings.has(meeting._id);
                                    const translationMeta = translationMetadata.get(meeting._id);
                                    
                                    return (
                                    <div
                                        key={meeting._id}
                                        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() =>
                                            handleMeetingClick(displayMeeting)
                                        }
                                    >
                                        <div className="flex items-start gap-4">
                                            <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-base font-medium">
                                                        {displayMeeting.title}
                                                    </h3>
                                                </div>
                                                {isTranslated && translationMeta ? (
                                                    <p className="text-xs text-gray-500 mb-2">
                                                        Translated from {translationMeta.sourceLanguage}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-gray-500 mb-2">
                                                        Original Transcript
                                                    </p>
                                                )}
                                                {displayMeeting.tags && displayMeeting.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        {displayMeeting.tags.map((tag, index) => (
                                                            <span
                                                                key={index}
                                                                className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs"
                                                            >
                                                                <Tag className="w-3 h-3" />
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                                                    <span>
                                                        {displayMeeting.fileName}
                                                    </span>
                                                    <span>
                                                        {formatFileSize(
                                                            displayMeeting.fileSize
                                                        )}
                                                    </span>
                                                    <span>
                                                        Uploaded by{" "}
                                                        {displayMeeting.uploaderName}
                                                    </span>
                                                    <span>
                                                        {formatDateTime(
                                                            displayMeeting.createdAt
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                                                {isTranslated ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            clearTranslation(meeting._id);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-colors"
                                                        title="Show original"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setTranslationTargetMeetingId(meeting._id);
                                                            setShowTranslationModal(true);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                                                        title="Translate"
                                                        disabled={isTranslating === meeting._id}
                                                    >
                                                        {isTranslating === meeting._id ? (
                                                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                                        ) : (
                                                            <Languages className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                                <ChevronRight className="w-5 h-5 text-gray-400" />
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="fixed bottom-8 right-8">
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-white text-black p-4 rounded-full shadow-lg hover:bg-gray-100 transition-colors flex items-center justify-center group"
                    title="Upload meeting notes"
                >
                    <Upload className="w-6 h-6" />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap ml-0 group-hover:ml-2 font-medium">
                        Upload Meeting
                    </span>
                </button>
            </div>

            {showUploadModal && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                    onClick={() => {
                        setShowUploadModal(false);
                        setSelectedFile(null);
                    }}
                >
                    <div
                        className="bg-black border border-white/10 rounded-2xl max-w-md w-full shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
                            <h2 className="text-2xl font-light">
                                Upload Meeting Notes
                            </h2>
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setSelectedFile(null);
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center hover:border-white/20 transition-colors">
                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    accept=".txt"
                                    id="file-upload"
                                    className="hidden"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="cursor-pointer"
                                >
                                    <span className="text-white font-medium hover:text-gray-300 transition-colors">
                                        Click to upload
                                    </span>
                                    <span className="text-gray-400">
                                        {" "}
                                        or drag and drop
                                    </span>
                                </label>
                                <p className="text-xs text-gray-500 mt-2">
                                    TXT files only
                                </p>
                                {selectedFile && (
                                    <div className="mt-4 p-3 bg-white/5 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-blue-400" />
                                                <span className="text-sm text-white">
                                                    {selectedFile.name}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setSelectedFile(null);
                                                }}
                                                className="text-gray-400 hover:text-red-400 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {formatFileSize(selectedFile.size)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setSelectedFile(null);
                                }}
                                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={!selectedFile || isUploading}
                                className="flex-1 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? "Uploading..." : "Upload"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDetailModal && selectedMeeting && (
                <MeetingDetailModal
                    meeting={selectedMeeting}
                    fileContent={fileContent}
                    isLoadingContent={isLoadingContent}
                    onClose={handleCloseModal}
                    onDelete={deleteMeeting}
                    allMeetings={meetings}
                    onMeetingSelect={async (meeting) => {
                        setSelectedMeeting(meeting);
                        await loadFileContent(meeting);
                    }}
                />
            )}

            {/* Translation Modal */}
            {showTranslationModal && translationTargetMeetingId && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
                    onClick={() => {
                        setShowTranslationModal(false);
                        setTranslationTargetMeetingId(null);
                    }}
                >
                    <div
                        className="bg-zinc-900 border border-white/10 rounded-xl max-w-lg w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
                            <h2 className="text-2xl font-light flex items-center gap-2">
                                <Languages className="w-6 h-6" />
                                Translate Meeting Notes
                            </h2>
                            <button
                                onClick={() => {
                                    setShowTranslationModal(false);
                                    setTranslationTargetMeetingId(null);
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-400 mb-4">
                                Select the target language for translation:
                            </p>
                            <select
                                value={targetLanguage}
                                onChange={(e) => setTargetLanguage(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20 mb-4"
                            >
                                <option value="English">English</option>
                                <option value="Spanish">Spanish</option>
                                <option value="French">French</option>
                                <option value="German">German</option>
                                <option value="Italian">Italian</option>
                                <option value="Portuguese">Portuguese</option>
                                <option value="Russian">Russian</option>
                                <option value="Japanese">Japanese</option>
                                <option value="Chinese">Chinese</option>
                                <option value="Korean">Korean</option>
                                <option value="Arabic">Arabic</option>
                                <option value="Hindi">Hindi</option>
                                <option value="Dutch">Dutch</option>
                                <option value="Polish">Polish</option>
                                <option value="Turkish">Turkish</option>
                                <option value="Vietnamese">Vietnamese</option>
                                <option value="Thai">Thai</option>
                                <option value="Swedish">Swedish</option>
                                <option value="Norwegian">Norwegian</option>
                                <option value="Danish">Danish</option>
                            </select>
                            <p className="text-xs text-gray-500 mb-4">
                                The translation will be powered by GPT-4o and will preserve the meaning and context of your meeting notes.
                            </p>
                        </div>
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                onClick={() => {
                                    setShowTranslationModal(false);
                                    setTranslationTargetMeetingId(null);
                                }}
                                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleTranslateMeeting(translationTargetMeetingId, targetLanguage)}
                                disabled={isTranslating !== null}
                                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isTranslating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Translating...
                                    </>
                                ) : (
                                    <>
                                        <Languages className="w-4 h-4" />
                                        Translate
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
