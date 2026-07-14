/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  googleSignIn, 
  logoutGoogle, 
  getAccessToken 
} from '../firebase';
import { 
  saveBackupToDrive, 
  restoreBackupFromDrive, 
  exportToGoogleSheets, 
  SheetExportPayload 
} from '../googleDrive';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Download, 
  FileSpreadsheet, 
  Moon, 
  Sun, 
  Bell, 
  BellOff, 
  Play, 
  ShieldCheck, 
  ArrowUpRight,
  Settings,
  HelpCircle
} from 'lucide-react';
import { Student, Attendance, Grade, LearningJournal, Schedule, SchoolClass } from '../types';

interface GoogleSyncProps {
  // Database tables to serialize / deserialize
  students: Student[];
  classes: SchoolClass[];
  attendance: Attendance[];
  grades: Grade[];
  journals: LearningJournal[];
  schedules: Schedule[];
  onRestoreDatabase: (db: {
    students?: Student[];
    classes?: SchoolClass[];
    attendance?: Attendance[];
    grades?: Grade[];
    journals?: LearningJournal[];
    schedules?: Schedule[];
  }) => void;

  // Preferences state
  theme: 'light' | 'dark';
  onChangeTheme: (theme: 'light' | 'dark') => void;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  notificationReminderTime: string;
  onChangeReminderTime: (time: string) => void;
  automaticBackup: boolean;
  onToggleAutomaticBackup: (enabled: boolean) => void;
  
  // Google Auth Info
  connectedEmail: string | null;
  connectedName: string | null;
  onConnectGoogle: (email: string | null, name: string | null) => void;
  lastBackupTime: string | null;
  onUpdateBackupTime: (time: string | null) => void;

  // Notification simulation trigger
  onSimulateNotification: () => void;
}

export default function GoogleSync({
  students,
  classes,
  attendance,
  grades,
  journals,
  schedules,
  onRestoreDatabase,
  theme,
  onChangeTheme,
  notificationsEnabled,
  onToggleNotifications,
  notificationReminderTime,
  onChangeReminderTime,
  automaticBackup,
  onToggleAutomaticBackup,
  connectedEmail,
  connectedName,
  onConnectGoogle,
  lastBackupTime,
  onUpdateBackupTime,
  onSimulateNotification,
}: GoogleSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [exportingType, setExportingType] = useState<string>('siswa');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSheetUrl, setExportedSheetUrl] = useState<string | null>(null);

  // Sign in to Google
  const handleConnect = async () => {
    setIsSyncing(true);
    try {
      const result = await googleSignIn();
      if (result) {
        onConnectGoogle(result.user.email, result.user.displayName);
        alert(`Berhasil terhubung dengan Google Account: ${result.user.email}`);
      }
    } catch (err) {
      console.error('Connection failed:', err);
      alert('Gagal menghubungkan Akun Google. Pastikan izin pop-up diaktifkan.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Sign out
  const handleDisconnect = async () => {
    if (window.confirm('Apakah Anda yakin ingin mematikan sinkronisasi Google? Cadangan lokal Anda tetap tersimpan.')) {
      await logoutGoogle();
      onConnectGoogle(null, null);
      onUpdateBackupTime(null);
      setExportedSheetUrl(null);
    }
  };

  // Trigger manual Google Drive backup
  const handleBackupNow = async () => {
    const token = getAccessToken();
    if (!token) {
      alert('Silakan hubungkan akun Google Anda terlebih dahulu!');
      return;
    }

    setIsSyncing(true);
    try {
      // Serialize database
      const dbPayload = {
        students,
        classes,
        attendance,
        grades,
        journals,
        schedules,
      };
      
      await saveBackupToDrive(token, JSON.stringify(dbPayload));
      const backupTime = new Date().toLocaleString('id-ID');
      onUpdateBackupTime(backupTime);
      alert('Database berhasil dienkripsi dan dicadangkan dengan aman di Google Drive Anda!');
    } catch (err: any) {
      console.error('Backup failed:', err);
      alert(`Gagal mencadangkan data: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Trigger manual restore from Google Drive
  const handleRestoreNow = async () => {
    const token = getAccessToken();
    if (!token) {
      alert('Silakan hubungkan akun Google Anda terlebih dahulu!');
      return;
    }

    if (!window.confirm('Apakah Anda yakin ingin memulihkan data dari Google Drive? Data lokal saat ini akan digantikan dengan data cadangan.')) {
      return;
    }

    setIsRestoring(true);
    try {
      const restoredStr = await restoreBackupFromDrive(token);
      if (restoredStr) {
        const parsed = JSON.parse(restoredStr);
        onRestoreDatabase(parsed);
        alert('Data berhasil diunduh, didekripsi, dan dipulihkan sepenuhnya!');
      } else {
        alert('Tidak ditemukan file cadangan (GuruAsisten_backup.json) di Google Drive Anda.');
      }
    } catch (err: any) {
      console.error('Restore failed:', err);
      alert(`Gagal memulihkan data: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Export selected data to Google Sheets
  const handleExportSheets = async () => {
    const token = getAccessToken();
    if (!token) {
      alert('Silakan hubungkan akun Google Anda terlebih dahulu!');
      return;
    }

    setIsExporting(true);
    setExportedSheetUrl(null);

    try {
      let payload: SheetExportPayload;

      switch (exportingType) {
        case 'siswa':
          payload = {
            title: 'Daftar Siswa',
            headers: ['NISN', 'Nama Siswa', 'Jenis Kelamin (L/P)', 'ID Kelas'],
            rows: students.map(s => [s.nisn || '', s.name, s.gender, classes.find(c => c.id === s.classId)?.name || ''])
          };
          break;
        case 'absensi':
          payload = {
            title: 'Laporan Absensi',
            headers: ['Tanggal', 'Nama Siswa', 'Kelas', 'Status Absensi (H/I/S/A)', 'Keterangan'],
            rows: attendance.map(a => {
              const student = students.find(s => s.id === a.studentId);
              return [
                a.date,
                student ? student.name : 'Unknown',
                student ? (classes.find(c => c.id === student.classId)?.name || '') : '',
                a.status,
                a.notes
              ];
            })
          };
          break;
        case 'nilai':
          payload = {
            title: 'Daftar Nilai Siswa',
            headers: ['Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Jenis Evaluasi', 'Nilai', 'Tanggal', 'Catatan'],
            rows: grades.map(g => {
              const student = students.find(s => s.id === g.studentId);
              return [
                student ? student.name : 'Unknown',
                student ? (classes.find(c => c.id === student.classId)?.name || '') : '',
                g.subject,
                g.type,
                g.score.toString(),
                g.date,
                g.notes
              ];
            })
          };
          break;
        case 'jurnal':
          payload = {
            title: 'Jurnal Harian Pembelajaran',
            headers: ['Tanggal', 'Kelas', 'Mata Pelajaran', 'Materi/Topik', 'Aktivitas Kegiatan', 'Capaian/Kendala'],
            rows: journals.map(j => [
              j.date,
              classes.find(c => c.id === j.classId)?.name || '',
              j.subject,
              j.topic,
              j.activities,
              j.achievement
            ])
          };
          break;
        case 'jadwal':
          payload = {
            title: 'Jadwal Pelajaran',
            headers: ['Hari', 'Jam Ke-', 'Waktu', 'Mata Pelajaran', 'Kelas'],
            rows: schedules.map(s => [
              s.day,
              s.period.toString(),
              s.time,
              s.subject,
              classes.find(c => c.id === s.classId)?.name || ''
            ])
          };
          break;
        default:
          throw new Error('Jenis ekspor tidak didukung.');
      }

      const sheetUrl = await exportToGoogleSheets(token, payload);
      setExportedSheetUrl(sheetUrl);
      alert('Berhasil mengekspor data ke Google Sheets!');
    } catch (err: any) {
      console.error('Sheets export failed:', err);
      alert(`Gagal mengekspor data ke Google Sheets: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Google Cloud Sync Panel */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6 lg:col-span-2">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-50 dark:border-slate-700/50">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">Sinkronisasi & Backup Google Drive</h3>
            <p className="text-xs text-slate-400">Hubungkan GuruAsisten ke Akun Google Anda untuk enkripsi dan cadangan otomatis.</p>
          </div>
        </div>

        {/* Connection State Panel */}
        {connectedEmail ? (
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Akun Google Terhubung</h4>
                  <p className="text-xs text-emerald-600/90 dark:text-emerald-300 font-medium">{connectedName} ({connectedEmail})</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-xs font-bold text-rose-600 hover:text-rose-500 hover:underline"
              >
                Putuskan Sambungan
              </button>
            </div>
            {lastBackupTime && (
              <p className="text-[10px] text-slate-400">Cadangan cloud terakhir: <b>{lastBackupTime}</b></p>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl text-center space-y-3.5 border border-slate-100 dark:border-slate-800">
            <CloudOff className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Google Drive belum terhubung</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">Data Anda saat ini hanya tersimpan lokal di peramban ini. Hubungkan akun Google untuk backup agar data tidak hilang.</p>
            </div>
            
            <button
              onClick={handleConnect}
              disabled={isSyncing}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/15 transition-all inline-flex items-center space-x-2"
            >
              <Cloud className="w-4 h-4" />
              <span>Hubungkan Akun Google</span>
            </button>
          </div>
        )}

        {/* Sync Controls */}
        {connectedEmail && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="border border-slate-100 dark:border-slate-700 p-4 rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Cadangkan Database Harian</h4>
                <p className="text-[11px] text-slate-400 mt-1">Ganti cadangan di Google Drive dengan versi lokal saat ini.</p>
              </div>
              <button
                onClick={handleBackupNow}
                disabled={isSyncing}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl shadow-md shadow-indigo-600/10 mt-4 transition-all flex items-center justify-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Backup Sekarang</span>
              </button>
            </div>

            <div className="border border-slate-100 dark:border-slate-700 p-4 rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Pulihkan Database Lama</h4>
                <p className="text-[11px] text-slate-400 mt-1">Unduh dan terapkan cadangan dari Google Drive ke perangkat ini.</p>
              </div>
              <button
                onClick={handleRestoreNow}
                disabled={isRestoring}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl shadow-md shadow-emerald-600/10 mt-4 transition-all flex items-center justify-center space-x-1.5"
              >
                <Download className={`w-3.5 h-3.5 ${isRestoring ? 'animate-bounce' : ''}`} />
                <span>Restore Cadangan</span>
              </button>
            </div>
          </div>
        )}

        {/* Google Sheets Export Sub-Panel */}
        {connectedEmail && (
          <div className="border-t border-slate-100 dark:border-slate-700/50 pt-5 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-500" />
                <span>Ekspor Data ke Google Sheets</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Konversi data mengajar Anda menjadi lembar kerja Google Sheets instan.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
              <select
                value={exportingType}
                onChange={(e) => {
                  setExportingType(e.target.value);
                  setExportedSheetUrl(null);
                }}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3.5 py-2 rounded-xl text-xs focus:outline-none flex-1"
              >
                <option value="siswa">Data Daftar Siswa ({students.length} Siswa)</option>
                <option value="absensi">Data Laporan Absensi ({attendance.length} Record)</option>
                <option value="nilai">Data Evaluasi Nilai Siswa ({grades.length} Nilai)</option>
                <option value="jurnal">Data Jurnal Harian Pembelajaran ({journals.length} Jurnal)</option>
                <option value="jadwal">Data Jadwal Pelajaran Mingguan ({schedules.length} Slot)</option>
              </select>

              <button
                onClick={handleExportSheets}
                disabled={isExporting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center space-x-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isExporting ? 'Mengekspor...' : 'Ekspor ke Google Sheets'}</span>
              </button>
            </div>

            {exportedSheetUrl && (
              <div className="bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-emerald-800 dark:text-emerald-400 font-semibold flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-1 text-emerald-500" />
                  Google Sheet berhasil dibuat!
                </span>
                <a
                  href={exportedSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center space-x-1"
                >
                  <span>Buka Lembar Kerja</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* General Settings: Theme & Notifications */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-50 dark:border-slate-700/50">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">Pengaturan Sistem</h3>
            <p className="text-xs text-slate-400">Preferensi tampilan dan notifikasi pengingat harian.</p>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mode Tampilan</h4>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onChangeTheme('light')}
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                theme === 'light'
                  ? 'border-indigo-600 bg-indigo-50/30 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-slate-100 hover:bg-slate-50 text-slate-500 dark:border-slate-700'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Mode Terang</span>
            </button>

            <button
              onClick={() => onChangeTheme('dark')}
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                theme === 'dark'
                  ? 'border-indigo-600 bg-indigo-50/30 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-slate-100 hover:bg-slate-50 text-slate-500 dark:border-slate-700'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Mode Gelap</span>
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="space-y-3.5 border-t border-slate-50 dark:border-slate-700/50 pt-4">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Notifikasi & Alarm</h4>

          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Pengingat Harian Isi Data</h5>
              <p className="text-[10px] text-slate-400 mt-0.5">Mengingatkan Anda mengisi absensi, nilai, dan jurnal.</p>
            </div>
            
            <button
              onClick={() => onToggleNotifications(!notificationsEnabled)}
              className={`p-1.5 rounded-xl transition-all ${
                notificationsEnabled 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' 
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600'
              }`}
            >
              {notificationsEnabled ? <Bell className="w-4.5 h-4.5" /> : <BellOff className="w-4.5 h-4.5" />}
            </button>
          </div>

          {/* Time Picker */}
          {notificationsEnabled && (
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Waktu Alarm</span>
              <input
                type="time"
                value={notificationReminderTime}
                onChange={(e) => onChangeReminderTime(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-2 py-1 rounded-lg text-xs font-bold focus:outline-none"
              />
            </div>
          )}

          {/* Automatic Cloud Backup Switch */}
          {connectedEmail && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60">
              <div>
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Backup Otomatis (Real-Time)</h5>
                <p className="text-[10px] text-slate-400 mt-0.5">Otomatis mencadangkan ke cloud setiap ada perubahan data.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={automaticBackup}
                  onChange={(e) => onToggleAutomaticBackup(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600" />
              </label>
            </div>
          )}

          {/* Test Simulation Trigger */}
          <div className="pt-2">
            <button
              onClick={onSimulateNotification}
              className="w-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-[11px] font-bold py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5 text-indigo-500" />
              <span>Simulasi Notifikasi Pengingat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
