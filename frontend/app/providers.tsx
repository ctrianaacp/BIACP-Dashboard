"use client";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "@/lib/msalConfig";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// MSAL v5: instancia creada al nivel de módulo (inicialización manejada por MsalProvider)
const msalInstance = new PublicClientApplication(msalConfig);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 2 } },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </MsalProvider>
  );
}
