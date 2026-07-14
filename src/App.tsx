/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Teacher, 
  Student, 
  SchoolClass, 
  Attendance, 
  Grade, 
  LearningJournal, 
  Schedule 
} from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import { initAuth, getAccessToken, logoutGoogle } from './firebase';
import { saveBackupToDrive } from './googleDrive';

// Seed initial helper data for empty teacher accounts
const getInitialClasses = (): SchoolClass[] => [
  { id: 'c1', name: 'Kelas VII-A' },
  { id: 'c2', name: 'Kelas VIII-B' },
  { id: 'c3', name: 'Kelas IX-C' },
];

const getInitialStudents = (): Student[] => [
  // Kelas VII-A
  { id: 's1', name: 'Aditya Pratama', nisn: '0098712341', gender: 'L', classId: 'c1' },
  { id: 's2', name: 'Budi Santoso', nisn: '0098712342', gender: 'L', classId: 'c1' },
  { id: 's3', name: 'Citra Kirana', nisn: '0098712343', gender: 'P', classId: 'c1' },
  { id: 's4', name: 'Dewi Lestari', nisn: '0098712344', gender: 'P', classId: 'c1' },
  { id: 's5', name: 'Eko Prasetyo', nisn: '0098712345', gender: 'L', classId: 'c1' },
  // Kelas VIII-B
  { id: 's6', name: 'Fajar Nugraha', nisn: '0087612346', gender: 'L', classId: 'c2' },
  { id: 's7', name: 'Gita Lestari', nisn: '0087612347', gender: 'P', classId: 'c2' },
  { id: 's8', name: 'Hadi Wijaya', nisn: '0087612348', gender: 'L', classId: 'c2' },
  { id: 's9', name: 'Indah Permata', nisn: '0087612349', gender: 'P', classId: 'c2' },
  // Kelas IX-C
  { id: 's10', name: 'Kartini Putri', nisn: '0076512350', gender: 'P', classId: 'c3' },
  { id: 's11', name: 'Muhammad Rizky', nisn: '0076512351', gender: 'L', classId: 'c3' },
  { id: 's12', name: 'Nadia Safitri', nisn: '0076512352', gender: 'P', classId: 'c3' },
];

const getInitialSchedules = (): Schedule[] => [
  { id: 'sc1', classId: 'c1', day: 'Senin', period: 1, time: '07:30 - 08:15', subject: 'Matematika' },
  { id: 'sc2', classId: 'c1', day: 'Senin', period: 2, time: '08:15 - 09:00', subject: 'Matematika' },
  { id: 'sc3', classId: 'c1', day: 'Selasa', period: 3, time: '09:00 - 09:45', subject: 'IPA' },
  { id: 'sc4', classId: 'c1', day: 'Rabu', period: 1, time: '07:30 - 08:15', subject: 'Bahasa Indonesia' },
  { id: 'sc5', classId: 'c2', day: 'Senin', period: 3, time: '09:00 - 09:45', subject: 'Bahasa Inggris' },
  { id: 'sc6', classId: 'c3', day: 'Kamis', period: 4, time: '10:15 - 11:00', subject: 'Pendidikan Pancasila' },
];

const getInitialJournals = (): LearningJournal[] => [
  { 
    id: 'j1', 
    date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], 
    classId: 'c1', 
    subject: 'Matematika', 
    topic: 'Pengenalan Aljabar Linier Dasar', 
    activities: 'Menjelaskan variabel x dan y menggunakan visualisasi buah-buahan di papan tulis harian.', 
    achievement: '90% siswa memahami cara menyederhanakan ekspresi aljabar sederhana.' 
  },
  { 
    id: 'j2', 
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0], 
    classId: 'c2', 
    subject: 'IPA', 
    topic: 'Struktur Sel Hewan dan Sel Tumbuhan', 
    activities: 'Siswa mengamati preparat mikroskop di lab IPA sekolah dan menggambar di buku jurnal harian.', 
    achievement: 'Siswa dapat membedakan dinding sel dan membran sel secara cepat.' 
  }
];

const getInitialGrades = (): Grade[] => [
  { id: 'g1', studentId: 's1', subject: 'Matematika', type: 'Ulangan', score: 85, date: new Date().toISOString().split('T')[0], notes: 'Ulangan Harian Bab 1' },
  { id: 'g2', studentId: 's2', subject: 'Matematika', type: 'Ulangan', score: 76, date: new Date().toISOString().split('T')[0], notes: 'Ulangan Harian Bab 1' },
  { id: 'g3', studentId: 's3', subject: 'Matematika', type: 'Ulangan', score: 92, date: new Date().toISOString().split('T')[0], notes: 'Ulangan Harian Bab 1' },
];

export default function App() {
  // Authentication states
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  
  // Google Workspace state cache
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  // Teacher databases
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [journals, setJournals] = useState<LearningJournal[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // Preferences
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [notificationReminderTime, setNotificationReminderTime] = useState<string>('14:00');
  const [automaticBackup, setAutomaticBackup] = useState<boolean>(true);

  // Simulated push alarm popup trigger
  const [showSimulatedToast, setShowSimulatedToast] = useState(false);
  const toastShownToday = useRef<string | null>(null);

  // Initialize and load teacher accounts
  useEffect(() => {
    // Check local preferences
    const savedTheme = localStorage.getItem('guruasisten_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme('light');
    }

    // Load registered teacher accounts
    const savedTeachers = localStorage.getItem('guruasisten_teachers');
    if (savedTeachers) {
      setTeachers(JSON.parse(savedTeachers));
    }

    // Load active session teacher
    const sessionTeacher = sessionStorage.getItem('guruasisten_active_teacher');
    if (sessionTeacher) {
      const parsed = JSON.parse(sessionTeacher) as Teacher;
      setCurrentTeacher(parsed);
      loadTeacherDatabase(parsed.id);
    }

    // Check Google Auth Status (cached tokens)
    initAuth(
      (user) => {
        setConnectedEmail(user.email);
        setConnectedName(user.displayName);
      },
      () => {
        setConnectedEmail(null);
        setConnectedName(null);
      }
    );
  }, []);

  // Theme observer
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('guruasisten_theme', theme);
  }, [theme]);

  // Periodic Reminder Notification Checker
  useEffect(() => {
    const interval = setInterval(() => {
      if (!notificationsEnabled) return;
      
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMins = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${currentHours}:${currentMins}`;
      const todayStr = now.toDateString();

      // If time matches preference and we haven't shown it today
      if (timeStr === notificationReminderTime && toastShownToday.current !== todayStr) {
        toastShownToday.current = todayStr;
        setShowSimulatedToast(true);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [notificationsEnabled, notificationReminderTime]);

  // Load teacher-specific database tables
  const loadTeacherDatabase = (teacherId: string) => {
    const getOrSeed = <T,>(key: string, seeder: () => T[]): T[] => {
      const stored = localStorage.getItem(`ga_${teacherId}_${key}`);
      if (stored) {
        return JSON.parse(stored);
      } else {
        const initial = seeder();
        localStorage.setItem(`ga_${teacherId}_${key}`, JSON.stringify(initial));
        return initial;
      }
    };

    setClasses(getOrSeed('classes', getInitialClasses));
    setStudents(getOrSeed('students', getInitialStudents));
    setSchedules(getOrSeed('schedules', getInitialSchedules));
    setJournals(getOrSeed('journals', getInitialJournals));
    setGrades(getOrSeed('grades', getInitialGrades));
    
    // Attendance is empty by default
    const savedAttendance = localStorage.getItem(`ga_${teacherId}_attendance`);
    setAttendance(savedAttendance ? JSON.parse(savedAttendance) : []);

    // Load sync/backup preferences
    const savedAutoBackup = localStorage.getItem(`ga_${teacherId}_pref_autobackup`);
    setAutomaticBackup(savedAutoBackup ? JSON.parse(savedAutoBackup) : true);

    const savedLastBackup = localStorage.getItem(`ga_${teacherId}_last_backup_time`);
    setLastBackupTime(savedLastBackup);

    const savedReminder = localStorage.getItem(`ga_${teacherId}_pref_reminder_time`);
    if (savedReminder) setNotificationReminderTime(savedReminder);
  };

  // Helper to persist database changes locally and trigger automatic encrypted cloud backup if enabled
  const persistAndBackup = async (
    key: 'classes' | 'students' | 'attendance' | 'grades' | 'journals' | 'schedules',
    newData: any,
    targetTeacherId = currentTeacher?.id
  ) => {
    if (!targetTeacherId) return;

    // Save to LocalStorage
    localStorage.setItem(`ga_${targetTeacherId}_${key}`, JSON.stringify(newData));

    // Update state
    if (key === 'classes') setClasses(newData);
    if (key === 'students') setStudents(newData);
    if (key === 'attendance') setAttendance(newData);
    if (key === 'grades') setGrades(newData);
    if (key === 'journals') setJournals(newData);
    if (key === 'schedules') setSchedules(newData);

    // Silent background auto backup to Google Drive
    const token = getAccessToken();
    if (automaticBackup && token && connectedEmail) {
      try {
        // Retrieve fresh snapshot from localStorage to avoid stale state references
        const fullDb = {
          classes: key === 'classes' ? newData : JSON.parse(localStorage.getItem(`ga_${targetTeacherId}_classes`) || '[]'),
          students: key === 'students' ? newData : JSON.parse(localStorage.getItem(`ga_${targetTeacherId}_students`) || '[]'),
          attendance: key === 'attendance' ? newData : JSON.parse(localStorage.getItem(`ga_${targetTeacherId}_attendance`) || '[]'),
          grades: key === 'grades' ? newData : JSON.parse(localStorage.getItem(`ga_${targetTeacherId}_grades`) || '[]'),
          journals: key === 'journals' ? newData : JSON.parse(localStorage.getItem(`ga_${targetTeacherId}_journals`) || '[]'),
          schedules: key === 'schedules' ? newData : JSON.parse(localStorage.getItem(`ga_${targetTeacherId}_schedules`) || '[]'),
        };

        await saveBackupToDrive(token, JSON.stringify(fullDb));
        const backupTime = new Date().toLocaleString('id-ID');
        localStorage.setItem(`ga_${targetTeacherId}_last_backup_time`, backupTime);
        setLastBackupTime(backupTime);
        console.log('Background silent real-time cloud backup completed successfully.');
      } catch (err) {
        console.warn('Real-time backup failed in background:', err);
      }
    }
  };

  // Profile Management Mutations
  const handleSelectTeacher = (teacher: Teacher) => {
    const updated = { ...teacher, lastLoggedIn: new Date().toLocaleString('id-ID') };
    const updatedList = teachers.map(t => t.id === teacher.id ? updated : t);
    
    setTeachers(updatedList);
    localStorage.setItem('guruasisten_teachers', JSON.stringify(updatedList));

    setCurrentTeacher(updated);
    sessionStorage.setItem('guruasisten_active_teacher', JSON.stringify(updated));
    loadTeacherDatabase(teacher.id);
  };

  const handleAddTeacher = (name: string, color: string) => {
    const newTeacher: Teacher = {
      id: 't_' + Date.now(),
      name,
      avatarColor: color,
    };
    const updated = [...teachers, newTeacher];
    setTeachers(updated);
    localStorage.setItem('guruasisten_teachers', JSON.stringify(updated));
  };

  const handleEditTeacher = (teacher: Teacher) => {
    const updated = teachers.map(t => t.id === teacher.id ? teacher : t);
    setTeachers(updated);
    localStorage.setItem('guruasisten_teachers', JSON.stringify(updated));

    if (currentTeacher?.id === teacher.id) {
      setCurrentTeacher(teacher);
      sessionStorage.setItem('guruasisten_active_teacher', JSON.stringify(teacher));
    }
  };

  const handleDeleteTeacher = (id: string) => {
    const updated = teachers.filter(t => t.id !== id);
    setTeachers(updated);
    localStorage.setItem('guruasisten_teachers', JSON.stringify(updated));

    // Cleanup keys
    const tables = ['classes', 'students', 'attendance', 'grades', 'journals', 'schedules', 'pref_autobackup', 'last_backup_time', 'pref_reminder_time'];
    tables.forEach(table => localStorage.removeItem(`ga_${id}_${table}`));

    if (currentTeacher?.id === id) {
      handleLogout();
    }
  };

  const handleLogout = () => {
    setCurrentTeacher(null);
    sessionStorage.removeItem('guruasisten_active_teacher');
    // Keep Google session intact, but clear state caches
    setClasses([]);
    setStudents([]);
    setAttendance([]);
    setGrades([]);
    setJournals([]);
    setSchedules([]);
  };

  // Database Mutations (Student)
  const handleAddStudent = (student: Omit<Student, 'id'>) => {
    const newStudent = { ...student, id: 's_' + Date.now() };
    persistAndBackup('students', [...students, newStudent]);
  };

  const handleEditStudent = (student: Student) => {
    persistAndBackup('students', students.map(s => s.id === student.id ? student : s));
  };

  const handleDeleteStudent = (id: string) => {
    persistAndBackup('students', students.filter(s => s.id !== id));
    // Cascade delete student's grades and attendance
    persistAndBackup('grades', grades.filter(g => g.studentId !== id));
    persistAndBackup('attendance', attendance.filter(a => a.studentId !== id));
  };

  // Database Mutations (Attendance)
  const handleSaveAttendance = (records: Omit<Attendance, 'id'>[]) => {
    const updated = [...attendance];
    
    records.forEach(rec => {
      // Find if student attendance on this date already exists
      const existingIdx = updated.findIndex(a => a.studentId === rec.studentId && a.date === rec.date);
      if (existingIdx !== -1) {
        updated[existingIdx] = { ...updated[existingIdx], ...rec };
      } else {
        updated.push({ ...rec, id: 'att_' + Math.random().toString(36).substr(2, 9) });
      }
    });

    persistAndBackup('attendance', updated);
  };

  // CSV Students Importer
  const handleImportCSV = (csvText: string, classId: string) => {
    try {
      const lines = csvText.split('\n');
      const newStudents: Student[] = [];

      lines.forEach(line => {
        if (!line.trim()) return;
        const cols = line.split(',');
        const name = cols[0]?.trim();
        const nisn = cols[1]?.trim() || '';
        const gender = (cols[2]?.trim().toUpperCase() === 'P' ? 'P' : 'L');

        if (name && name.toLowerCase() !== 'nama' && name.toLowerCase() !== 'nama siswa') {
          newStudents.push({
            id: 's_' + Math.random().toString(36).substr(2, 9),
            name,
            nisn,
            gender,
            classId,
          });
        }
      });

      if (newStudents.length > 0) {
        persistAndBackup('students', [...students, ...newStudents]);
        alert(`Berhasil mengimpor ${newStudents.length} siswa baru dari CSV ke kelas!`);
      } else {
        alert('Format CSV tidak sesuai atau data kosong. Gunakan format: Nama Siswa, NISN, Jenis Kelamin');
      }
    } catch (err) {
      alert('Gagal membaca file CSV. Pastikan file dalam pengodean teks murni.');
    }
  };

  // Database Mutations (Grade)
  const handleAddGrade = (grade: Omit<Grade, 'id'>) => {
    const newGrade = { ...grade, id: 'g_' + Date.now() };
    persistAndBackup('grades', [...grades, newGrade]);
  };

  const handleEditGrade = (grade: Grade) => {
    persistAndBackup('grades', grades.map(g => g.id === grade.id ? grade : g));
  };

  const handleDeleteGrade = (id: string) => {
    persistAndBackup('grades', grades.filter(g => g.id !== id));
  };

  const handleBulkAddGrades = (bulkGrades: Omit<Grade, 'id'>[]) => {
    const newGrades = bulkGrades.map((g, i) => ({
      ...g,
      id: 'g_' + (Date.now() + i)
    }));
    persistAndBackup('grades', [...grades, ...newGrades]);
  };

  // Database Mutations (Journal)
  const handleAddJournal = (journal: Omit<LearningJournal, 'id'>) => {
    const newJournal = { ...journal, id: 'j_' + Date.now() };
    persistAndBackup('journals', [...journals, newJournal]);
  };

  const handleEditJournal = (journal: LearningJournal) => {
    persistAndBackup('journals', journals.map(j => j.id === journal.id ? journal : j));
  };

  const handleDeleteJournal = (id: string) => {
    persistAndBackup('journals', journals.filter(j => j.id !== id));
  };

  // Database Mutations (Schedule)
  const handleAddScheduleSlot = (slot: Omit<Schedule, 'id'>) => {
    const newSlot = { ...slot, id: 'sc_' + Date.now() };
    persistAndBackup('schedules', [...schedules, newSlot]);
  };

  const handleEditScheduleSlot = (slot: Schedule) => {
    persistAndBackup('schedules', schedules.map(s => s.id === slot.id ? slot : s));
  };

  const handleDeleteScheduleSlot = (id: string) => {
    persistAndBackup('schedules', schedules.filter(s => s.id !== id));
  };

  const handleOverwriteSchedules = (newSchedules: Schedule[]) => {
    persistAndBackup('schedules', newSchedules);
  };

  // Cloud backup full DB override restore handler
  const handleRestoreDatabase = (db: any) => {
    if (!currentTeacher) return;
    const teacherId = currentTeacher.id;

    if (db.classes) persistAndBackup('classes', db.classes, teacherId);
    if (db.students) persistAndBackup('students', db.students, teacherId);
    if (db.attendance) persistAndBackup('attendance', db.attendance, teacherId);
    if (db.grades) persistAndBackup('grades', db.grades, teacherId);
    if (db.journals) persistAndBackup('journals', db.journals, teacherId);
    if (db.schedules) persistAndBackup('schedules', db.schedules, teacherId);
  };

  return (
    <div className="w-full min-h-screen">
      {currentTeacher ? (
        <Dashboard
          currentTeacher={currentTeacher}
          onLogout={handleLogout}
          students={students}
          classes={classes}
          attendance={attendance}
          grades={grades}
          journals={journals}
          schedules={schedules}
          onAddStudent={handleAddStudent}
          onEditStudent={handleEditStudent}
          onDeleteStudent={handleDeleteStudent}
          onSaveAttendance={handleSaveAttendance}
          onImportStudentsCSV={handleImportCSV}
          onAddGrade={handleAddGrade}
          onEditGrade={handleEditGrade}
          onDeleteGrade={handleDeleteGrade}
          onBulkAddGrades={handleBulkAddGrades}
          onAddJournal={handleAddJournal}
          onEditJournal={handleEditJournal}
          onDeleteJournal={handleDeleteJournal}
          onAddScheduleSlot={handleAddScheduleSlot}
          onEditScheduleSlot={handleEditScheduleSlot}
          onDeleteScheduleSlot={handleDeleteScheduleSlot}
          onOverwriteSchedules={handleOverwriteSchedules}
          onRestoreDatabase={handleRestoreDatabase}
          theme={theme}
          onChangeTheme={setTheme}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={setNotificationsEnabled}
          notificationReminderTime={notificationReminderTime}
          onChangeReminderTime={(time) => {
            setNotificationReminderTime(time);
            if (currentTeacher) {
              localStorage.setItem(`ga_${currentTeacher.id}_pref_reminder_time`, time);
            }
          }}
          automaticBackup={automaticBackup}
          onToggleAutomaticBackup={(val) => {
            setAutomaticBackup(val);
            if (currentTeacher) {
              localStorage.setItem(`ga_${currentTeacher.id}_pref_autobackup`, JSON.stringify(val));
            }
          }}
          connectedEmail={connectedEmail}
          connectedName={connectedName}
          onConnectGoogle={(email, name) => {
            setConnectedEmail(email);
            setConnectedName(name);
          }}
          lastBackupTime={lastBackupTime}
          onUpdateBackupTime={(time) => {
            setLastBackupTime(time);
            if (currentTeacher) {
              if (time) {
                localStorage.setItem(`ga_${currentTeacher.id}_last_backup_time`, time);
              } else {
                localStorage.removeItem(`ga_${currentTeacher.id}_last_backup_time`);
              }
            }
          }}
          showSimulatedToast={showSimulatedToast}
          onDismissToast={() => setShowSimulatedToast(false)}
          onTriggerSimulation={() => setShowSimulatedToast(true)}
        />
      ) : (
        <LoginScreen
          teachers={teachers}
          onSelectTeacher={handleSelectTeacher}
          onAddTeacher={handleAddTeacher}
          onEditTeacher={handleEditTeacher}
          onDeleteTeacher={handleDeleteTeacher}
        />
      )}
    </div>
  );
}
