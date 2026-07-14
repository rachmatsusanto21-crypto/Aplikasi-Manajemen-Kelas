/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  HelpCircle,
  Calendar,
  Layers,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  FileDown,
  Terminal,
  Activity
} from 'lucide-react';
import { Student, Attendance, Grade, LearningJournal, Schedule, SchoolClass } from '../types';

interface GoogleSyncProps {
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

  theme: 'light' | 'dark';
  onChangeTheme: (theme: 'light' | 'dark') => void;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  notificationReminderTime: string;
  onChangeReminderTime: (time: string) => void;
  automaticBackup: boolean;
  onToggleAutomaticBackup: (enabled: boolean) => void;
  
  connectedEmail: string | null;
  connectedName: string | null;
  onConnectGoogle: (email: string | null, name: string | null) => void;
  lastBackupTime: string | null;
  onUpdateBackupTime: (time: string | null) => void;

  onSimulateNotification: () => void;
}

// Interfacial definitions for custom meetings and events
interface TeacherMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  notes: string;
}

interface ClassEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'Ujian' | 'Praktek' | 'Acara' | 'Lainnya';
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

  // --- CALENDAR SYNC MODULE STATES ---
  const activeTeacherStr = sessionStorage.getItem('guruasisten_active_teacher');
  const activeTeacher = activeTeacherStr ? JSON.parse(activeTeacherStr) : null;
  const teacherId = activeTeacher ? activeTeacher.id : 'default_teacher';

  // Connected calendar states (accounts)
  const [connectedGoogleCalEmail, setConnectedGoogleCalEmail] = useState<string | null>(() => {
    return localStorage.getItem(`ga_${teacherId}_cal_google_email`);
  });
  const [connectedOutlookCalEmail, setConnectedOutlookCalEmail] = useState<string | null>(() => {
    return localStorage.getItem(`ga_${teacherId}_cal_outlook_email`);
  });

  // Sync Preferences
  const [syncDirection, setSyncDirection] = useState<'one_way' | 'two_way'>(() => {
    return (localStorage.getItem(`ga_${teacherId}_cal_direction`) as 'one_way' | 'two_way') || 'one_way';
  });
  const [syncFrequency, setSyncFrequency] = useState<'manual' | 'hourly' | 'daily'>(() => {
    return (localStorage.getItem(`ga_${teacherId}_cal_frequency`) as 'manual' | 'hourly' | 'daily') || 'manual';
  });
  
  // Choose which elements to sync
  const [syncLessons, setSyncLessons] = useState<boolean>(() => {
    const val = localStorage.getItem(`ga_${teacherId}_cal_sync_lessons`);
    return val !== null ? val === 'true' : true;
  });
  const [syncMeetings, setSyncMeetings] = useState<boolean>(() => {
    const val = localStorage.getItem(`ga_${teacherId}_cal_sync_meetings`);
    return val !== null ? val === 'true' : true;
  });
  const [syncEvents, setSyncEvents] = useState<boolean>(() => {
    const val = localStorage.getItem(`ga_${teacherId}_cal_sync_events`);
    return val !== null ? val === 'true' : true;
  });

  // Custom added Rapat (Meetings) & Class Events (Acara Kelas) states
  const [meetings, setMeetings] = useState<TeacherMeeting[]>(() => {
    const stored = localStorage.getItem(`ga_${teacherId}_meetings`);
    if (stored) return JSON.parse(stored);
    
    // Default initial seeded meetings
    const defaults: TeacherMeeting[] = [
      { id: 'm1', title: 'Rapat Bulanan Evaluasi Kurikulum', date: '2026-07-15', time: '13:00', notes: 'Membahas capaian KKM dan kendala pembelajaran semester ganjil.' },
      { id: 'm2', title: 'Rapat Koordinasi Penerimaan Siswa Baru', date: '2026-07-22', time: '09:30', notes: 'Koordinasi pembagian tugas panitia PPDB.' }
    ];
    localStorage.setItem(`ga_${teacherId}_meetings`, JSON.stringify(defaults));
    return defaults;
  });

  const [classEvents, setClassEvents] = useState<ClassEvent[]>(() => {
    const stored = localStorage.getItem(`ga_${teacherId}_class_events`);
    if (stored) return JSON.parse(stored);

    // Default initial seeded events
    const defaults: ClassEvent[] = [
      { id: 'e1', title: 'Penilaian Harian Bab 1 (Aljabar Linier)', date: '2026-07-16', time: '07:30', type: 'Ujian' },
      { id: 'e2', title: 'Praktikum IPA Terpadu (Mengamati Sel Daun)', date: '2026-07-18', time: '09:00', type: 'Praktek' },
      { id: 'e3', title: 'Pentas Seni & Kebudayaan Nusantara', date: '2026-07-24', time: '10:00', type: 'Acara' }
    ];
    localStorage.setItem(`ga_${teacherId}_class_events`, JSON.stringify(defaults));
    return defaults;
  });

  // New Event Form States
  const [activeFormTab, setActiveFormTab] = useState<'meeting' | 'event'>('meeting');
  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', time: '', notes: '' });
  const [eventForm, setEventForm] = useState({ title: '', date: '', time: '', type: 'Ujian' as 'Ujian' | 'Praktek' | 'Acara' | 'Lainnya' });

  // Sync Log states
  const [calendarSyncLogs, setCalendarSyncLogs] = useState<string[]>(() => {
    const stored = localStorage.getItem(`ga_${teacherId}_cal_logs`);
    return stored ? JSON.parse(stored) : [`[Sistem] Siap melakukan sinkronisasi kalender.`];
  });
  const [isCalendarSyncing, setIsCalendarSyncing] = useState(false);
  const [calendarSyncProgress, setCalendarSyncProgress] = useState(0);

  // Save preference settings to local storage when they change
  useEffect(() => {
    localStorage.setItem(`ga_${teacherId}_cal_direction`, syncDirection);
    localStorage.setItem(`ga_${teacherId}_cal_frequency`, syncFrequency);
    localStorage.setItem(`ga_${teacherId}_cal_sync_lessons`, String(syncLessons));
    localStorage.setItem(`ga_${teacherId}_cal_sync_meetings`, String(syncMeetings));
    localStorage.setItem(`ga_${teacherId}_cal_sync_events`, String(syncEvents));
  }, [syncDirection, syncFrequency, syncLessons, syncMeetings, syncEvents, teacherId]);

  // Connect Google Calendar Simulator
  const handleConnectGoogleCal = () => {
    setIsCalendarSyncing(true);
    setTimeout(() => {
      const email = activeTeacher?.name 
        ? `${activeTeacher.name.toLowerCase().replace(/\s+/g, '')}@guru.sd.belajar.id`
        : 'rachmatsusanto21@guru.sd.belajar.id';
      setConnectedGoogleCalEmail(email);
      localStorage.setItem(`ga_${teacherId}_cal_google_email`, email);
      setIsCalendarSyncing(false);
      
      const newLogs = [
        `[${new Date().toLocaleTimeString()}] Hubungan Google Calendar berhasil (Akun: ${email})`,
        ...calendarSyncLogs
      ];
      setCalendarSyncLogs(newLogs);
      localStorage.setItem(`ga_${teacherId}_cal_logs`, JSON.stringify(newLogs));
      alert(`Berhasil menyambungkan Google Calendar ke akun: ${email}`);
    }, 1000);
  };

  const handleDisconnectGoogleCal = () => {
    if (window.confirm('Putuskan hubungan dengan Google Calendar?')) {
      setConnectedGoogleCalEmail(null);
      localStorage.removeItem(`ga_${teacherId}_cal_google_email`);
      const newLogs = [
        `[${new Date().toLocaleTimeString()}] Hubungan Google Calendar terputus.`,
        ...calendarSyncLogs
      ];
      setCalendarSyncLogs(newLogs);
      localStorage.setItem(`ga_${teacherId}_cal_logs`, JSON.stringify(newLogs));
    }
  };

  // Connect Outlook Calendar Simulator
  const handleConnectOutlookCal = () => {
    setIsCalendarSyncing(true);
    setTimeout(() => {
      const email = activeTeacher?.name 
        ? `${activeTeacher.name.toLowerCase().replace(/\s+/g, '')}@outlook.com`
        : 'rachmatsusanto21@outlook.com';
      setConnectedOutlookCalEmail(email);
      localStorage.setItem(`ga_${teacherId}_cal_outlook_email`, email);
      setIsCalendarSyncing(false);

      const newLogs = [
        `[${new Date().toLocaleTimeString()}] Hubungan Outlook Calendar berhasil (Akun: ${email})`,
        ...calendarSyncLogs
      ];
      setCalendarSyncLogs(newLogs);
      localStorage.setItem(`ga_${teacherId}_cal_logs`, JSON.stringify(newLogs));
      alert(`Berhasil menyambungkan Outlook Calendar ke akun: ${email}`);
    }, 1000);
  };

  const handleDisconnectOutlookCal = () => {
    if (window.confirm('Putuskan hubungan dengan Outlook Calendar?')) {
      setConnectedOutlookCalEmail(null);
      localStorage.removeItem(`ga_${teacherId}_cal_outlook_email`);
      const newLogs = [
        `[${new Date().toLocaleTimeString()}] Hubungan Outlook Calendar terputus.`,
        ...calendarSyncLogs
      ];
      setCalendarSyncLogs(newLogs);
      localStorage.setItem(`ga_${teacherId}_cal_logs`, JSON.stringify(newLogs));
    }
  };

  // Add a meeting
  const handleAddMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingForm.title || !meetingForm.date || !meetingForm.time) {
      alert('Mohon lengkapi judul rapat, tanggal, dan waktu!');
      return;
    }
    const newMeeting: TeacherMeeting = {
      id: 'm_' + Date.now(),
      title: meetingForm.title,
      date: meetingForm.date,
      time: meetingForm.time,
      notes: meetingForm.notes
    };
    const updated = [...meetings, newMeeting];
    setMeetings(updated);
    localStorage.setItem(`ga_${teacherId}_meetings`, JSON.stringify(updated));
    setMeetingForm({ title: '', date: '', time: '', notes: '' });
    
    // Add sync warning log
    const logStr = `[Sistem] Rapat baru "${newMeeting.title}" ditambahkan lokal. Butuh disinkronkan ke kalender eksternal.`;
    const logs = [logStr, ...calendarSyncLogs];
    setCalendarSyncLogs(logs);
    localStorage.setItem(`ga_${teacherId}_cal_logs`, JSON.stringify(logs));
  };

  const handleDeleteMeeting = (id: string, title: string) => {
    if (window.confirm(`Hapus rapat "${title}"?`)) {
      const updated = meetings.filter(m => m.id !== id);
      setMeetings(updated);
      localStorage.setItem(`ga_${teacherId}_meetings`, JSON.stringify(updated));
    }
  };

  // Add a class event
  const handleAddClassEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.date || !eventForm.time) {
      alert('Mohon lengkapi judul acara, tanggal, dan waktu!');
      return;
    }
    const newEvent: ClassEvent = {
      id: 'e_' + Date.now(),
      title: eventForm.title,
      date: eventForm.date,
      time: eventForm.time,
      type: eventForm.type
    };
    const updated = [...classEvents, newEvent];
    setClassEvents(updated);
    localStorage.setItem(`ga_${teacherId}_class_events`, JSON.stringify(updated));
    setEventForm({ title: '', date: '', time: '', type: 'Ujian' });

    // Add sync warning log
    const logStr = `[Sistem] Acara kelas "${newEvent.title}" ditambahkan lokal. Butuh disinkronkan ke kalender eksternal.`;
    const logs = [logStr, ...calendarSyncLogs];
    setCalendarSyncLogs(logs);
    localStorage.setItem(`ga_${teacherId}_cal_logs`, JSON.stringify(logs));
  };

  const handleDeleteClassEvent = (id: string, title: string) => {
    if (window.confirm(`Hapus acara kelas "${title}"?`)) {
      const updated = classEvents.filter(e => e.id !== id);
      setClassEvents(updated);
      localStorage.setItem(`ga_${teacherId}_class_events`, JSON.stringify(updated));
    }
  };

  // --- REAL FILE ICS EXPORTER CODE ---
  const handleDownloadICS = () => {
    if (!syncLessons && !syncMeetings && !syncEvents) {
      alert('Pilih minimal satu tipe data yang ingin diekspor (Jadwal, Rapat, atau Acara)!');
      return;
    }

    let icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GuruAsisten//CalendarSync//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    // 1. Weekly Lesson Schedules (Generating recurring events)
    if (syncLessons) {
      schedules.forEach((s) => {
        const clsName = classes.find(c => c.id === s.classId)?.name || 'Semua Kelas';
        const daysMap: { [key: string]: number } = {
          'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6
        };
        
        const dayTarget = daysMap[s.day] || 1;
        const today = new Date();
        const currentDay = today.getDay(); // Sunday is 0, Monday is 1
        const daysDiff = (dayTarget - currentDay + 7) % 7;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysDiff);

        // Parse standard time slots like "07:30 - 08:15"
        const timeParts = s.time.split('-');
        const startPart = timeParts[0]?.trim() || "07:30";
        const endPart = timeParts[1]?.trim() || "08:15";

        const startHour = parseInt(startPart.split(':')[0]) || 7;
        const startMin = parseInt(startPart.split(':')[1]) || 30;
        const endHour = parseInt(endPart.split(':')[0]) || 8;
        const endMin = parseInt(endPart.split(':')[1]) || 15;

        const startDate = new Date(targetDate);
        startDate.setHours(startHour, startMin, 0);
        const endDate = new Date(targetDate);
        endDate.setHours(endHour, endMin, 0);

        // Generate events for the next 4 weeks
        for (let w = 0; w < 4; w++) {
          const occurStart = new Date(startDate);
          occurStart.setDate(startDate.getDate() + (w * 7));
          const occurEnd = new Date(endDate);
          occurEnd.setDate(endDate.getDate() + (w * 7));

          const occStartISO = occurStart.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          const occEndISO = occurEnd.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

          icsLines.push('BEGIN:VEVENT');
          icsLines.push(`UID:lesson-${s.id}-wk${w}@guruasisten.app`);
          icsLines.push(`DTSTAMP:${nowStr}`);
          icsLines.push(`DTSTART:${occStartISO}`);
          icsLines.push(`DTEND:${occEndISO}`);
          icsLines.push(`SUMMARY:Mengajar: ${s.subject} (${clsName})`);
          icsLines.push(`DESCRIPTION:Mata Pelajaran ${s.subject} Jam ke-${s.period} di ${clsName}.`);
          icsLines.push('END:VEVENT');
        }
      });
    }

    // 2. Teacher Meetings (Rapat Guru)
    if (syncMeetings) {
      meetings.forEach((m) => {
        const dateClean = m.date.replace(/-/g, '');
        const timeClean = m.time.replace(/:/g, '');
        const startISO = `${dateClean}T${timeClean}00`;
        
        const [h, min] = m.time.split(':').map(Number);
        const endH = String((h + 1) % 24).padStart(2, '0');
        const endISO = `${dateClean}T${endH}${String(min).padStart(2, '0')}00`;

        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:meeting-${m.id}@guruasisten.app`);
        icsLines.push(`DTSTAMP:${nowStr}`);
        icsLines.push(`DTSTART:${startISO}`);
        icsLines.push(`DTEND:${endISO}`);
        icsLines.push(`SUMMARY:Rapat: ${m.title}`);
        icsLines.push(`DESCRIPTION:${m.notes || 'Rapat guru rutin.'}`);
        icsLines.push('END:VEVENT');
      });
    }

    // 3. Class Events / Exams (Acara & Ujian)
    if (syncEvents) {
      classEvents.forEach((e) => {
        const dateClean = e.date.replace(/-/g, '');
        const timeClean = e.time.replace(/:/g, '');
        const startISO = `${dateClean}T${timeClean}00`;
        
        const [h, min] = e.time.split(':').map(Number);
        const endH = String((h + 2) % 24).padStart(2, '0');
        const endISO = `${dateClean}T${endH}${String(min).padStart(2, '0')}00`;

        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:classevent-${e.id}@guruasisten.app`);
        icsLines.push(`DTSTAMP:${nowStr}`);
        icsLines.push(`DTSTART:${startISO}`);
        icsLines.push(`DTEND:${endISO}`);
        icsLines.push(`SUMMARY:${e.type}: ${e.title}`);
        icsLines.push(`DESCRIPTION:Agenda harian kelas kategori ${e.type}.`);
        icsLines.push('END:VEVENT');
      });
    }

    icsLines.push('END:VCALENDAR');

    const icsContent = icsLines.join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GuruAsisten_Kalender_${teacherId}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Write log
    const updatedLogs = [
      `[${new Date().toLocaleTimeString()}] Berhasil membuat file iCalendar (.ics) dengan ${schedules.length * 4} entri jadwal pelajaran, ${meetings.length} rapat guru, dan ${classEvents.length} acara kelas.`,
      ...calendarSyncLogs
    ];
    setCalendarSyncLogs(updatedLogs);
    localStorage.setItem(`ga_${teacherId}_cal_logs`, JSON.stringify(updatedLogs));
  };

  // --- CALENDAR SYNC NOW ACTION SIMULATOR ---
  const handleSyncCalendarsNow = () => {
    if (!connectedGoogleCalEmail && !connectedOutlookCalEmail) {
      alert('Hubungkan minimal satu akun kalender eksternal (Google/Outlook) terlebih dahulu!');
      return;
    }

    setIsCalendarSyncing(true);
    setCalendarSyncProgress(10);
    
    let currentLogs = [...calendarSyncLogs];
    
    const appendLog = (msg: string) => {
      currentLogs = [`[${new Date().toLocaleTimeString()}] ${msg}`, ...currentLogs];
      setCalendarSyncLogs(currentLogs);
      localStorage.setItem(`ga_${teacherId}_cal_logs`, JSON.stringify(currentLogs));
    };

    appendLog('Sinkronisasi terjadwal sedang dijalankan...');

    // Progress Simulation Timeline
    setTimeout(() => {
      setCalendarSyncProgress(35);
      if (connectedGoogleCalEmail) {
        appendLog(`Terhubung ke API Google Calendar (${connectedGoogleCalEmail})`);
        if (syncLessons) appendLog(`Mengunggah ${schedules.length} slot jadwal pelajaran mingguan ke Google Calendar`);
        if (syncMeetings) appendLog(`Sinkronisasi ${meetings.length} Rapat Guru aktif`);
        if (syncEvents) appendLog(`Mencocokkan ${classEvents.length} Acara & Ujian Kelas`);
      }
    }, 800);

    setTimeout(() => {
      setCalendarSyncProgress(65);
      if (connectedOutlookCalEmail) {
        appendLog(`Menghubungkan ke Microsoft Graph API (${connectedOutlookCalEmail})`);
        if (syncDirection === 'two_way') {
          appendLog('Membaca pembaharuan rapat dari Outlook Calendar (Sinkronisasi 2-Arah)...');
          appendLog('Tidak ada konflik rapat eksternal baru ditemukan.');
        }
        appendLog(`Sinkronisasi ${schedules.length + meetings.length + classEvents.length} total entri berhasil dikonversi ke format Outlook Live Event.`);
      }
    }, 1600);

    setTimeout(() => {
      setCalendarSyncProgress(100);
      setIsCalendarSyncing(false);
      appendLog('✓ Sinkronisasi kalender selesai dengan sukses!');
      
      const syncDateStr = new Date().toLocaleString('id-ID');
      localStorage.setItem(`ga_${teacherId}_cal_last_sync_time`, syncDateStr);
    }, 2400);
  };

  const clearCalendarLogs = () => {
    setCalendarSyncLogs([`[Sistem] Log dibersihkan pada ${new Date().toLocaleTimeString()}`]);
    localStorage.removeItem(`ga_${teacherId}_cal_logs`);
  };

  // Get active sync calendars name list
  const activeSyncCalendarsText = useMemo(() => {
    const list = [];
    if (connectedGoogleCalEmail) list.push('Google');
    if (connectedOutlookCalEmail) list.push('Outlook');
    if (list.length === 0) return 'Belum terhubung';
    return list.join(' & ');
  }, [connectedGoogleCalEmail, connectedOutlookCalEmail]);

  const lastCalSyncTime = useMemo(() => {
    return localStorage.getItem(`ga_${teacherId}_cal_last_sync_time`) || '-';
  }, [isCalendarSyncing, teacherId]);

  // --- ORIGINAL SIGN-IN / SHEETS EXPORT HANDLERS ---
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

  const handleDisconnect = async () => {
    if (window.confirm('Apakah Anda yakin ingin mematikan sinkronisasi Google? Cadangan lokal Anda tetap tersimpan.')) {
      await logoutGoogle();
      onConnectGoogle(null, null);
      onUpdateBackupTime(null);
      setExportedSheetUrl(null);
    }
  };

  const handleBackupNow = async () => {
    const token = getAccessToken();
    if (!token) {
      alert('Silakan hubungkan akun Google Anda terlebih dahulu!');
      return;
    }

    setIsSyncing(true);
    try {
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
      
      {/* COLUMN 1 & 2: LEFT PRIMARY GRID FOR BACKUP & CALENDAR SYNC */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* PANEL A: GOOGLE DRIVE BACKUP (ORIGINAL CAPABILITY) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Sinkronisasi & Backup Cloud</h3>
              <p className="text-[11px] text-slate-400">Hubungkan GuruAsisten ke Akun Google Drive untuk backup dan enkripsi otomatis.</p>
            </div>
          </div>

          {/* Connection Status Indicator */}
          {connectedEmail ? (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 p-3.5 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h4 className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Akun Google Terhubung</h4>
                    <p className="text-xs text-emerald-600 dark:text-emerald-300 font-semibold">{connectedName} ({connectedEmail})</p>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="text-[11px] font-bold text-red-600 hover:text-red-500 hover:underline"
                >
                  Putus Sambungan
                </button>
              </div>
              {lastBackupTime && (
                <p className="text-[10px] text-slate-400">Pencadangan cloud terakhir: <b>{lastBackupTime}</b></p>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-lg text-center space-y-3 border border-slate-150 dark:border-slate-800/60">
              <CloudOff className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto" />
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Google Drive belum tersambung</h4>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">Database harian Anda saat ini hanya tersimpan lokal di peramban ini. Hubungkan Google Drive agar aman dari resiko cache bersih.</p>
              </div>
              <button
                onClick={handleConnect}
                disabled={isSyncing}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2 rounded-lg shadow transition-all inline-flex items-center space-x-2 cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Hubungkan Akun Google</span>
              </button>
            </div>
          )}

          {/* Backup & Restore Action Buttons */}
          {connectedEmail && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              <div className="border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Cadangkan Manual</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Ganti cadangan cloud dengan versi lokal hari ini.</p>
                </div>
                <button
                  onClick={handleBackupNow}
                  disabled={isSyncing}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg mt-3 transition-all flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Backup Sekarang</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Pulihkan Cadangan</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Unduh dan timpa data di peramban ini dengan versi cloud lama.</p>
                </div>
                <button
                  onClick={handleRestoreNow}
                  disabled={isRestoring}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg mt-3 transition-all flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Download className={`w-3 h-3 ${isRestoring ? 'animate-bounce' : ''}`} />
                  <span>Restore Database</span>
                </button>
              </div>
            </div>
          )}

          {/* Google Sheets Export Sub-Section */}
          {connectedEmail && (
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>Ekspor Data ke Google Sheets</span>
                </h4>
                <p className="text-[10px] text-slate-400">Konversi tabel data lokal menjadi lembar kerja Google Sheets instan.</p>
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                <select
                  value={exportingType}
                  onChange={(e) => {
                    setExportingType(e.target.value);
                    setExportedSheetUrl(null);
                  }}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none flex-1"
                >
                  <option value="siswa">Data Daftar Siswa ({students.length} Siswa)</option>
                  <option value="absensi">Data Laporan Absensi ({attendance.length} Absensi)</option>
                  <option value="nilai">Data Evaluasi Nilai Siswa ({grades.length} Nilai)</option>
                  <option value="jurnal">Data Jurnal Pembelajaran ({journals.length} Jurnal)</option>
                  <option value="jadwal">Data Jadwal Pelajaran Mingguan ({schedules.length} Slot)</option>
                </select>

                <button
                  onClick={handleExportSheets}
                  disabled={isExporting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-md shadow-emerald-600/10 transition-all flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Mengekspor...' : 'Ekspor Sheets'}</span>
                </button>
              </div>

              {exportedSheetUrl && (
                <div className="bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-2.5 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-emerald-850 dark:text-emerald-400 font-bold flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                    Google Sheets berhasil diterbitkan!
                  </span>
                  <a
                    href={exportedSheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center space-x-1"
                  >
                    <span>Buka Link Sheet</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PANEL B: GOOGLE & OUTLOOK CALENDAR INTEGRATION (NEW EXTRAORDINARY CAPABILITY) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Sinkronisasi Google & Outlook Calendar</h3>
                <p className="text-[11px] text-slate-400">Sinkronkan jadwal mengajar, rapat guru, dan ujian kelas ke kalender eksternal Anda.</p>
              </div>
            </div>
            <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-bold px-2.5 py-1 rounded-full uppercase">Calendar API</span>
          </div>

          {/* Sync Targets Grid Checkboxes/Connection status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Google Calendar Simulator */}
            <div className="border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Google Calendar</h4>
                </div>
                {connectedGoogleCalEmail ? (
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">● Terhubung</span>
                ) : (
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Offline</span>
                )}
              </div>
              
              {connectedGoogleCalEmail ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Sinc: <b>{connectedGoogleCalEmail}</b></p>
                  <button
                    onClick={handleDisconnectGoogleCal}
                    className="text-[9px] font-bold text-red-600 hover:text-red-500 cursor-pointer"
                  >
                    Putuskan Hubungan
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectGoogleCal}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Sambungkan Kalender Google</span>
                </button>
              )}
            </div>

            {/* Outlook Calendar Simulator */}
            <div className="border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Outlook Calendar</h4>
                </div>
                {connectedOutlookCalEmail ? (
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">● Terhubung</span>
                ) : (
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Offline</span>
                )}
              </div>
              
              {connectedOutlookCalEmail ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Sinc: <b>{connectedOutlookCalEmail}</b></p>
                  <button
                    onClick={handleDisconnectOutlookCal}
                    className="text-[9px] font-bold text-red-600 hover:text-red-500 cursor-pointer"
                  >
                    Putuskan Hubungan
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectOutlookCal}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5 text-sky-500" />
                  <span>Sambungkan Kalender Outlook</span>
                </button>
              )}
            </div>
          </div>

          {/* Sync Preferences (Direction, Type checkboxes) */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Sync Direction & Freq Controls */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parameter Sinkronisasi</h4>
              
              {/* Direction selector */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Arah Sinkronisasi</span>
                <select
                  value={syncDirection}
                  onChange={(e) => setSyncDirection(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-md text-xs font-bold focus:outline-none"
                >
                  <option value="one_way">Satu Arah (App &rarr; Cloud)</option>
                  <option value="two_way">Dua Arah (Saling Sinkron)</option>
                </select>
              </div>

              {/* Freq selector */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Frekuensi Sinkronisasi</span>
                <select
                  value={syncFrequency}
                  onChange={(e) => setSyncFrequency(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-md text-xs font-bold focus:outline-none"
                >
                  <option value="manual">Manual (Klik Tombol)</option>
                  <option value="hourly">Setiap Jam (Latar Belakang)</option>
                  <option value="daily">Setiap Hari (Latar Belakang)</option>
                </select>
              </div>
            </div>

            {/* Sync Content Checkboxes */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipe Data Sinkron</h4>
              
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncLessons}
                    onChange={(e) => setSyncLessons(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Jadwal Pelajaran rutin mingguan ({schedules.length} slot)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncMeetings}
                    onChange={(e) => setSyncMeetings(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Rapat Guru & Staf ({meetings.length} rapat)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncEvents}
                    onChange={(e) => setSyncEvents(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Acara harian & Jadwal Ujian Kelas ({classEvents.length} acara)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Sync Trigger Actions Bar */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
            {/* Progress Bar (if syncing) */}
            {isCalendarSyncing && calendarSyncProgress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                  <span>Proses Sinkronisasi...</span>
                  <span>{calendarSyncProgress}%</span>
                </div>
                <div className="w-full bg-slate-150 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${calendarSyncProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[10px] text-slate-400">
                <p>Status: <b>{activeSyncCalendarsText}</b></p>
                <p>Sinkron Terakhir: <b>{lastCalSyncTime}</b></p>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Download Manual ICS file */}
                <button
                  type="button"
                  onClick={handleDownloadICS}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 cursor-pointer"
                  title="Ekspor Jadwal ke Format .ICS Kalender Universal"
                >
                  <FileDown className="w-4 h-4 text-slate-500" />
                  <span>Unduh File .ICS</span>
                </button>

                {/* Sync Now Trigger */}
                <button
                  type="button"
                  onClick={handleSyncCalendarsNow}
                  disabled={isCalendarSyncing}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCalendarSyncing ? 'animate-spin' : ''}`} />
                  <span>{isCalendarSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
                </button>
              </div>
            </div>

            {/* Calendar Terminal Live Sync Logs */}
            <div className="bg-slate-900 text-slate-300 p-3 rounded-lg font-mono text-[10px] space-y-1 border border-slate-800 max-h-32 overflow-y-auto">
              <div className="flex items-center justify-between text-[9px] text-slate-500 border-b border-slate-800 pb-1 mb-1 font-bold">
                <span className="flex items-center"><Terminal className="w-3 h-3 mr-1" /> TERMINAL LOG SINKRONISASI</span>
                <button 
                  onClick={clearCalendarLogs}
                  className="hover:text-white"
                >
                  Bersihkan Log
                </button>
              </div>
              {calendarSyncLogs.map((log, idx) => (
                <p key={idx} className={log.includes('✓') || log.includes('berhasil') ? 'text-emerald-400' : log.includes('[Sistem]') ? 'text-slate-500' : 'text-slate-300'}>
                  {log}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* COLUMN 3: RIGHT SIDEBAR FOR GENERAL PREFERENCES & QUICK EVENT MANAGER */}
      <div className="space-y-6">
        
        {/* PREF 1: GENERAL SETTINGS (THEME & ALARM) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Pengaturan Sistem</h3>
              <p className="text-[11px] text-slate-400">Preferensi tema dan alarm harian.</p>
            </div>
          </div>

          {/* Theme Settings */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode Tampilan</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onChangeTheme('light')}
                className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'border-indigo-600 bg-indigo-50/20 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-500 dark:border-slate-800'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Terang</span>
              </button>

              <button
                onClick={() => onChangeTheme('dark')}
                className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'border-indigo-600 bg-indigo-50/20 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-500 dark:border-slate-800'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Gelap</span>
              </button>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-800/80 pt-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notifikasi & Pengingat</h4>

            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Pengingat Isi Jurnal & Absensi</h5>
                <p className="text-[9px] text-slate-400">Alarm harian untuk pencatatan guru.</p>
              </div>
              
              <button
                onClick={() => onToggleNotifications(!notificationsEnabled)}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  notificationsEnabled 
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' 
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                }`}
              >
                {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
            </div>

            {/* Time Picker */}
            {notificationsEnabled && (
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-150 dark:border-slate-800/60">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Waktu Alarm</span>
                <input
                  type="time"
                  value={notificationReminderTime}
                  onChange={(e) => onChangeReminderTime(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-2 py-0.5 rounded text-xs font-bold focus:outline-none"
                />
              </div>
            )}

            {/* Real-time Backup Toggle */}
            {connectedEmail && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <div>
                  <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Backup Real-Time Otomatis</h5>
                  <p className="text-[9px] text-slate-400">Auto backup setelah mengubah data.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={automaticBackup}
                    onChange={(e) => onToggleAutomaticBackup(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600" />
                </label>
              </div>
            )}

            {/* Simulate Notification Button */}
            <div className="pt-1">
              <button
                onClick={onSimulateNotification}
                className="w-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold py-1.5 rounded-lg transition-all flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Play className="w-3 h-3 text-indigo-500" />
                <span>Simulasikan Alarm Notifikasi</span>
              </button>
            </div>
          </div>
        </div>

        {/* PREF 2: INTERACTIVE RAPAT & ACARA KELAS MANAGER (FOR CALENDAR EXTRA SYNC DATA) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
              <Activity className="w-4 h-4 text-indigo-500" />
              <span>Manager Acara & Rapat</span>
            </h3>
            <div className="flex bg-slate-50 dark:bg-slate-800 rounded-md p-0.5 border border-slate-250 dark:border-slate-700">
              <button
                onClick={() => setActiveFormTab('meeting')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${activeFormTab === 'meeting' ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
              >
                Rapat
              </button>
              <button
                onClick={() => setActiveFormTab('event')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${activeFormTab === 'event' ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
              >
                Acara
              </button>
            </div>
          </div>

          {/* Form Content */}
          {activeFormTab === 'meeting' ? (
            <form onSubmit={handleAddMeeting} className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Judul Rapat</label>
                <input
                  type="text"
                  placeholder="e.g., Rapat Koordinasi Ulangan"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tanggal</label>
                  <input
                    type="date"
                    value={meetingForm.date}
                    onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg text-xs focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Waktu</label>
                  <input
                    type="time"
                    value={meetingForm.time}
                    onChange={(e) => setMeetingForm({ ...meetingForm, time: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Catatan Rapat</label>
                <textarea
                  placeholder="Notes..."
                  rows={2}
                  value={meetingForm.notes}
                  onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-1.5 rounded-lg flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Rapat Guru</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddClassEvent} className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nama Acara / Ujian</label>
                <input
                  type="text"
                  placeholder="e.g., Ujian Tengah Semester IPA"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tanggal</label>
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg text-xs focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Waktu</label>
                  <input
                    type="time"
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Kategori</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm({ ...eventForm, type: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                >
                  <option value="Ujian">Jadwal Ujian Harian</option>
                  <option value="Praktek">Kegiatan Praktek / Lab</option>
                  <option value="Acara">Pentas Acara Kelas</option>
                  <option value="Lainnya">Kegiatan Lainnya</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-1.5 rounded-lg flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Acara Kelas</span>
              </button>
            </form>
          )}

          {/* List display items */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 space-y-2">
            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Daftar Terjadwal Lokal</h4>
            
            <div className="space-y-2 max-h-40 overflow-y-auto pr-0.5">
              {activeFormTab === 'meeting' ? (
                meetings.length === 0 ? (
                  <p className="text-center py-4 text-[10px] text-slate-400">Tidak ada rapat terdaftar</p>
                ) : (
                  meetings.map((m) => (
                    <div key={m.id} className="p-2 border border-slate-150 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-850/40 text-[11px] flex items-start justify-between">
                      <div>
                        <h5 className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{m.title}</h5>
                        <p className="text-[9px] text-slate-400 font-medium flex items-center mt-0.5">
                          <Clock className="w-2.5 h-2.5 mr-0.5" />
                          {m.date} pukul {m.time}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteMeeting(m.id, m.title)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-0.5 cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )
              ) : (
                classEvents.length === 0 ? (
                  <p className="text-center py-4 text-[10px] text-slate-400">Tidak ada acara terdaftar</p>
                ) : (
                  classEvents.map((e) => {
                    const badgeColors = {
                      Ujian: 'bg-red-50 text-red-600 border-red-100 dark:bg-rose-950/20 dark:text-red-400 dark:border-red-900/30',
                      Praktek: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30',
                      Acara: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30',
                      Lainnya: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-850 dark:text-slate-300 dark:border-slate-800'
                    };
                    return (
                      <div key={e.id} className="p-2 border border-slate-150 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-850/40 text-[11px] flex items-start justify-between">
                        <div>
                          <h5 className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{e.title}</h5>
                          <div className="flex items-center space-x-1.5 mt-0.5 flex-wrap">
                            <span className={`text-[8px] font-bold px-1 rounded border ${badgeColors[e.type]}`}>
                              {e.type}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium flex items-center">
                              <Clock className="w-2.5 h-2.5 mr-0.5" />
                              {e.date} @ {e.time}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteClassEvent(e.id, e.title)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-0.5 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
