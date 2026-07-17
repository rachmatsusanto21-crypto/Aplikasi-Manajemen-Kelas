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

// Helper to get backup filename based on date and time
export function getBackupFileNameWithDateTime(teacherEmail?: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  
  if (!teacherEmail) {
    return `Backup_Guru_Asisten_${dateStr}_${timeStr}.json`;
  }
  const sanitized = teacherEmail.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return `Backup_Guru_Asisten_${sanitized}_${dateStr}_${timeStr}.json`;
}

// Google Drive Folder management: Find or create "Backup Guru Asisten" folder
export async function getOrCreateBackupFolder(accessToken: string): Promise<string> {
  const folderName = "Backup Guru Asisten";
  const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`,
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
      throw new Error(`Gagal mencari folder cadangan: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create folder if it doesn't exist
    const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (!createResponse.ok) {
      if (createResponse.status === 401 || createResponse.status === 403) {
        throw new Error("UNAUTHORIZED_OR_EXPIRED");
      }
      throw new Error(`Gagal membuat folder cadangan di Google Drive: ${createResponse.statusText}`);
    }

    const folderData = await createResponse.json();
    return folderData.id;
  } catch (error: any) {
    console.error("Error in getOrCreateBackupFolder:", error);
    throw error;
  }
}

// Find the latest backup file inside the "Backup Guru Asisten" folder
export async function findLatestBackupFile(accessToken: string, teacherEmail?: string): Promise<{ id: string; name: string } | null> {
  try {
    const folderId = await getOrCreateBackupFolder(accessToken);
    
    let queryStr = `'${folderId}' in parents and trashed=false and mimeType='application/json'`;
    if (teacherEmail) {
      const sanitized = teacherEmail.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      queryStr += ` and name contains '${sanitized}'`;
    }
    
    const query = encodeURIComponent(queryStr);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&fields=files(id, name)&pageSize=1`,
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
      return null;
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return { id: data.files[0].id, name: data.files[0].name };
    }
    
    // Fallback search without teacherEmail if no files found
    if (teacherEmail) {
      const fallbackQuery = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType='application/json'`);
      const fbResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${fallbackQuery}&orderBy=createdTime desc&fields=files(id, name)&pageSize=1`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (fbResponse.ok) {
        const fbData = await fbResponse.json();
        if (fbData.files && fbData.files.length > 0) {
          return { id: fbData.files[0].id, name: fbData.files[0].name };
        }
      }
    }
    
    return null;
  } catch (error: any) {
    console.error("Error finding latest backup file:", error);
    if (error?.message === "UNAUTHORIZED_OR_EXPIRED") {
      throw error;
    }
    return null;
  }
}

// Google Drive API Integration - Find backup by exact filename (legacy/compatibility)
export async function findBackupFile(accessToken: string, teacherEmail?: string): Promise<string | null> {
  try {
    const latest = await findLatestBackupFile(accessToken, teacherEmail);
    return latest ? latest.id : null;
  } catch (error: any) {
    return null;
  }
}

export async function saveBackupToDrive(accessToken: string, appDataStr: string, teacherEmail?: string): Promise<string> {
  const encryptedData = encryptData(appDataStr);
  const folderId = await getOrCreateBackupFolder(accessToken);
  const fileName = getBackupFileNameWithDateTime(teacherEmail);

  // Create new file inside the backup folder
  const metaResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: fileName,
      mimeType: "application/json",
      parents: [folderId]
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

export async function restoreBackupFromDrive(accessToken: string, teacherEmail?: string): Promise<string | null> {
  try {
    const latestFile = await findLatestBackupFile(accessToken, teacherEmail);
    if (!latestFile) return null;

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media`,
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

export async function deleteBackupFromDrive(accessToken: string, teacherEmail?: string): Promise<boolean> {
  try {
    const folderId = await getOrCreateBackupFolder(accessToken);
    let queryStr = `'${folderId}' in parents and trashed=false and mimeType='application/json'`;
    if (teacherEmail) {
      const sanitized = teacherEmail.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      queryStr += ` and name contains '${sanitized}'`;
    }
    const query = encodeURIComponent(queryStr);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name)`,
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
      return false;
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      for (const file of data.files) {
        const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          }
        });
        if (!delRes.ok) {
          console.error(`Failed to delete file ${file.name}: ${delRes.statusText}`);
        }
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error in deleteBackupFromDrive:", error);
    throw error;
  }
}


