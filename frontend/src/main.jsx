/**
 * Main Entry Point
 * Renders the React application
 * ✅ Phase 4.1: React Query for automatic API response caching
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from "@sentry/react";
import App from './App';

Sentry.init({
  dsn: "https://af7b019b353ff61b097fd3342c7085a0@o4511373536133120.ingest.de.sentry.io/4511373573619792",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0, 
  tracePropagationTargets: ["localhost", /^\/api/],
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0, 
});


// ✅ Phase 4.1: Global React Query client configuration
// Mobile optimizations:
//  - gcTime 30 min (was 10): navigating tabs never refetches for 30 min → 0 extra calls
//  - retry 2 on native (was 1): handles cellular blips (3G → 4G handoffs, tunnels)
//  - retryDelay exponential: 1s → 2s → 4s — avoids hammering a struggling server
import { Capacitor } from "@capacitor/core";
const IS_NATIVE = Capacitor.isNativePlatform();

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,       // 5 minutes: data is "fresh" for 5 min
            gcTime: 30 * 60 * 1000,          // 30 minutes (was 10): keep in memory longer on mobile
            refetchOnWindowFocus: false,      // Don't refetch when tab regains focus
            refetchOnReconnect: true,         // Do refetch when network reconnects
            retry: IS_NATIVE ? 2 : 1,        // Mobile gets 1 extra retry for flaky networks
            retryDelay: (attempt) =>
                Math.min(1000 * 2 ** attempt, 10000), // Exponential: 1s, 2s, 4s (max 10s)
        },
        mutations: {
            retry: 0,                         // Don't retry failed mutations
        },
    },
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </React.StrictMode>
);

