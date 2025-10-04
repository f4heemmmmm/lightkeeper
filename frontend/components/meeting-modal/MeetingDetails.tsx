import { useMemo } from "react";

interface Meeting {
    _id: string;
    title: string;
    description?: string;
    summary?: string;
    actionItems?: string[];
    fileName: string;
    fileSize: number;
    fileUrl: string;
    uploaderName: string;
    createdAt: string;
}

interface MeetingDetailsProps {
    meeting: Meeting;
    fileContent: string;
    isLoadingContent: boolean;
}

interface TranscriptLine {
    timestamp?: string;
    speaker?: string;
    text: string;
}

export default function MeetingDetails({
    meeting,
    fileContent,
    isLoadingContent,
}: MeetingDetailsProps) {
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

    /**
     * Parse transcript content to detect format and structure
     */
    const parsedTranscript = useMemo((): TranscriptLine[] | null => {
        if (!fileContent) return null;

        try {
            const jsonData = JSON.parse(fileContent);

            if (Array.isArray(jsonData.utterances)) {
                return jsonData.utterances.map((utterance: any) => ({
                    timestamp: formatTimestamp(utterance.start),
                    speaker: utterance.speaker || "Unknown",
                    text:
                        utterance.text ||
                        utterance.words?.map((w: any) => w.text).join(" ") ||
                        "",
                }));
            }

            if (Array.isArray(jsonData) && jsonData[0]?.text) {
                return jsonData.map((item: any) => ({
                    timestamp: item.timestamp
                        ? formatTimestamp(item.timestamp)
                        : undefined,
                    speaker: item.speaker || item.name,
                    text: item.text,
                }));
            }
        } catch {}

        const lines = fileContent.split("\n").filter((line) => line.trim());
        const parsedLines: TranscriptLine[] = [];

        for (const line of lines) {
            const match1 = line.match(
                /^(\d{1,2}:\d{2}(?::\d{2})?)\s*[–—-]\s*([^:]+):\s*(.+)$/
            );
            if (match1) {
                parsedLines.push({
                    timestamp: match1[1],
                    speaker: match1[2].trim(),
                    text: match1[3].trim(),
                });
                continue;
            }

            const match2 = line.match(
                /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.+)$/
            );
            if (match2) {
                parsedLines.push({
                    timestamp: match2[1],
                    speaker: match2[2].trim(),
                    text: match2[3].trim(),
                });
                continue;
            }

            const match3 = line.match(
                /^([^(]+)\s*\((\d{1,2}:\d{2}(?::\d{2})?)\):\s*(.+)$/
            );
            if (match3) {
                parsedLines.push({
                    timestamp: match3[2],
                    speaker: match3[1].trim(),
                    text: match3[3].trim(),
                });
                continue;
            }

            const match4 = line.match(/^([^:]+):\s*(.+)$/);
            if (match4 && match4[1].length < 50) {
                parsedLines.push({
                    speaker: match4[1].trim(),
                    text: match4[2].trim(),
                });
                continue;
            }

            parsedLines.push({
                text: line.trim(),
            });
        }

        return parsedLines.length > 0 ? parsedLines : null;
    }, [fileContent]);

    /**
     * Format timestamp from seconds to MM:SS or HH:MM:SS
     */
    const formatTimestamp = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, "0")}:${String(
                secs
            ).padStart(2, "0")}`;
        }
        return `${minutes}:${String(secs).padStart(2, "0")}`;
    };

    /**
     * Render structured transcript with speaker and timestamp formatting
     */
    const renderStructuredTranscript = () => {
        if (!parsedTranscript) {
            return (
                <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                    {fileContent}
                </pre>
            );
        }

        return (
            <div className="space-y-4">
                {parsedTranscript.map((line, index) => {
                    if (line.speaker || line.timestamp) {
                        return (
                            <div key={index} className="group">
                                <div className="flex items-baseline gap-2 mb-1">
                                    {line.timestamp && (
                                        <span className="text-xs text-gray-500 font-mono tabular-nums">
                                            {line.timestamp}
                                        </span>
                                    )}
                                    {line.speaker && (
                                        <span className="text-sm font-semibold text-blue-400">
                                            {line.speaker}:
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-300 text-sm leading-relaxed pl-0">
                                    {line.text}
                                </p>
                            </div>
                        );
                    } else {
                        return (
                            <p
                                key={index}
                                className="text-gray-300 text-sm leading-relaxed"
                            >
                                {line.text}
                            </p>
                        );
                    }
                })}
            </div>
        );
    };

    return (
        <div className="flex-1 px-8 py-6 space-y-6 overflow-y-auto">
            {meeting.description && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Description
                    </h3>
                    <p className="text-gray-300 text-base leading-relaxed">
                        {meeting.description}
                    </p>
                </div>
            )}

            {meeting.summary && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Meeting Summary
                    </h3>
                    <p className="text-gray-300 text-base leading-relaxed">
                        {meeting.summary}
                    </p>
                </div>
            )}

            {meeting.actionItems && meeting.actionItems.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Action Items
                    </h3>
                    <ul className="space-y-2">
                        {meeting.actionItems.map((item, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <span className="text-blue-400 mt-1.5">•</span>
                                <span className="text-gray-300 text-sm">
                                    {item}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    File Information
                </h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-400">File Name:</span>
                        <span className="text-white">{meeting.fileName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">File Size:</span>
                        <span className="text-white">
                            {formatFileSize(meeting.fileSize)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Uploaded By:</span>
                        <span className="text-white">
                            {meeting.uploaderName}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Uploaded At:</span>
                        <span className="text-white">
                            {formatDateTime(meeting.createdAt)}
                        </span>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Full Transcript
                </h3>
                {isLoadingContent ? (
                    <div className="text-center py-8 text-gray-400">
                        Loading content...
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                        {renderStructuredTranscript()}
                    </div>
                )}
            </div>
        </div>
    );
}
