import { Trash2, X } from "lucide-react";
import MeetingChatbot from "./meeting-modal/MeetingChatbot";
import MeetingDetails from "./meeting-modal/MeetingDetails";
import MeetingSimilarCarousel from "./meeting-modal/MeetingSimilarCarousel";

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
}

interface MeetingDetailModalProps {
    meeting: Meeting;
    fileContent: string;
    isLoadingContent: boolean;
    onClose: () => void;
    onDelete: (id: string) => void;
    allMeetings?: Meeting[];
    onMeetingSelect?: (meeting: Meeting) => void;
}

export default function MeetingDetailModal({
    meeting,
    fileContent,
    isLoadingContent,
    onClose,
    onDelete,
    allMeetings,
    onMeetingSelect,
}: MeetingDetailModalProps) {
    return (
        <>
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
                onClick={onClose}
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl w-full max-w-9xl max-h-[90vh] flex flex-col">
                    {" "}
                    {/* Header */}
                    <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 flex-shrink-0">
                        <h2 className="text-2xl font-semibold">
                            {meeting.title}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onDelete(meeting._id)}
                                className="text-gray-400 hover:text-red-400 transition-colors p-2 rounded-md hover:bg-white/10"
                                title="Delete meeting"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-md hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    {/* Modal Body */}
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex flex-1 overflow-hidden">
                            {/* Meeting Details Section - Left Side */}
                            <MeetingDetails
                                meeting={meeting}
                                fileContent={fileContent}
                                isLoadingContent={isLoadingContent}
                            />

                            {/* Chatbot Section - Right Side */}
                            <MeetingChatbot
                                meetingId={meeting._id}
                                meetingTitle={meeting.title}
                            />
                        </div>
                        
                        {/* Similar Meetings Carousel - Bottom */}
                        {allMeetings && onMeetingSelect && (
                            <MeetingSimilarCarousel
                                currentMeeting={meeting}
                                allMeetings={allMeetings}
                                onMeetingSelect={onMeetingSelect}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
