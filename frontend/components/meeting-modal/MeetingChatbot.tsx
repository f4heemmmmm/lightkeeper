import { useState, useEffect, useRef } from "react";
import axios, { AxiosError } from "axios";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface MeetingChatbotProps {
    meetingId: string;
    meetingTitle: string;
}

interface ChatErrorResponse {
    message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function MeetingChatbot({
    meetingId,
    meetingTitle,
}: MeetingChatbotProps) {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState<string>("");
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem("token");
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop =
                chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

    useEffect(() => {
        setChatMessages([]);
        setChatInput("");
        setChatError(null);
    }, [meetingId]);

    const handleSendMessage = async (): Promise<void> => {
        if (!chatInput.trim() || isSendingMessage) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: chatInput.trim(),
            timestamp: new Date(),
        };

        setChatMessages((prev) => [...prev, userMessage]);
        setChatInput("");
        setIsSendingMessage(true);
        setChatError(null);

        try {
            const conversationHistory = chatMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            const response = await axios.post(
                `${API_URL}/api/chat/meeting`,
                {
                    meetingId: meetingId,
                    message: userMessage.content,
                    conversationHistory: conversationHistory,
                },
                {
                    headers: getAuthHeader(),
                }
            );

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: response.data.response,
                timestamp: new Date(),
            };

            setChatMessages((prev) => [...prev, assistantMessage]);
        } catch (err) {
            console.error("Error sending message:", err);

            const axiosError = err as AxiosError<ChatErrorResponse>;
            let errorMessage = "Failed to get a response. Please try again.";

            if (axiosError.response?.data?.message) {
                errorMessage = axiosError.response.data.message;
            } else if (axiosError.response?.status === 401) {
                errorMessage = "Your session has expired. Please log in again.";
            } else if (axiosError.response?.status === 404) {
                errorMessage = "Meeting not found.";
            }

            setChatError(errorMessage);

            const errorAssistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content:
                    "I apologize, but I encountered an error. Please try again.",
                timestamp: new Date(),
            };

            setChatMessages((prev) => [...prev, errorAssistantMessage]);
        } finally {
            setIsSendingMessage(false);
        }
    };

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLTextAreaElement>
    ): void => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const formatMessageTime = (date: Date): string => {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    return (
        <div className="w-1/3 border-l border-white/10 flex flex-col">
            <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-lg font-semibold">SmartMeeting</h3>
                <p className="text-xs text-gray-400 mt-1">
                    Ask questions about this meeting
                </p>
            </div>

            {/* Chat Error */}
            {chatError && (
                <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded-lg text-xs">
                    {chatError}
                </div>
            )}

            {/* Chat Messages */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
            >
                {chatMessages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm mt-2">
                        <div className="text-xs text-gray-600 space-y-2">
                            <p>Try asking:</p>
                            <p>"What were the main topics discussed?"</p>
                            <p>"Who made decisions in this meeting?"</p>
                            <p>"What are the action items?"</p>
                        </div>
                    </div>
                ) : (
                    chatMessages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${
                                message.role === "user"
                                    ? "justify-end"
                                    : "justify-start"
                            }`}
                        >
                            <div
                                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                                    message.role === "user"
                                        ? "bg-white text-black"
                                        : "bg-white/10 text-white"
                                }`}
                            >
                                {message.role === "assistant" ? (
                                    <div className="text-sm prose prose-invert prose-sm max-w-none">
                                        <ReactMarkdown
                                            components={{
                                                p: ({ children }) => (
                                                    <p className="mb-2 last:mb-0">
                                                        {children}
                                                    </p>
                                                ),
                                                ul: ({ children }) => (
                                                    <ul className="list-disc list-inside mb-2 space-y-1">
                                                        {children}
                                                    </ul>
                                                ),
                                                ol: ({ children }) => (
                                                    <ol className="list-decimal list-inside mb-2 space-y-1">
                                                        {children}
                                                    </ol>
                                                ),
                                                li: ({ children }) => (
                                                    <li className="ml-2">
                                                        {children}
                                                    </li>
                                                ),
                                                strong: ({ children }) => (
                                                    <strong className="font-semibold">
                                                        {children}
                                                    </strong>
                                                ),
                                                em: ({ children }) => (
                                                    <em className="italic">
                                                        {children}
                                                    </em>
                                                ),
                                                code: ({ children }) => (
                                                    <code className="bg-white/10 px-1 py-0.5 rounded text-xs">
                                                        {children}
                                                    </code>
                                                ),
                                                pre: ({ children }) => (
                                                    <pre className="bg-white/10 p-2 rounded text-xs overflow-x-auto mb-2">
                                                        {children}
                                                    </pre>
                                                ),
                                                h1: ({ children }) => (
                                                    <h1 className="text-base font-semibold mb-2">
                                                        {children}
                                                    </h1>
                                                ),
                                                h2: ({ children }) => (
                                                    <h2 className="text-sm font-semibold mb-2">
                                                        {children}
                                                    </h2>
                                                ),
                                                h3: ({ children }) => (
                                                    <h3 className="text-sm font-semibold mb-1">
                                                        {children}
                                                    </h3>
                                                ),
                                                blockquote: ({ children }) => (
                                                    <blockquote className="border-l-2 border-white/30 pl-3 italic mb-2">
                                                        {children}
                                                    </blockquote>
                                                ),
                                            }}
                                        >
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="text-sm whitespace-pre-wrap">
                                        {message.content}
                                    </p>
                                )}
                                <p
                                    className={`text-xs mt-1 ${
                                        message.role === "user"
                                            ? "text-gray-600"
                                            : "text-gray-400"
                                    }`}
                                >
                                    {formatMessageTime(message.timestamp)}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                {isSendingMessage && (
                    <div className="flex justify-start">
                        <div className="bg-white/10 text-white rounded-lg px-4 py-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Chat Input */}
            <div className="px-6 py-4 border-t border-white/10">
                <div className="flex gap-2 items-end">
                    <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a question..."
                        rows={3}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none overflow-y-auto"
                        disabled={isSendingMessage}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim() || isSendingMessage}
                        className="p-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
