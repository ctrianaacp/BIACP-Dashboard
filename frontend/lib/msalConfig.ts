import { Configuration, PopupRequest } from "@azure/msal-browser";

/**
 * Configuración MSAL – App Registration: "Bitácora Bloqueos ACP"
 * Client ID : 0348c2e2-01d0-4b98-bbce-90efa94d7982
 * Tenant ID : cbc2d319-22d3-4f27-8179-2e3c17387677
 * Tipo      : Single Tenant (Solo mi organización)
 * Auth flow : SPA – Authorization Code + PKCE
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID!,
    // Single tenant – solo usuarios de asociacioncp.onmicrosoft.com
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI ?? "http://localhost:3000",
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI ?? "http://localhost:3000",
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: any, message: string, containsPii: boolean) => {
        if (containsPii) return;
        console.log(`[MSAL] ${message}`);
      },
      logLevel: 2, // Info
      piiLoggingEnabled: false
    }
  },
};

/**
 * Scopes necesarios para leer archivos Excel y listas de SharePoint
 * via Microsoft Graph API.
 * IMPORTANTE: Estos scopes deben estar aprobados en el App Registration
 * en Azure AD > API permissions:
 *   - User.Read        (delegado) – perfil del usuario
 *   - Sites.Read.All   (delegado) – leer sitios SharePoint
 *   - Files.Read.All   (delegado) – leer archivos Excel en SharePoint
 */
export const graphScopes: PopupRequest = {
  scopes: [
    "User.Read",
    "Sites.Read.All",
    "Files.Read.All",
  ],
};

/**
 * Scopes de login – incluye Sites y Files ya que tienen admin consent aprobado
 */
export const loginScopes: PopupRequest = {
  scopes: [
    "User.Read",
    "openid",
    "profile",
    "email",
    "Sites.Read.All",
    "Files.Read.All",
  ],
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  graphSitesEndpoint: "https://graph.microsoft.com/v1.0/sites",
  // Los dos sitios SharePoint donde están los datos BIACP
  sites: {
    equipoACP:  "asociacioncp.sharepoint.com:/sites/EquipoACP",
    datosBIACP: "asociacioncp.sharepoint.com:/sites/EquipoACP-DatosBI-ACP",
  },
};
