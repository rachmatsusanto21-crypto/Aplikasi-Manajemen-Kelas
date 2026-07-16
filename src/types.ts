/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Teacher {
  id: string;
  name: string;
  avatarColor: string;
  email: string;
  lastLoggedIn?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P'; // Laki-laki / Perempuan
  classId: string;
}

export interface Attendance {
  id: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  status: 'H' | 'I' | 'S' | 'A'; // Hadir, Izin, Sakit, Alpa
  notes: string;
}

export interface Grade {
  id: string;
  studentId: string;
  subject: string;
  type: 'Tugas' | 'Ulangan' | 'UTS' | 'UAS';
  score: number;
  date: string; // YYYY-MM-DD
  notes: string;
}

export interface LearningJournal {
  id: string;
  date: string; // YYYY-MM-DD
  classId: string;
  subject: string;
  topic: string;
  activities: string;
  achievement: string;
}

export interface Schedule {
  id: string;
  day: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  period: number; // Jam ke-1, ke-2, dst.
  time: string; // e.g., "07:30 - 08:05"
  subject: string;
  classId: string;
}

export interface DisciplineRecord {
  id: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  classId: string;
  violationType: string; // Jenis Pelanggaran
  correctiveAction: string; // Tindakan Korektif (auto populated)
  recurringSanction: string; // Sanksi Pelanggaran Berulang (auto-populated if repeat counts > 2)
  notes: string; // Catatan tambahan
}

export interface CurriculumColumn {
  id: string;
  name: string;
}

export interface CurriculumRow {
  id: string;
  [key: string]: any;
}

export interface CurriculumData {
  columns: CurriculumColumn[];
  rows: CurriculumRow[];
}

export interface AppState {
  teachers: Teacher[];
  currentTeacher: Teacher | null;
  classes: SchoolClass[];
  students: Student[];
  attendance: Attendance[];
  grades: Grade[];
  journals: LearningJournal[];
  schedules: Schedule[];
  disciplineRecords?: DisciplineRecord[];
  curriculum?: CurriculumData;
  theme: 'light' | 'dark';
  connectedGoogleEmail: string | null;
  connectedGoogleName: string | null;
  lastBackupTime: string | null;
  automaticBackup: boolean;
  notificationsEnabled: boolean;
  notificationReminderTime: string; // "14:00" for example
}
