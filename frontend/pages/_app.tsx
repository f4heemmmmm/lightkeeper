import type { AppProps } from "next/app";
import "@/styles/globals.css";
import { ToastProvider } from "@/components/ToastContainer";

export default function MyApp({ Component, pageProps }: AppProps) {
    return (
        <ToastProvider>
            <Component {...pageProps} />
        </ToastProvider>
    );
}
