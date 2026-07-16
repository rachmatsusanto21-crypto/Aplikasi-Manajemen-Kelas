/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Teacher, 
  Student, 
  SchoolClass, 
  Attendance, 
  Grade, 
  LearningJournal, 
  Schedule,
  DisciplineRecord,
  CurriculumData
} from '../types';
import StatsTab from './StatsTab';
import AttendanceTab from './AttendanceTab';
import GradesTab from './GradesTab';
import JournalTab from './JournalTab';
import ScheduleTab from './ScheduleTab';
import DisciplineTab from './DisciplineTab';
import CurriculumTab from './CurriculumTab';
import GoogleSync from './GoogleSync';
import { 
  Users, 
  Calendar, 
  BookOpen, 
  Award, 
  Settings, 
  LogOut, 
  Bell, 
  Menu, 
  X, 
  ChevronRight, 
  Clock, 
  LayoutDashboard, 
  CloudCheck,
  CheckSquare,
  AlertCircle,
  Sun,
  Moon,
  Table
} from 'lucide-react';

interface DashboardProps {
  currentTeacher: Teacher;
  onLogout: () => void;
  
  // Database state
  students: Student[];
  classes: SchoolClass[];
  attendance: Attendance[];
  grades: Grade[];
  journals: LearningJournal[];
  schedules: Schedule[];
  disciplineRecords: DisciplineRecord[];
  curriculum: CurriculumData;
  onUpdateCurriculum: (data: CurriculumData) => void;

  // Database mutations
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onAddClass: (name: string) => void;
  onEditClass: (classObj: SchoolClass) => void;
  onDeleteClass: (id: string) => void;
  onSaveAttendance: (records: Omit<Attendance, 'id'>[]) => void;
  onImportStudentsCSV: (csvText: string, classId: string) => void;

  onAddGrade: (grade: Omit<Grade, 'id'>) => void;
  onEditGrade: (grade: Grade) => void;
  onDeleteGrade: (id: string) => void;
  onBulkAddGrades: (grades: Omit<Grade, 'id'>[]) => void;
  onOverwriteGrades: (grades: Grade[]) => void;

  onAddJournal: (journal: Omit<LearningJournal, 'id'>) => void;
  onEditJournal: (journal: LearningJournal) => void;
  onDeleteJournal: (id: string) => void;
  onOverwriteJournals: (journals: LearningJournal[]) => void;

  onAddScheduleSlot: (slot: Omit<Schedule, 'id'>) => void;
  onEditScheduleSlot: (slot: Schedule) => void;
  onDeleteScheduleSlot: (id: string) => void;
  onOverwriteSchedules: (schedules: Schedule[]) => void;
  onAddDisciplineRecord: (record: Omit<DisciplineRecord, 'id'>) => void;
  onEditDisciplineRecord: (record: DisciplineRecord) => void;
  onDeleteDisciplineRecord: (id: string) => void;
  onOverwriteDisciplineRecords: (records: DisciplineRecord[]) => void;
  onRestoreDatabase: (db: any) => void;

  // Preferences
  theme: 'light' | 'dark';
  onChangeTheme: (theme: 'light' | 'dark') => void;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  notificationReminderTime: string;
  onChangeReminderTime: (time: string) => void;
  automaticBackup: boolean;
  onToggleAutomaticBackup: (enabled: boolean) => void;

  // Google Connection
  connectedEmail: string | null;
  connectedName: string | null;
  onConnectGoogle: (email: string | null, name: string | null) => void;
  lastBackupTime: string | null;
  onUpdateBackupTime: (time: string | null) => void;

  // Simulated push notification trigger
  showSimulatedToast: boolean;
  onDismissToast: () => void;
  onTriggerSimulation: () => void;

  kkm: number;
  onUpdateKkm: (value: number) => void;
}

export default function Dashboard({
  currentTeacher,
  onLogout,
  students,
  classes,
  attendance,
  grades,
  journals,
  schedules,
  disciplineRecords,
  curriculum,
  onUpdateCurriculum,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onAddClass,
  onEditClass,
  onDeleteClass,
  onSaveAttendance,
  onImportStudentsCSV,
  onAddGrade,
  onEditGrade,
  onDeleteGrade,
  onBulkAddGrades,
  onOverwriteGrades,
  onAddJournal,
  onEditJournal,
  onDeleteJournal,
  onOverwriteJournals,
  onAddScheduleSlot,
  onEditScheduleSlot,
  onDeleteScheduleSlot,
  onOverwriteSchedules,
  onAddDisciplineRecord,
  onEditDisciplineRecord,
  onDeleteDisciplineRecord,
  onOverwriteDisciplineRecords,
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
  showSimulatedToast,
  onDismissToast,
  onTriggerSimulation,
  kkm,
  onUpdateKkm,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'grades' | 'journal' | 'schedules' | 'discipline' | 'curriculum' | 'settings'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  // Get current day name in Indonesian
  const currentDayIndo = useMemo(() => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const today = new Date().getDay();
    return days[today] as any;
  }, []);

  // Today's lessons list
  const todayLessons = useMemo(() => {
    return schedules.filter(s => s.day === currentDayIndo).sort((a, b) => a.period - b.period);
  }, [schedules, currentDayIndo]);

  // Automated notification items for the teacher
  const systemNotifications = useMemo(() => {
    const list: { id: string; title: string; desc: string; type: 'info' | 'warning' | 'success' }[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Check if attendance was taken today
    const takenToday = attendance.some(a => a.date === todayStr);
    if (!takenToday) {
      list.push({
        id: 'absensi_missing',
        title: 'Absensi Siswa Belum Diisi',
        desc: 'Anda belum mencatat absensi siswa untuk hari ini. Silakan catat agar data tersinkronisasi.',
        type: 'warning',
      });
    }

    // 2. Check if teaching journal was filled today
    const journalToday = journals.some(j => j.date === todayStr);
    if (!journalToday) {
      list.push({
        id: 'jurnal_missing',
        title: 'Jurnal Pembelajaran Belum Diisi',
        desc: 'Jangan lupa untuk mendokumentasikan topik pembelajaran hari ini di menu Jurnal Harian.',
        type: 'info',
      });
    }

    // 3. Lessons reminders based on schedules
    if (todayLessons.length > 0) {
      list.push({
        id: 'jadwal_reminder',
        title: `Jadwal Hari Ini: ${currentDayIndo}`,
        desc: `Anda memiliki ${todayLessons.length} jam mata pelajaran untuk diajar hari ini.`,
        type: 'success',
      });
    } else {
      list.push({
        id: 'jadwal_empty',
        title: 'Tidak Ada Jadwal Hari Ini',
        desc: 'Hari ini tidak ada jadwal mengajar rutin di sistem kelas Anda.',
        type: 'info',
      });
    }

    return list;
  }, [attendance, journals, todayLessons, currentDayIndo]);

  const menuItems = [
    { id: 'overview', name: 'Statistik & Ringkasan', icon: LayoutDashboard },
    { id: 'attendance', name: 'Absensi Siswa', icon: Users },
    { id: 'grades', name: 'Nilai Siswa', icon: Award },
    { id: 'journal', name: 'Jurnal Harian', icon: BookOpen },
    { id: 'schedules', name: 'Jadwal Pelajaran', icon: Calendar },
    { id: 'curriculum', name: 'Kurikulum', icon: Table },
    { id: 'discipline', name: 'Pelanggaran Disiplin', icon: AlertCircle },
    { id: 'settings', name: 'Google Sync & Sistem', icon: Settings },
  ];

  const handleTabChange = (tabId: any) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-all">
      
      {/* SIDEBAR - DESKTOP */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800/80 flex-shrink-0">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/10">GA</div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">GuruAsisten Pro</h1>
              <p className="text-[10px] text-slate-400">v2.4 • Sync Active</p>
            </div>
          </div>
          
          {/* User Switcher / Login Section */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider">Current User</span>
              <button 
                onClick={onLogout}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 rounded text-[10px] transition-all" 
                title="Keluar"
              >
                ✕
              </button>
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{currentTeacher.name}</p>
            <div className="flex items-center mt-1.5 justify-between">
              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                Online
              </span>
              <button 
                onClick={onLogout}
                className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-wider"
              >
                Ganti User
              </button>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Main Menu</div>
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400">
          {connectedEmail && (
            <p className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1" />
              Connected to Drive
            </p>
          )}
          <p>© 2026 GuruAsisten App</p>
        </div>
      </aside>

      {/* MOBILE SIDEBAR DRAWER */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Overlay */}
          <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          
          <aside className="relative flex flex-col w-64 max-w-xs bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-5 space-y-4 animate-slide-in-left z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-lg shadow-indigo-600/10">GA</div>
                <span className="font-bold text-xs text-slate-850 dark:text-white">GuruAsisten Pro</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
 
            {/* User */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider">Current User</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{currentTeacher.name}</p>
              <div className="flex items-center mt-1 justify-between">
                <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Online
                </span>
              </div>
            </div>
 
            <nav className="space-y-1 flex-1 overflow-y-auto">
              {menuItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
 
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onLogout();
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md"
            >
              <LogOut className="w-4.5 h-4.5" />
              <span>Keluar</span>
            </button>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* HEADER NAVBAR */}
        <header className="sticky top-0 bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80 z-40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                {menuItems.find(item => item.id === activeTab)?.name}
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            {/* Theme Toggle Button */}
            <button
              onClick={() => onChangeTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-700/80 rounded-2xl transition-all flex items-center justify-center text-slate-600 hover:text-indigo-600 dark:text-slate-350 dark:hover:text-indigo-400 cursor-pointer"
              title={theme === 'light' ? 'Aktifkan Mode Gelap' : 'Aktifkan Mode Terang'}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400" />
              )}
            </button>

            {/* System Notification bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsDrawer(!showNotificationsDrawer)}
                className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-750 rounded-2xl transition-all"
              >
                <Bell className="w-5 h-5" />
                {systemNotifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600" />
                )}
              </button>

              {/* Notification dropdown drawer */}
              {showNotificationsDrawer && (
                <div className="absolute right-0 mt-3.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-2xl rounded-3xl w-80 p-4 space-y-4 z-50">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-700/50">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Notifikasi Asisten Guru</span>
                    <button onClick={() => setShowNotificationsDrawer(false)} className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {systemNotifications.map((notif) => {
                      const colors = {
                        info: 'bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30 text-blue-800 dark:text-blue-400',
                        warning: 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 text-amber-800 dark:text-amber-400',
                        success: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400'
                      };
                      return (
                        <div key={notif.id} className={`p-3 rounded-2xl border text-[11px] leading-relaxed space-y-1 ${colors[notif.type]}`}>
                          <div className="flex items-center font-bold">
                            <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                            <span>{notif.title}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 font-medium">{notif.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            {/* Quick Profile display */}
            <div className="hidden md:flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <div 
                className="w-6 h-6 rounded-full text-white font-black text-[10px] flex items-center justify-center"
                style={{ backgroundColor: currentTeacher.avatarColor }}
              >
                {currentTeacher.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{currentTeacher.name}</span>
            </div>
          </div>
        </header>

        {/* CONTAINER WORKSPACE TAB CONTENTS */}
        <main className="p-6 md:p-8 flex-1">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Interactive Notification checklist banner */}
              {systemNotifications.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] bg-white/20 font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/10">Evaluasi Hari Ini</span>
                    <h3 className="text-lg font-bold">Halo {currentTeacher.name}, Anda memiliki agenda harian!</h3>
                    <p className="text-xs text-white/85 max-w-xl">Lengkapi pencatatan absensi harian kelas dan terbitkan jurnal mengajar harian tepat waktu agar cadangan cloud terbarui otomatis.</p>
                  </div>
                  <div className="flex items-center space-x-2.5 self-end md:self-auto">
                    <button
                      onClick={() => handleTabChange('attendance')}
                      className="bg-white hover:bg-slate-100 text-indigo-600 font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center space-x-1"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Isi Absensi</span>
                    </button>
                    <button
                      onClick={() => handleTabChange('journal')}
                      className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-white/10 transition-all"
                    >
                      <span>Tulis Jurnal</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Stats Visualizations */}
              <StatsTab
                students={students}
                classes={classes}
                attendance={attendance}
                grades={grades}
                journalsCount={journals.length}
                selectedClassId="all"
                kkm={kkm}
                onUpdateKkm={onUpdateKkm}
              />
            </div>
          )}

          {activeTab === 'attendance' && (
            <AttendanceTab
              students={students}
              classes={classes}
              attendance={attendance}
              onAddStudent={onAddStudent}
              onEditStudent={onEditStudent}
              onDeleteStudent={onDeleteStudent}
              onAddClass={onAddClass}
              onEditClass={onEditClass}
              onDeleteClass={onDeleteClass}
              onSaveAttendance={onSaveAttendance}
              onImportStudentsCSV={onImportStudentsCSV}
            />
          )}

          {activeTab === 'grades' && (
            <GradesTab
              students={students}
              classes={classes}
              grades={grades}
              onAddGrade={onAddGrade}
              onEditGrade={onEditGrade}
              onDeleteGrade={onDeleteGrade}
              onBulkAddGrades={onBulkAddGrades}
              onOverwriteGrades={onOverwriteGrades}
              kkm={kkm}
              onUpdateKkm={onUpdateKkm}
            />
          )}

          {activeTab === 'journal' && (
            <JournalTab
              classes={classes}
              journals={journals}
              onAddJournal={onAddJournal}
              onEditJournal={onEditJournal}
              onDeleteJournal={onDeleteJournal}
              onOverwriteJournals={onOverwriteJournals}
            />
          )}

          {activeTab === 'schedules' && (
            <ScheduleTab
              classes={classes}
              schedules={schedules}
              onAddScheduleSlot={onAddScheduleSlot}
              onEditScheduleSlot={onEditScheduleSlot}
              onDeleteScheduleSlot={onDeleteScheduleSlot}
              onOverwriteSchedules={onOverwriteSchedules}
            />
          )}

          {activeTab === 'discipline' && (
            <DisciplineTab
              students={students}
              classes={classes}
              disciplineRecords={disciplineRecords}
              onAddDisciplineRecord={onAddDisciplineRecord}
              onEditDisciplineRecord={onEditDisciplineRecord}
              onDeleteDisciplineRecord={onDeleteDisciplineRecord}
              onOverwriteDisciplineRecords={onOverwriteDisciplineRecords}
            />
          )}

          {activeTab === 'curriculum' && (
            <CurriculumTab
              curriculum={curriculum}
              onUpdateCurriculum={onUpdateCurriculum}
            />
          )}

          {activeTab === 'settings' && (
            <GoogleSync
              students={students}
              classes={classes}
              attendance={attendance}
              grades={grades}
              journals={journals}
              schedules={schedules}
              onRestoreDatabase={onRestoreDatabase}
              theme={theme}
              onChangeTheme={onChangeTheme}
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={onToggleNotifications}
              notificationReminderTime={notificationReminderTime}
              onChangeReminderTime={onChangeReminderTime}
              automaticBackup={automaticBackup}
              onToggleAutomaticBackup={onToggleAutomaticBackup}
              connectedEmail={connectedEmail}
              connectedName={connectedName}
              onConnectGoogle={onConnectGoogle}
              lastBackupTime={lastBackupTime}
              onUpdateBackupTime={onUpdateBackupTime}
              onSimulateNotification={onTriggerSimulation}
            />
          )}
        </main>
      </div>

      {/* DYNAMIC SIMULATED ALARM NOTIFICATION TOAST BOX */}
      {showSimulatedToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white rounded-2xl p-4.5 shadow-2xl border border-slate-800 max-w-sm z-50 animate-slide-in-right flex items-start space-x-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="font-bold text-xs tracking-tight">Pengingat Harian GuruAsisten 📝</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">Saatnya mengisi data absensi harian kelas dan menulis jurnal kegiatan mengajar Anda agar tetap ter-backup aman di cloud!</p>
            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                onClick={onDismissToast}
                className="text-[10px] text-slate-400 hover:text-white font-semibold"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  onDismissToast();
                  handleTabChange('attendance');
                }}
                className="bg-indigo-600 text-white font-bold text-[10px] px-3 py-1 rounded-lg hover:bg-indigo-500"
              >
                Isi Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
