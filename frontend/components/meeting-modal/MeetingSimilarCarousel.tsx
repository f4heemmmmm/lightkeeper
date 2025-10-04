import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileText, Tag } from "lucide-react";

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

interface MeetingSimilarCarouselProps {
    currentMeeting: Meeting;
    allMeetings: Meeting[];
    onMeetingSelect: (meeting: Meeting) => void;
}

export default function MeetingSimilarCarousel({
    currentMeeting,
    allMeetings,
    onMeetingSelect,
}: MeetingSimilarCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Calculate similarity based on tags and internal tags
    const similarMeetings = useMemo(() => {
        const currentTags = new Set([
            ...(currentMeeting.tags || []),
            ...(currentMeeting.internalTags || [])
        ]);

        if (currentTags.size === 0) {
            return [];
        }

        const meetingsWithScore = allMeetings
            .filter(m => m._id !== currentMeeting._id)
            .map(meeting => {
                const meetingTags = new Set([
                    ...(meeting.tags || []),
                    ...(meeting.internalTags || [])
                ]);

                let score = 0;
                
                // Calculate overlap score
                for (const tag of currentTags) {
                    if (meetingTags.has(tag)) {
                        score++;
                    }
                }

                // Boost score for specific internal tags
                if (currentMeeting.internalTags?.includes('follow-up-required') && 
                    meeting.internalTags?.includes('follow-up-required')) {
                    score += 2;
                }

                // Check for topic similarity tags
                const currentTopics = (currentMeeting.internalTags || [])
                    .filter(tag => tag.includes('-discussion') || tag.includes('-planning') || tag.includes('-matters'));
                const meetingTopics = (meeting.internalTags || [])
                    .filter(tag => tag.includes('-discussion') || tag.includes('-planning') || tag.includes('-matters'));
                
                for (const topic of currentTopics) {
                    if (meetingTopics.includes(topic)) {
                        score += 3;
                    }
                }

                return { meeting, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(item => item.meeting);

        return similarMeetings;
    }, [currentMeeting, allMeetings]);

    const checkScroll = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [similarMeetings]);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 300;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
            setTimeout(checkScroll, 300);
        }
    };

    if (similarMeetings.length === 0) {
        return null;
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    return (
        <div className="border-t border-white/10 px-8 py-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-300">Similar Meetings</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => scroll('left')}
                        disabled={!canScrollLeft}
                        className={`p-1.5 rounded-lg transition-colors ${
                            canScrollLeft 
                                ? 'bg-white/5 hover:bg-white/10 text-gray-400' 
                                : 'bg-white/5 text-gray-600 cursor-not-allowed'
                        }`}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        disabled={!canScrollRight}
                        className={`p-1.5 rounded-lg transition-colors ${
                            canScrollRight 
                                ? 'bg-white/5 hover:bg-white/10 text-gray-400' 
                                : 'bg-white/5 text-gray-600 cursor-not-allowed'
                        }`}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div 
                ref={scrollRef}
                onScroll={checkScroll}
                className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {similarMeetings.map((meeting) => (
                    <div
                        key={meeting._id}
                        onClick={() => onMeetingSelect(meeting)}
                        className="flex-shrink-0 w-80 bg-white/5 border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm mb-1 truncate">
                                    {meeting.title}
                                </h4>
                                {meeting.description && (
                                    <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                                        {meeting.description}
                                    </p>
                                )}
                                {meeting.tags && meeting.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {meeting.tags.slice(0, 3).map((tag, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-xs"
                                            >
                                                <Tag className="w-2.5 h-2.5" />
                                                {tag}
                                            </span>
                                        ))}
                                        {meeting.tags.length > 3 && (
                                            <span className="text-xs text-gray-500">
                                                +{meeting.tags.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>{formatDate(meeting.createdAt)}</span>
                                    <span>•</span>
                                    <span>{meeting.uploaderName}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}
