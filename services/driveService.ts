import { DocumentFile } from '../types';

// Types for Google API globals
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

let tokenClient: any;
let accessToken: string | null = null;
let storedClientId = '';

export const initGoogleDrive = (
  apiKey: string, 
  clientId: string, 
  onLoaded: () => void,
  onError: (error: string) => void
) => {
  storedClientId = clientId;
  
  // Robust Initialization:
  // We poll for window.gapi and window.google because they are loaded via <script async>
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    const gapiExists = typeof window !== 'undefined' && !!window.gapi;
    const googleExists = typeof window !== 'undefined' && !!window.google;

    if (gapiExists && googleExists) {
      clearInterval(checkInterval);
      initializeClients(apiKey, clientId, onLoaded, onError);
    } else if (attempts > 80) { // 20 seconds approx
      clearInterval(checkInterval);
      onError("Timeout: Google API scripts failed to load. Check your network or ad-blockers.");
    }
  }, 250);
};

const initializeClients = (apiKey: string, clientId: string, onLoaded: () => void, onError: (err: string) => void) => {
  if (!window.gapi) {
    onError("Google API script not found.");
    return;
  }

  window.gapi.load('client:picker', async () => {
    try {
      // Minimized Init
      await window.gapi.client.init({
        apiKey: apiKey,
      });
      
      if (!window.google || !window.google.accounts) {
         throw new Error("Google Identity Services script not loaded.");
      }

      // IMPORTANT: Explicitly set ux_mode to 'popup' to avoid storagerelay issues.
      // This attempts to force a popup window even in restricted environments.
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        ux_mode: 'popup',
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error("Token Error:", tokenResponse);
            return;
          }
          accessToken = tokenResponse.access_token;
        },
        error_callback: (nonOAuthError: any) => {
           console.error("Non-OAuth Error:", nonOAuthError);
           if (nonOAuthError.type === 'popup_failed_to_open') {
             onError("Popup was blocked. Please allow popups for this site.");
           }
        }
      });

      console.log("Google Drive API fully initialized");
      onLoaded();
    } catch (error: any) {
      console.error("Error initializing Google API clients:", error);
      let errMsg = "Failed to initialize Google Drive API.";
      if (error?.result?.error?.message) {
        errMsg = `API Error: ${error.result.error.message}`;
      } else if (error?.message) {
        errMsg = error.message;
      }
      onError(errMsg);
    }
  });
};

/**
 * triggers the OAuth flow to get an access token
 */
export const handleAuthClick = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      console.error("Token client is not initialized.");
      reject("Google Drive integration is not ready yet. Please reload.");
      return;
    }

    // Override the callback for this specific request to capture the token
    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        // We reject with the RAW error so the user sees it in the UI
        reject(resp.error_description || resp.error);
        return;
      }
      accessToken = resp.access_token;
      resolve(accessToken);
    };

    // Request the token
    try {
      // Force account selection to clear any stuck states
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Opens the Google Picker to allow user to select files
 */
export const openDrivePicker = (
  apiKey: string,
  oauthToken: string,
  onPick: (files: any[]) => void
) => {
  if (!window.google || !window.google.picker) {
    console.error("Google Picker API not loaded");
    return;
  }

  const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
  view.setMimeTypes("application/pdf,text/plain,application/vnd.google-apps.document,application/vnd.google-apps.spreadsheet");

  const picker = new window.google.picker.PickerBuilder()
    .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
    .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
    .setDeveloperKey(apiKey)
    .setAppId(storedClientId)
    .setOAuthToken(oauthToken)
    .addView(view)
    .addView(new window.google.picker.DocsUploadView())
    .setCallback((data: any) => {
      if (data.action === window.google.picker.Action.PICKED) {
        onPick(data.docs);
      }
    })
    .build();

  picker.setVisible(true);
};

/**
 * Downloads a file from Drive.
 */
export const downloadDriveFile = async (fileId: string, mimeType: string, accessToken: string): Promise<string> => {
  let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
  // Export Google Docs/Sheets as PDF
  if (mimeType.includes('application/vnd.google-apps')) {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64String = result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const processPickedFiles = async (pickedFiles: any[]): Promise<DocumentFile[]> => {
  if (!accessToken) throw new Error("No access token available");
  
  const processedDocs: DocumentFile[] = [];

  for (const file of pickedFiles) {
    try {
      const base64Content = await downloadDriveFile(file.id, file.mimeType, accessToken);
      
      const effectiveMimeType = file.mimeType.includes('application/vnd.google-apps') 
        ? 'application/pdf' 
        : file.mimeType;

      const effectiveType = effectiveMimeType.includes('pdf') ? 'PDF' : 'TXT';

      processedDocs.push({
        id: file.id,
        name: file.name,
        type: effectiveType,
        content: base64Content,
        isInlineData: true, 
        mimeType: effectiveMimeType,
        category: 'financial', 
        uploadDate: new Date().toISOString()
      });
    } catch (e) {
      console.error(`Error processing file ${file.name}`, e);
    }
  }

  return processedDocs;
};