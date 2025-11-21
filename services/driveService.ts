
import { DocumentFile } from '../types';
import { read, utils } from 'xlsx';

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

export const handleAuthClick = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      console.error("Token client is not initialized.");
      reject("Google Drive integration is not ready yet. Please reload.");
      return;
    }

    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp.error_description || resp.error);
        return;
      }
      accessToken = resp.access_token;
      resolve(accessToken);
    };

    try {
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (e) {
      reject(e);
    }
  });
};

export const openDrivePicker = (
  apiKey: string,
  oauthToken: string,
  onPick: (files: any[]) => void
) => {
  if (!window.google || !window.google.picker) {
    console.error("Google Picker API not loaded");
    return;
  }

  // Comprehensive list of MIME types
  const supportedMimeTypes = [
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "application/vnd.google-apps.folder" // Folders
  ].join(",");

  // 1. View for Files (DocsView) - Good for seeing content
  const filesView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
  filesView.setMimeTypes(supportedMimeTypes);
  filesView.setIncludeFolders(true); 
  filesView.setSelectFolderEnabled(false); // Selecting a folder here opens it (Navigation)
  filesView.setLabel("Select Files");

  // 2. View for MULTI-FOLDER Selection (FoldersView)
  // This view is specifically designed to allow ticking multiple folder boxes.
  const multiFolderView = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS);
  multiFolderView.setIncludeFolders(true); 
  multiFolderView.setMimeTypes("application/vnd.google-apps.folder");
  multiFolderView.setSelectFolderEnabled(true); 
  multiFolderView.setLabel("Select Multiple Folders");

  const picker = new window.google.picker.PickerBuilder()
    .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
    .enableFeature(window.google.picker.Feature.SUPPORT_DRIVES)
    .setDeveloperKey(apiKey)
    .setAppId(storedClientId)
    .setOAuthToken(oauthToken)
    .addView(filesView)         // Tab 1: Files
    .addView(multiFolderView)   // Tab 2: Folders (Multi)
    .setCallback((data: any) => {
      if (data.action === window.google.picker.Action.PICKED) {
        onPick(data.docs);
      }
    })
    .build();

  picker.setVisible(true);
};

/**
 * Lists files inside a Google Drive folder
 */
const listFilesInFolder = async (folderId: string, accessToken: string): Promise<any[]> => {
  // Explicitly search for Office formats, PDFs, and CSVs
  const query = `'${folderId}' in parents and trashed = false and (` +
    `mimeType = 'application/pdf' or ` +
    `mimeType = 'text/plain' or ` +
    `mimeType = 'text/csv' or ` +
    `mimeType = 'application/vnd.google-apps.document' or ` +
    `mimeType = 'application/vnd.google-apps.spreadsheet' or ` +
    `mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or ` +
    `mimeType = 'application/vnd.ms-excel')`;
  
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&pageSize=1000`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    console.warn(`Failed to list files in folder ${folderId}`);
    return [];
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * Downloads a file from Drive.
 */
export const downloadDriveFile = async (fileId: string, mimeType: string, accessToken: string): Promise<string> => {
  let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
  // Export Google Docs/Sheets as PDF
  if (mimeType.includes('application/vnd.google-apps.document')) {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
  }
  // Export Google Sheets as Excel (XLSX) to be processed as binary
  else if (mimeType.includes('application/vnd.google-apps.spreadsheet')) {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
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

export const processPickedFiles = async (pickedFiles: any[], token: string): Promise<DocumentFile[]> => {
  if (!token) throw new Error("No access token available for file processing");
  
  const processedDocs: DocumentFile[] = [];
  let filesToDownload: any[] = [];

  // 1. Expand Folders
  for (const file of pickedFiles) {
    // Check for both standard folder mimetype and if the user picked a folder via DocsView
    if (file.mimeType === 'application/vnd.google-apps.folder' || file.type === 'folder') {
      const folderFiles = await listFilesInFolder(file.id, token);
      filesToDownload = [...filesToDownload, ...folderFiles];
    } else {
      filesToDownload.push(file);
    }
  }

  // Remove duplicates based on ID
  filesToDownload = filesToDownload.filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i);

  // 2. Download and Process all files
  for (const file of filesToDownload) {
    try {
      const base64Content = await downloadDriveFile(file.id, file.mimeType, token);
      
      let effectiveMimeType = file.mimeType;
      let effectiveType = 'FILE';
      let finalContent = base64Content;
      let isInline = true;

      const isExcel = file.mimeType.includes('spreadsheet') || 
                      file.mimeType.includes('excel') || 
                      file.mimeType.includes('openxmlformats-officedocument.spreadsheetml.sheet');
      
      const isCSV = file.mimeType.includes('csv');

      if (isExcel || isCSV) {
        // --- EXCEL/CSV PROCESSING ---
        // Gemini doesn't support inline Excel binary. We must convert to text/csv.
        try {
           const rawData = atob(base64Content);
           const bytes = new Uint8Array(rawData.length);
           for (let i = 0; i < rawData.length; i++) {
               bytes[i] = rawData.charCodeAt(i);
           }
           const workbook = read(bytes, { type: 'array' });
           
           // Convert first sheet to CSV
           const firstSheetName = workbook.SheetNames[0];
           const worksheet = workbook.Sheets[firstSheetName];
           const csvText = utils.sheet_to_csv(worksheet);
           
           finalContent = csvText;
           isInline = false; // Text is not inlineData, it's a text part
           effectiveMimeType = 'text/csv';
           effectiveType = 'XLSX';
        } catch (conversionError) {
          console.error("Excel conversion failed", conversionError);
          continue; // Skip if we can't read it
        }
      } else if (file.mimeType.includes('application/vnd.google-apps.document') || file.mimeType.includes('pdf')) {
        effectiveMimeType = 'application/pdf';
        effectiveType = 'PDF';
      } else if (file.mimeType.includes('text')) {
         // Pure text files
         try {
             finalContent = atob(base64Content);
             isInline = false;
             effectiveMimeType = 'text/plain';
             effectiveType = 'TXT';
         } catch (e) {
             // Fallback to binary if decoding fails
         }
      }

      processedDocs.push({
        id: file.id,
        name: file.name,
        type: effectiveType,
        content: finalContent,
        isInlineData: isInline, 
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
