import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import axios, { AxiosError } from "axios";
import AppLayout from "@/components/AppLayout";
import { useToast } from "@/components/ToastContainer";
import {
    FileImage,
    Upload,
    Sparkles,
    Download,
    Trash2,
    Image as ImageIcon,
    FileText,
    MessageSquare,
    X,
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
    createdAt: string;
}

interface EventAsset {
    _id: string;
    meetingId: string;
    assetType: 'poster' | 'invite' | 'social-media' | 'banner';
    imageData: string;
    createdAt: string;
}

interface Logo {
    _id: string;
    fileName: string;
    imageData: string;
    createdAt: string;
}

interface ErrorResponse {
    message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const assetTypes = [
    { value: 'poster', label: 'Event Poster', icon: FileImage },
    { value: 'invite', label: 'Invitation Card', icon: FileText },
    { value: 'social-media', label: 'Social Media Post', icon: ImageIcon },
    { value: 'banner', label: 'Event Banner', icon: FileImage },
];

export default function EventDesignerPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [user, setUser] = useState<User | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [assets, setAssets] = useState<Map<string, EventAsset[]>>(new Map());
    const [activeLogo, setActiveLogo] = useState<Logo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generatingAssets, setGeneratingAssets] = useState<Set<string>>(new Set());
    const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [showRevisionModal, setShowRevisionModal] = useState(false);
    const [revisionAssetId, setRevisionAssetId] = useState<string | null>(null);
    const [revisionMeetingId, setRevisionMeetingId] = useState<string | null>(null);
    const [revisionInstructions, setRevisionInstructions] = useState("");
    const [isRevising, setIsRevising] = useState(false);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);

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
            fetchData();
        } catch (err) {
            console.error("Error parsing user data:", err);
            router.push("/login");
        }
    }, [router]);

    const fetchData = async (): Promise<void> => {
        try {
            setIsLoading(true);
            
            // Fetch meetings
            const meetingsResponse = await axios.get<Meeting[]>(
                `${API_URL}/api/meetings`,
                { headers: getAuthHeader() }
            );
            setMeetings(meetingsResponse.data);

            // Fetch logo
            try {
                const logoResponse = await axios.get<{ logo: Logo }>(
                    `${API_URL}/api/event-assets/logo`,
                    { headers: getAuthHeader() }
                );
                setActiveLogo(logoResponse.data.logo);
            } catch (err) {
                // No logo uploaded yet
                console.log("No active logo found");
            }

            // Fetch assets for each meeting
            const assetsMap = new Map<string, EventAsset[]>();
            for (const meeting of meetingsResponse.data) {
                try {
                    const assetsResponse = await axios.get<{ assets: EventAsset[] }>(
                        `${API_URL}/api/event-assets/meeting/${meeting._id}`,
                        { headers: getAuthHeader() }
                    );
                    assetsMap.set(meeting._id, assetsResponse.data.assets);
                } catch (err) {
                    assetsMap.set(meeting._id, []);
                }
            }
            setAssets(assetsMap);

            setError(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            if (axiosError.response?.status === 401) {
                router.push("/login");
                return;
            }
            setError("Failed to fetch data.");
            console.error("Error fetching data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast("Please upload an image file", "warning");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast("Logo file size must be less than 5MB", "warning");
            return;
        }

        setIsUploadingLogo(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target?.result as string;
                const base64Data = base64.split(',')[1];

                const response = await axios.post<{ logo: Logo }>(
                    `${API_URL}/api/event-assets/logo`,
                    {
                        logoData: base64Data,
                        fileName: file.name,
                        mimeType: file.type,
                        fileSize: file.size
                    },
                    { headers: getAuthHeader() }
                );

                setActiveLogo({
                    ...response.data.logo,
                    imageData: base64
                });
                showToast("Logo uploaded successfully!", "success");
            };
            reader.readAsDataURL(file);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            showToast(axiosError.response?.data?.message || "Failed to upload logo", "error");
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const generateAsset = async (meetingId: string, assetType: string) => {
        const key = `${meetingId}-${assetType}`;
        setGeneratingAssets(prev => new Set(prev).add(key));

        try {
            const response = await axios.post<{ asset: EventAsset }>(
                `${API_URL}/api/event-assets/generate`,
                { meetingId, assetType },
                { headers: getAuthHeader() }
            );

            // Update assets map
            setAssets(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(meetingId) || [];
                newMap.set(meetingId, [...existing, response.data.asset]);
                return newMap;
            });

            showToast(`${assetType} generated successfully!`, "success");
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            showToast(axiosError.response?.data?.message || "Failed to generate asset", "error");
        } finally {
            setGeneratingAssets(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
            });
        }
    };

    const deleteAsset = async (assetId: string, meetingId: string) => {
        try {
            await axios.delete(
                `${API_URL}/api/event-assets/${assetId}`,
                { headers: getAuthHeader() }
            );

            setAssets(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(meetingId) || [];
                newMap.set(meetingId, existing.filter(a => a._id !== assetId));
                return newMap;
            });

            showToast("Asset deleted successfully", "success");
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            showToast(axiosError.response?.data?.message || "Failed to delete asset", "error");
        }
    };

    const handleReviseAsset = async () => {
        if (!revisionAssetId || !revisionMeetingId || !revisionInstructions.trim()) {
            showToast("Please provide revision instructions", "warning");
            return;
        }

        setIsRevising(true);
        try {
            const response = await axios.post<{ asset: EventAsset }>(
                `${API_URL}/api/event-assets/revise`,
                { 
                    assetId: revisionAssetId,
                    revisionInstructions: revisionInstructions.trim()
                },
                { headers: getAuthHeader() }
            );

            // Update the asset in the map
            setAssets(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(revisionMeetingId) || [];
                const updatedAssets = existing.map(a => 
                    a._id === revisionAssetId ? response.data.asset : a
                );
                newMap.set(revisionMeetingId, updatedAssets);
                return newMap;
            });

            showToast("Asset revised successfully!", "success");
            setShowRevisionModal(false);
            setRevisionInstructions("");
            setRevisionAssetId(null);
            setRevisionMeetingId(null);
        } catch (err) {
            const axiosError = err as AxiosError<ErrorResponse>;
            showToast(axiosError.response?.data?.message || "Failed to revise asset", "error");
        } finally {
            setIsRevising(false);
        }
    };

    const downloadAsset = (imageData: string, fileName: string) => {
        const link = document.createElement('a');
        link.href = imageData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    if (!user) {
        return null;
    }

    return (
        <AppLayout user={user} currentPage="event-designer">
            {/* Logo Upload Section */}
            <div className="max-w-7xl mx-auto px-8 py-6">
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {activeLogo ? (
                                <div className="flex items-center gap-4">
                                    <img
                                        src={activeLogo.imageData}
                                        alt="Logo"
                                        className="w-16 h-16 object-contain bg-white/10 rounded-lg p-2"
                                    />
                                    <div>
                                        <p className="font-medium">Active Logo</p>
                                        <p className="text-sm text-gray-400">{activeLogo.fileName}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center">
                                        <ImageIcon className="w-8 h-8 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">No logo uploaded</p>
                                        <p className="text-sm text-gray-400">
                                            Upload your logo to include in generated materials
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploadingLogo}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                            >
                                {isUploadingLogo ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        {activeLogo ? 'Change Logo' : 'Upload Logo'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-8 pb-8">
                {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                        <p className="text-gray-400">Loading events...</p>
                    </div>
                ) : meetings.length === 0 ? (
                    <div className="text-center py-12">
                        <FileImage className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No meetings found. Create a meeting first to generate assets.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {meetings.map((meeting) => {
                            const meetingAssets = assets.get(meeting._id) || [];
                            const isExpanded = selectedMeeting === meeting._id;

                            return (
                                <div
                                    key={meeting._id}
                                    className="bg-white/5 border border-white/10 rounded-lg overflow-hidden"
                                >
                                    {/* Meeting Header */}
                                    <div
                                        onClick={() => setSelectedMeeting(isExpanded ? null : meeting._id)}
                                        className="p-6 cursor-pointer hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-medium mb-1">{meeting.title}</h2>
                                                <p className="text-sm text-gray-400">
                                                    {formatDate(meeting.createdAt)} • {meetingAssets.length} assets generated
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-500">
                                                    {isExpanded ? 'Click to collapse' : 'Click to expand'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t border-white/10 p-6">
                                            {/* Generate Buttons */}
                                            <div className="mb-6">
                                                <h3 className="text-sm font-medium text-gray-400 mb-3">
                                                    Generate New Asset
                                                </h3>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {assetTypes.map((type) => {
                                                        const key = `${meeting._id}-${type.value}`;
                                                        const isGenerating = generatingAssets.has(key);
                                                        const Icon = type.icon;

                                                        return (
                                                            <button
                                                                key={type.value}
                                                                onClick={() => generateAsset(meeting._id, type.value)}
                                                                disabled={isGenerating}
                                                                className="flex flex-col items-center gap-2 p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                                                            >
                                                                {isGenerating ? (
                                                                    <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                                                                ) : (
                                                                    <Icon className="w-6 h-6 text-purple-400" />
                                                                )}
                                                                <span className="text-sm text-center">
                                                                    {type.label}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Assets Gallery */}
                                            {meetingAssets.length > 0 && (
                                                <div>
                                                    <h3 className="text-sm font-medium text-gray-400 mb-3">
                                                        Generated Assets
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {meetingAssets.map((asset) => (
                                                            <div
                                                                key={asset._id}
                                                                className="bg-white/5 border border-white/10 rounded-lg overflow-hidden"
                                                            >
                                                                <div 
                                                                    className="aspect-video bg-white/10 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors group relative"
                                                                    onClick={() => setExpandedImage(asset.imageData)}
                                                                >
                                                                    <img
                                                                        src={asset.imageData}
                                                                        alt={asset.assetType}
                                                                        className="w-full h-full object-contain"
                                                                    />
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <p className="text-white text-sm font-medium">Click to expand</p>
                                                                    </div>
                                                                </div>
                                                                <div className="p-4">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-sm font-medium capitalize">
                                                                            {asset.assetType.replace('-', ' ')}
                                                                        </span>
                                                                        <span className="text-xs text-gray-500">
                                                                            {formatDate(asset.createdAt)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                setRevisionAssetId(asset._id);
                                                                                setRevisionMeetingId(meeting._id);
                                                                                setShowRevisionModal(true);
                                                                            }}
                                                                            className="px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                                                                            title="Revise design"
                                                                        >
                                                                            <MessageSquare className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() =>
                                                                                downloadAsset(
                                                                                    asset.imageData,
                                                                                    `${meeting.title}-${asset.assetType}.png`
                                                                                )
                                                                            }
                                                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                                                        >
                                                                            <Download className="w-4 h-4" />
                                                                            Download
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteAsset(asset._id, meeting._id)}
                                                                            className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Revision Modal */}
            {showRevisionModal && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
                    onClick={() => {
                        setShowRevisionModal(false);
                        setRevisionInstructions("");
                        setRevisionAssetId(null);
                        setRevisionMeetingId(null);
                    }}
                >
                    <div
                        className="bg-zinc-900 border border-white/10 rounded-xl max-w-2xl w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
                            <h2 className="text-2xl font-light flex items-center gap-2">
                                <MessageSquare className="w-6 h-6 text-purple-400" />
                                Revise Design
                            </h2>
                            <button
                                onClick={() => {
                                    setShowRevisionModal(false);
                                    setRevisionInstructions("");
                                    setRevisionAssetId(null);
                                    setRevisionMeetingId(null);
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-400 mb-4">
                                Describe how you'd like to modify this design:
                            </p>
                            <textarea
                                value={revisionInstructions}
                                onChange={(e) => setRevisionInstructions(e.target.value)}
                                placeholder="Example: Make the title larger, change colors to blue and gold, add more space around the logo, use a modern font..."
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none h-40"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Be specific about what you want to change. The AI will regenerate the design with your modifications.
                            </p>
                        </div>
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                onClick={() => {
                                    setShowRevisionModal(false);
                                    setRevisionInstructions("");
                                    setRevisionAssetId(null);
                                    setRevisionMeetingId(null);
                                }}
                                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReviseAsset}
                                disabled={isRevising || !revisionInstructions.trim()}
                                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isRevising ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Revising...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Revise Design
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Expanded Image Modal */}
            {expandedImage && (
                <div
                    className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                    onClick={() => setExpandedImage(null)}
                >
                    <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
                        <button
                            onClick={() => setExpandedImage(null)}
                            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors z-10"
                            title="Close"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>
                        <img
                            src={expandedImage}
                            alt="Expanded view"
                            className="max-w-full max-h-full object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
