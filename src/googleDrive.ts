/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple lightweight encryption/decryption helper for secure local and backup storage
export function encryptData(data: string, secretKey: string = "GuruAsistenSecretKey"): string {
  try {
    const chars = data.split('');
    const encrypted = chars.map((char, index) => {
      const keyChar = secretKey.charCodeAt(index % secretKey.length);
      const charCode = char.charCodeAt(0);
      return String.fromCharCode(charCode ^ keyChar);
    });
    return btoa(unescape(encodeURIComponent(encrypted.join(''))));
  } catch (e) {
    console.error("Encryption error:", e);
    return btoa(data); // Fallback to base64
  }
}

export function decryptData(cipherText: string, secretKey: string = "GuruAsistenSecretKey"): string {
  try {
    const decoded = decodeURIComponent(escape(atob(cipherText)));
    const chars = decoded.split('');
    const decrypted = chars.map((char, index) => {
      const keyChar = secretKey.charCodeAt(index % secretKey.length);
      const charCode = char.charCodeAt(0);
      return String.fromCharCode(charCode ^ keyChar);
    });
    return decrypted.join('');
  } catch (e) {
    console.error("Decryption error:", e);
    try {
      return atob(cipherText); // Fallback to normal base64 decode
    } catch (err) {
      return cipherText;
    }
  }
}

// Helper to get sanitized backup filename based on teacher's email to prevent multi-teacher data leakage
export function getBackupFileName(teacherEmail?: string): string {
  if (!teacherEmail) return "GuruAsisten_backup.json";
  const sanitized = teacherEmail.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return `GuruAsisten_backup_${sanitized}.json`;
}

// Google Drive API Integration
export async function findBackupFile(accessToken: string, teacherEmail?: string): Promise<string | null> {
  try {
    const fileName = getBackupFileName(teacherEmail);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id, name)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("UNAUTHORIZED_OR_EXPIRED");
      }
      throw new Error(`Drive API error listing files: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error: any) {
    console.error("Error finding backup file:", error);
    if (error?.message === "UNAUTHORIZED_OR_EXPIRED") {
      throw error;
    }
    return null;
  }
}

export async function saveBackupToDrive(accessToken: string, appDataStr: string, teacherEmail?: string): Promise<string> {
  const encryptedData = encryptData(appDataStr);
  const fileId = await findBackupFile(accessToken, teacherEmail);
  const fileName = getBackupFileName(teacherEmail);

  if (fileId) {
    // File exists, update content using PATCH
    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: encryptedData,
          backupDate: new Date().toISOString()
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("UNAUTHORIZED_OR_EXPIRED");
      }
      throw new Error(`Gagal memperbarui backup di Google Drive: ${response.statusText}`);
    }

    return fileId;
  } else {
    // File doesn't exist, create metadata first, then upload
    const metaResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: fileName,
        mimeType: "application/json",
      }),
    });

    if (!metaResponse.ok) {
      if (metaResponse.status === 401 || metaResponse.status === 403) {
        throw new Error("UNAUTHORIZED_OR_EXPIRED");
      }
      throw new Error(`Gagal membuat metadata backup di Google Drive: ${metaResponse.statusText}`);
    }

    const metaData = await metaResponse.json();
    const newFileId = metaData.id;

    // Upload content
    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${newFileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: encryptedData,
          backupDate: new Date().toISOString()
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("UNAUTHORIZED_OR_EXPIRED");
      }
      throw new Error(`Gagal mengunggah konten backup ke Google Drive: ${response.statusText}`);
    }

    return newFileId;
  }
}

export async function restoreBackupFromDrive(accessToken: string, teacherEmail?: string): Promise<string | null> {
  try {
    const fileId = await findBackupFile(accessToken, teacherEmail);
    if (!fileId) return null;

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("UNAUTHORIZED_OR_EXPIRED");
      }
      throw new Error(`Gagal mengunduh backup dari Google Drive: ${response.statusText}`);
    }

    const payload = await response.json();
    if (payload && payload.data) {
      return decryptData(payload.data);
    }
    return null;
  } catch (error: any) {
    console.error("Error restoring from Drive:", error);
    if (error?.message === "UNAUTHORIZED_OR_EXPIRED") {
      throw error;
    }
    return null;
  }
}

// Google Sheets API Integration - Export Data
export interface SheetExportPayload {
  title: string;
  headers: string[];
  rows: string[][];
}

export async function exportToGoogleSheets(accessToken: string, payload: SheetExportPayload): Promise<string> {
  try {
    // 1. Create a new Spreadsheet
    const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: `GuruAsisten - ${payload.title} (${new Date().toLocaleDateString('id-ID')})`,
        },
      }),
    });

    if (!createResponse.ok) {
      if (createResponse.status === 401 || createResponse.status === 403) {
        throw new Error("UNAUTHORIZED_OR_EXPIRED");
      }
      throw new Error(`Gagal membuat Google Sheet baru: ${createResponse.statusText || createResponse.status}`);
    }

    const spreadsheet = await createResponse.json();
    const spreadsheetId = spreadsheet.spreadsheetId;
    const spreadsheetUrl = spreadsheet.spreadsheetUrl;

    // 2. Write Headers + Rows to Sheet1!A1
    const values = [payload.headers, ...payload.rows];
    const writeResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: values,
        }),
      }
    );

    if (!writeResponse.ok) {
      if (writeResponse.status === 401 || writeResponse.status === 403) {
        throw new Error("UNAUTHORIZED_OR_EXPIRED");
      }
      throw new Error(`Gagal menulis data ke Google Sheet: ${writeResponse.statusText || writeResponse.status}`);
    }

    return spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  } catch (error) {
    console.error("Sheets export error:", error);
    throw error;
  }
}

// Google Sheets API Integration - Import Data
export async function importFromGoogleSheets(accessToken: string, spreadsheetId: string, range: string = 'Sheet1!A1:Z500'): Promise<string[][]> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("UNAUTHORIZED_OR_EXPIRED");
      }
      throw new Error(`Gagal membaca data dari Google Sheet: ${response.statusText || response.status}`);
    }

    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error("Sheets import error:", error);
    throw error;
  }
}

