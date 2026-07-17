/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Student, Attendance, SchoolClass } from '../types';
import { 
  UserPlus, 
  Edit, 
  Trash2, 
  Calendar, 
  Users, 
  Plus, 
  Search, 
  CheckCircle, 
  X, 
  Save, 
  AlertCircle,
  FileSpreadsheet,
  TrendingUp,
  Upload
} from 'lucide-react';
import { googleSignIn, getAccessToken } from '../firebase';
import { exportToGoogleSheets, importFromGoogleSheets } from '../googleDrive';

interface AttendanceTabProps {
  students: Student[];
  classes: SchoolClass[];
  attendance: Attendance[];
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onAddClass: (name: string) => void;
  onEditClass: (classObj: SchoolClass) => void;
  onDeleteClass: (id: string) => void;
  onSaveAttendance: (records: Omit<Attendance, 'id'>[]) => void;
  onOverwriteAttendance: (records: Attendance[]) => void;
  onImportStudentsCSV: (csvText: string, classId: string) => void;
}

export default function AttendanceTab({
  students,
  classes,
  attendance,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onAddClass,
  onEditClass,
  onDeleteClass,
  onSaveAttendance,
  onOverwriteAttendance,
  onImportStudentsCSV,
}: AttendanceTabProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab within AttendanceTab: 'mark' or 'students'
  const [subTab, setSubTab] = useState<'mark' | 'students'>('mark');

  // Google Sheets & Recap States
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [isImportSheetsOpen, setIsImportSheetsOpen] = useState(false);
  const [isImportingSheets, setIsImportingSheets] = useState(false);
  const [importSheetUrl, setImportSheetUrl] = useState('');
  
  const [isRecapOpen, setIsRecapOpen] = useState(false);
  const [isExportingRecap, setIsExportingRecap] = useState(false);
  const [recapPeriod, setRecapPeriod] = useState<'Mingguan' | 'Bulanan' | 'Semesteran' | 'Tahunan'>('Bulanan');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  React.useEffect(() => {
    setSelectedStudentIds([]);
  }, [recapPeriod, selectedDate, selectedClassId, isRecapOpen]);

  const handleSelectAll = () => {
    if (selectedStudentIds.length === attendanceRecapData.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(attendanceRecapData.map(s => s.studentId));
    }
  };

  const handleDeleteSelectedAttendance = () => {
    if (selectedStudentIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus data absensi dari ${selectedStudentIds.length} siswa terpilih dalam periode ${recapPeriod} ini?`)) {
      return;
    }

    const refDate = new Date(selectedDate);
    if (isNaN(refDate.getTime())) return;

    let filterFn = (dateStr: string) => false;

    if (recapPeriod === 'Mingguan') {
      const day = refDate.getDay();
      const diffToMonday = refDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(refDate.setDate(diffToMonday));
      monday.setHours(0,0,0,0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23,59,59,999);

      filterFn = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= monday && d <= sunday;
      };
    } else if (recapPeriod === 'Bulanan') {
      const parts = selectedDate.split('-');
      const targetPrefix = `${parts[0]}-${parts[1]}`;
      filterFn = (dateStr: string) => dateStr.startsWith(targetPrefix);
    } else if (recapPeriod === 'Semesteran') {
      const parts = selectedDate.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const isOddSemester = month >= 7 && month <= 12;

      filterFn = (dateStr: string) => {
        const dParts = dateStr.split('-');
        if (parseInt(dParts[0]) !== year) return false;
        const m = parseInt(dParts[1]);
        return isOddSemester ? (m >= 7 && m <= 12) : (m >= 1 && m <= 6);
      };
    } else if (recapPeriod === 'Tahunan') {
      const parts = selectedDate.split('-');
      const targetPrefix = `${parts[0]}-`;
      filterFn = (dateStr: string) => dateStr.startsWith(targetPrefix);
    }

    const selectedSet = new Set(selectedStudentIds);
    const remaining = attendance.filter(a => !(selectedSet.has(a.studentId) && filterFn(a.date)));
    onOverwriteAttendance(remaining);
    setSelectedStudentIds([]);
    alert('Data absensi terpilih berhasil dihapus!');
  };

  // Attendance Form State
  const [tempAttendance, setTempAttendance] = useState<{ [studentId: string]: { status: 'H' | 'I' | 'S' | 'A'; notes: string } }>({});

  // Class Management State
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [classLevel, setClassLevel] = useState<string>('I');
  const [classParallel, setClassParallel] = useState<string>('A');
  const [isCustomClass, setIsCustomClass] = useState<boolean>(false);
  const [customClassName, setCustomClassName] = useState<string>('');

  const handleOpenClassModal = (cls?: SchoolClass) => {
    if (cls) {
      setEditingClass(cls);
      const match = cls.name.match(/^Kelas\s+(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)-([A-Z])$/);
      if (match) {
        setClassLevel(match[1]);
        setClassParallel(match[2]);
        setIsCustomClass(false);
        setCustomClassName('');
      } else {
        setIsCustomClass(true);
        setCustomClassName(cls.name);
      }
    } else {
      setEditingClass(null);
      setClassLevel('I');
      setClassParallel('A');
      setIsCustomClass(false);
      setCustomClassName('');
    }
    setIsClassModalOpen(true);
  };

  const saveClass = (e: React.FormEvent) => {
    e.preventDefault();
    const className = isCustomClass 
      ? customClassName.trim() 
      : `Kelas ${classLevel}-${classParallel}`;

    if (!className) {
      alert('Nama kelas tidak boleh kosong');
      return;
    }

    if (editingClass) {
      onEditClass({ ...editingClass, name: className });
      alert(`Berhasil memperbarui kelas menjadi "${className}"`);
    } else {
      onAddClass(className);
      alert(`Berhasil membuat "${className}"`);
    }
    setIsClassModalOpen(false);
  };

  const handleDeleteClassLocal = (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus "${name}"? Seluruh data siswa, absensi, nilai, jadwal pelajaran, dan jurnal harian kelas ini juga akan terhapus secara permanen!`)) {
      onDeleteClass(id);
      if (selectedClassId === id) {
        setSelectedClassId('all');
      }
    }
  };
  
  // Student Form State (for adding/editing)
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({ name: '', nisn: '', gender: 'L' as 'L' | 'P', classId: classes[0]?.id || '' });

  // Bulk CSV Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importClassId, setImportClassId] = useState(classes[0]?.id || '');

  // Track if attendance for current date/class was loaded
  const currentSavedAttendance = useMemo(() => {
    return attendance.filter(a => a.date === selectedDate);
  }, [attendance, selectedDate]);

  // Filtered Students for active class
  const classStudents = useMemo(() => {
    return students.filter(s => s.classId === selectedClassId);
  }, [students, selectedClassId]);

  // Sync temp attendance when class, date, or saved attendance changes
  React.useEffect(() => {
    const updatedTemp: typeof tempAttendance = {};
    classStudents.forEach(student => {
      const saved = currentSavedAttendance.find(a => a.studentId === student.id);
      updatedTemp[student.id] = {
        status: saved ? saved.status : 'H', // Default to Hadir
        notes: saved ? saved.notes : '',
      };
    });
    setTempAttendance(updatedTemp);
  }, [selectedClassId, selectedDate, students, currentSavedAttendance]);

  // All student listing search
  const filteredAllStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.nisn.includes(searchQuery);
      const matchesClass = selectedClassId === 'all' || s.classId === selectedClassId;
      return matchesSearch && matchesClass;
    });
  }, [students, searchQuery, selectedClassId]);

  const handleStatusChange = (studentId: string, status: 'H' | 'I' | 'S' | 'A') => {
    setTempAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      }
    }));
  };

  const handleNoteChange = (studentId: string, notes: string) => {
    setTempAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      }
    }));
  };

  const handleSaveAll = () => {
    const recordsToSave = Object.entries(tempAttendance).map(([studentId, data]: [string, any]) => ({
      date: selectedDate,
      studentId,
      status: data.status,
      notes: data.notes,
    }));
    
    onSaveAttendance(recordsToSave);
    alert('Data absensi hari ini berhasil disimpan dan disinkronkan!');
  };

  const openStudentModal = (student: Student | null = null) => {
    if (student) {
      setEditingStudent(student);
      setStudentForm({
        name: student.name,
        nisn: student.nisn,
        gender: student.gender,
        classId: student.classId,
      });
    } else {
      setEditingStudent(null);
      setStudentForm({
        name: '',
        nisn: '',
        gender: 'L',
        classId: selectedClassId || classes[0]?.id || '',
      });
    }
    setIsStudentModalOpen(true);
  };

  const saveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) return;

    if (editingStudent) {
      onEditStudent({
        ...editingStudent,
        name: studentForm.name,
        nisn: studentForm.nisn,
        gender: studentForm.gender,
        classId: studentForm.classId,
      });
    } else {
      onAddStudent({
        name: studentForm.name,
        nisn: studentForm.nisn,
        gender: studentForm.gender,
        classId: studentForm.classId,
      });
    }
    setIsStudentModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus siswa "${name}"? Semua data absensi dan nilai siswa ini juga akan terhapus.`)) {
      onDeleteStudent(id);
    }
  };

  const handleCSVImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    onImportStudentsCSV(csvText, importClassId);
    setCsvText('');
    setIsImportOpen(false);
    alert('Impor siswa berhasil!');
  };

  // Google Sheets & Recap Dynamic Logic
  const attendanceRecapData = useMemo(() => {
    const refDate = new Date(selectedDate);
    if (isNaN(refDate.getTime())) return [];

    let filterFn = (dateStr: string) => false;

    if (recapPeriod === 'Mingguan') {
      const day = refDate.getDay();
      const diffToMonday = refDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(refDate.setDate(diffToMonday));
      monday.setHours(0,0,0,0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23,59,59,999);

      filterFn = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= monday && d <= sunday;
      };
    } else if (recapPeriod === 'Bulanan') {
      const parts = selectedDate.split('-');
      const targetPrefix = `${parts[0]}-${parts[1]}`;
      filterFn = (dateStr: string) => dateStr.startsWith(targetPrefix);
    } else if (recapPeriod === 'Semesteran') {
      const parts = selectedDate.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const isOddSemester = month >= 7 && month <= 12;

      filterFn = (dateStr: string) => {
        const dParts = dateStr.split('-');
        if (parseInt(dParts[0]) !== year) return false;
        const m = parseInt(dParts[1]);
        return isOddSemester ? (m >= 7 && m <= 12) : (m >= 1 && m <= 6);
      };
    } else if (recapPeriod === 'Tahunan') {
      const parts = selectedDate.split('-');
      const targetPrefix = `${parts[0]}-`;
      filterFn = (dateStr: string) => dateStr.startsWith(targetPrefix);
    }

    const activeStudentIds = new Set(classStudents.map(s => s.id));
    const filteredAtt = attendance.filter(a => activeStudentIds.has(a.studentId) && filterFn(a.date));

    return classStudents.map((student, idx) => {
      const studentAtts = filteredAtt.filter(a => a.studentId === student.id);
      
      const sakit = studentAtts.filter(a => a.status === 'S').length;
      const izin = studentAtts.filter(a => a.status === 'I').length;
      const alpa = studentAtts.filter(a => a.status === 'A').length;
      const hadir = studentAtts.filter(a => a.status === 'H').length;
      
      const totalDays = sakit + izin + alpa + hadir;
      const percentage = totalDays > 0 ? Math.round((hadir / totalDays) * 100) : 100;

      return {
        index: idx + 1,
        studentId: student.id,
        name: student.name,
        nisn: student.nisn || '-',
        hadir,
        sakit,
        izin,
        alpa,
        totalDays,
        percentage
      };
    });
  }, [selectedDate, selectedClassId, recapPeriod, classStudents, attendance]);

  const handleExportSheets = async () => {
    let token = getAccessToken();
    if (!token) {
      try {
        const authRes = await googleSignIn();
        if (authRes) {
          token = authRes.accessToken;
        } else {
          alert('Silakan hubungkan akun Google Anda terlebih dahulu untuk mengekspor!');
          return;
        }
      } catch (e: any) {
        alert('Gagal menghubungkan akun Google: ' + e.message);
        return;
      }
    }

    if (classStudents.length === 0) {
      alert('Tidak ada data siswa untuk diekspor!');
      return;
    }

    setIsExportingSheets(true);
    try {
      const activeClass = classes.find(c => c.id === selectedClassId);
      const className = activeClass ? activeClass.name : 'Kelas';
      
      const headerRow = [
        'No', 'Tanggal', 'NISN', 'Nama Siswa', 'L/P', 'Status Kehadiran', 'Catatan Keterangan'
      ];

      const rows = classStudents.map((student, idx) => {
        const att = tempAttendance[student.id] || { status: 'H', notes: '' };
        const statusLabel = att.status === 'H' ? 'Hadir' : att.status === 'I' ? 'Izin' : att.status === 'S' ? 'Sakit' : 'Alpa';
        return [
          (idx + 1).toString(),
          selectedDate,
          student.nisn || '',
          student.name,
          student.gender,
          statusLabel,
          att.notes || ''
        ];
      });

      const payload = {
        title: `Absensi ${className} - Tanggal ${selectedDate}`,
        headers: headerRow,
        rows: rows
      };

      const url = await exportToGoogleSheets(token, payload);
      setIsExportingSheets(false);
      window.open(url, '_blank');
      alert('Berhasil mengekspor absensi siswa ke Google Sheets!');
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengekspor: ' + error.message);
      setIsExportingSheets(false);
    }
  };

  const handleImportSheets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importSheetUrl.trim()) {
      alert('Tautan/ID Spreadsheet wajib diisi!');
      return;
    }

    let token = getAccessToken();
    if (!token) {
      try {
        const authRes = await googleSignIn();
        if (authRes) {
          token = authRes.accessToken;
        } else {
          alert('Silakan hubungkan akun Google Anda terlebih dahulu untuk mengimpor!');
          return;
        }
      } catch (e: any) {
        alert('Gagal menghubungkan akun Google: ' + e.message);
        return;
      }
    }

    let spreadsheetId = importSheetUrl.trim();
    const matches = importSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (matches && matches[1]) {
      spreadsheetId = matches[1];
    }

    setIsImportingSheets(true);
    try {
      const rawRows = await importFromGoogleSheets(token, spreadsheetId, 'Sheet1!A1:G500');
      if (rawRows.length < 2) {
        alert('Data Google Sheet kosong atau tidak valid (minimal butuh baris header dan 1 baris data).');
        setIsImportingSheets(false);
        return;
      }

      const headers = rawRows[0].map(h => h.trim().toLowerCase());
      
      let dateIdx = headers.findIndex(h => h.includes('tanggal') || h.includes('date'));
      let nisnIdx = headers.findIndex(h => h.includes('nisn'));
      let nameIdx = headers.findIndex(h => h.includes('siswa') || h.includes('nama') || h.includes('name'));
      let statusIdx = headers.findIndex(h => h.includes('status') || h.includes('kehadiran') || h.includes('attendance'));
      let notesIdx = headers.findIndex(h => h.includes('catatan') || h.includes('keterangan') || h.includes('notes'));

      if (nameIdx === -1 || statusIdx === -1) {
        alert('Gagal mencocokkan kolom! Pastikan Google Sheet Anda memiliki baris header dengan minimal kolom: Nama Siswa, Status Kehadiran.');
        setIsImportingSheets(false);
        return;
      }

      const dataRows = rawRows.slice(1);
      const recordsToSave: Omit<Attendance, 'id'>[] = [];

      dataRows.forEach((row) => {
        const studentNameVal = row[nameIdx]?.trim();
        const statusVal = row[statusIdx]?.trim();
        const dateVal = dateIdx !== -1 ? row[dateIdx]?.trim() : selectedDate;
        const nisnVal = nisnIdx !== -1 ? row[nisnIdx]?.trim() : '';

        if (!studentNameVal || !statusVal) return;

        let studentObj = students.find(s => s.name.toLowerCase() === studentNameVal.toLowerCase());
        if (!studentObj && nisnVal) {
          studentObj = students.find(s => s.nisn === nisnVal);
        }

        if (!studentObj) return;

        let status: 'H' | 'I' | 'S' | 'A' = 'H';
        const stChar = statusVal.toLowerCase();
        if (stChar.startsWith('h') || stChar === 'hadir') status = 'H';
        else if (stChar.startsWith('i') || stChar === 'izin' || stChar === 'ijin') status = 'I';
        else if (stChar.startsWith('s') || stChar === 'sakit') status = 'S';
        else if (stChar.startsWith('a') || stChar === 'alpa' || stChar === 'absent') status = 'A';

        const notesVal = notesIdx !== -1 ? row[notesIdx]?.trim() || '' : '';

        recordsToSave.push({
          date: dateVal || selectedDate,
          studentId: studentObj.id,
          status,
          notes: notesVal
        });
      });

      if (recordsToSave.length > 0) {
        onSaveAttendance(recordsToSave);
        setIsImportingSheets(false);
        setIsImportSheetsOpen(false);
        alert(`Berhasil mengimpor ${recordsToSave.length} data absensi dari Google Sheets!`);
      } else {
        alert('Tidak ada data absensi siswa yang cocok dengan daftar siswa lokal.');
        setIsImportingSheets(false);
      }
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengimpor absensi: ' + error.message);
      setIsImportingSheets(false);
    }
  };

  const handleExportRecapSheets = async () => {
    let token = getAccessToken();
    if (!token) {
      try {
        const authRes = await googleSignIn();
        if (authRes) {
          token = authRes.accessToken;
        } else {
          alert('Silakan hubungkan akun Google Anda terlebih dahulu!');
          return;
        }
      } catch (e: any) {
        alert('Gagal menghubungkan akun Google: ' + e.message);
        return;
      }
    }

    if (attendanceRecapData.length === 0) {
      alert('Tidak ada data rekap untuk diekspor!');
      return;
    }

    setIsExportingRecap(true);
    try {
      const activeClass = classes.find(c => c.id === selectedClassId);
      const className = activeClass ? activeClass.name : 'Kelas';
      
      const headerRow = [
        'No', 'Nama Siswa', 'NISN', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Persentase Kehadiran'
      ];

      const rows = attendanceRecapData.map((stat, idx) => [
        (idx + 1).toString(),
        stat.name,
        stat.nisn,
        stat.hadir.toString(),
        stat.sakit.toString(),
        stat.izin.toString(),
        stat.alpa.toString(),
        `${stat.percentage}%`
      ]);

      const payload = {
        title: `Rekap Absensi ${recapPeriod} - ${className}`,
        headers: headerRow,
        rows: rows
      };

      const url = await exportToGoogleSheets(token, payload);
      setIsExportingRecap(false);
      window.open(url, '_blank');
      alert('Berhasil mengunduh rekap absensi ke Google Sheets!');
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengunduh rekap: ' + error.message);
      setIsExportingRecap(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setSubTab('mark')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            subTab === 'mark'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Mencatat Absensi</span>
        </button>
        <button
          onClick={() => setSubTab('students')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            subTab === 'students'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Daftar Siswa & Kelas</span>
        </button>
      </div>

      {subTab === 'mark' ? (
        // MARK ATTENDANCE TAB
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tanggal Absensi</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pilih Kelas</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-xl text-sm focus:outline-none focus:border-indigo-500 min-w-[140px]"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
              <button
                onClick={() => setIsRecapOpen(true)}
                className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Rekap Absensi</span>
              </button>

              <button
                onClick={() => setIsImportSheetsOpen(true)}
                className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Impor Sheets</span>
              </button>

              <button
                onClick={handleExportSheets}
                disabled={isExportingSheets || classStudents.length === 0}
                className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isExportingSheets ? 'Mengekspor...' : 'Ekspor Sheets'}</span>
              </button>

              <button
                onClick={handleSaveAll}
                disabled={classStudents.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Absensi</span>
              </button>
            </div>
          </div>

          {/* Students Grid */}
          {classStudents.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">Belum ada siswa di kelas ini</p>
              <button
                onClick={() => setSubTab('students')}
                className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold mt-2 hover:underline"
              >
                Tambah siswa baru sekarang
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                      <th className="py-4 px-6">Nama Siswa</th>
                      <th className="py-4 px-6">L/P</th>
                      <th className="py-4 px-6 text-center min-w-[280px]">Status Kehadiran</th>
                      <th className="py-4 px-6">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {classStudents.map((student) => {
                      const studentAtt = tempAttendance[student.id] || { status: 'H', notes: '' };
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="py-4 px-6">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{student.name}</span>
                            <div className="text-xs text-slate-400">NISN: {student.nisn || '-'}</div>
                          </td>
                          <td className="py-4 px-6 text-slate-500 dark:text-slate-400 font-semibold">{student.gender}</td>
                          <td className="py-4 px-6">
                            <div className="flex justify-center items-center space-x-1.5 bg-slate-50 dark:bg-slate-900/40 p-1 rounded-xl w-fit mx-auto">
                              {(['H', 'I', 'S', 'A'] as const).map((status) => {
                                const statusLabels = { H: 'Hadir', I: 'Izin', S: 'Sakit', A: 'Alpa' };
                                const colors = {
                                  H: 'bg-emerald-500 text-white shadow-emerald-500/20',
                                  I: 'bg-blue-500 text-white shadow-blue-500/20',
                                  S: 'bg-amber-500 text-white shadow-amber-500/20',
                                  A: 'bg-red-500 text-white shadow-red-500/20'
                                };
                                const isSelected = studentAtt.status === status;
                                return (
                                  <button
                                    key={status}
                                    onClick={() => handleStatusChange(student.id, status)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                                      isSelected 
                                        ? colors[status] 
                                        : 'text-slate-500 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    {statusLabels[status]}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <input
                              type="text"
                              placeholder="Keterangan..."
                              value={studentAtt.notes}
                              onChange={(e) => handleNoteChange(student.id, e.target.value)}
                              className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 focus:border-indigo-500 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs w-full focus:outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        // STUDENT DIRECTORY TAB
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search and class selection */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama siswa atau NISN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 pl-10 pr-4 py-2 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>

              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-sm md:w-[180px]"
              >
                <option value="all">Semua Kelas</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleOpenClassModal()}
                className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Kelola Kelas</span>
              </button>

              <button
                onClick={() => {
                  setImportClassId(selectedClassId === 'all' ? (classes[0]?.id || '') : selectedClassId);
                  setIsImportOpen(true);
                }}
                className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center space-x-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Impor CSV</span>
              </button>

              <button
                onClick={() => openStudentModal()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Siswa</span>
              </button>
            </div>
          </div>

          {/* Student list */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                    <th className="py-4 px-6">NISN</th>
                    <th className="py-4 px-6">Nama Siswa</th>
                    <th className="py-4 px-6">L/P</th>
                    <th className="py-4 px-6">Kelas</th>
                    <th className="py-4 px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {filteredAllStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Tidak ada data siswa ditemukan
                      </td>
                    </tr>
                  ) : (
                    filteredAllStudents.map((student) => {
                      const studentClass = classes.find(c => c.id === student.classId);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="py-4 px-6 font-mono font-medium text-slate-500 dark:text-slate-400">{student.nisn || '-'}</td>
                          <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-100">{student.name}</td>
                          <td className="py-4 px-6 font-semibold text-slate-600 dark:text-slate-400">{student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                          <td className="py-4 px-6">
                            <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 py-1 rounded-full text-xs">
                              {studentClass ? studentClass.name : '-'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => openStudentModal(student)}
                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(student.id, student.name)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Student Add/Edit Modal */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg">{editingStudent ? 'Edit Siswa' : 'Tambah Siswa Baru'}</h3>
              <button onClick={() => setIsStudentModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveStudent} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Budi Santoso"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">NISN (Nomor Induk Siswa Nasional)</label>
                <input
                  type="text"
                  placeholder="e.g. 0081234567"
                  value={studentForm.nisn}
                  onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Jenis Kelamin</label>
                  <select
                    value={studentForm.gender}
                    onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as 'L' | 'P' })}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pilih Kelas</label>
                  <select
                    value={studentForm.classId}
                    onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
                >
                  {editingStudent ? 'Simpan Perubahan' : 'Tambah Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Impor Siswa Secara Massal (CSV)</span>
              </h3>
              <button onClick={() => setIsImportOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCSVImport} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pilih Kelas untuk Impor</label>
                <select
                  value={importClassId}
                  onChange={(e) => setImportClassId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data Siswa (Format CSV / Tabel Tempel)</label>
                  <span className="text-[10px] text-indigo-500 font-semibold uppercase">Format: NISN, Nama, L/P</span>
                </div>
                <textarea
                  required
                  rows={6}
                  placeholder={`00823412,Budi Santoso,L&#10;00912384,Siti Aminah,P&#10;00898712,Dewi Lestari,P`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 p-3 rounded-xl flex items-start space-x-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Tempelkan baris data dari Excel atau salin format di atas. Pastikan Jenis Kelamin diisi <b>L</b> (Laki-laki) atau <b>P</b> (Perempuan).
                </p>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
                >
                  Mulai Impor Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class Management Modal */}
      {isClassModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white flex-shrink-0">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Kelola Rombongan Belajar / Kelas</span>
              </h3>
              <button onClick={() => setIsClassModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Form to Add/Edit Class */}
              <form onSubmit={saveClass} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {editingClass ? `Edit Rombel: "${editingClass.name}"` : 'Tambah Rombel / Kelas Baru'}
                </h4>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="radio"
                      checked={!isCustomClass}
                      onChange={() => setIsCustomClass(false)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Gunakan Generator Tingkat & Paralel</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="radio"
                      checked={isCustomClass}
                      onChange={() => setIsCustomClass(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Input Nama Kustom</span>
                  </label>
                </div>

                {!isCustomClass ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tingkat (I - XII)</label>
                      <select
                        value={classLevel}
                        onChange={(e) => setClassLevel(e.target.value)}
                        className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                      >
                        {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map(lvl => (
                          <option key={lvl} value={lvl}>Tingkat {lvl}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rombel Paralel (A - Z)</label>
                      <select
                        value={classParallel}
                        onChange={(e) => setClassParallel(e.target.value)}
                        className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                      >
                        {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(char => (
                          <option key={char} value={char}>Kelas Paralel {char}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nama Kelas Kustom</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kelas I-A, Kelas Unggulan, XII-IPA"
                      value={customClassName}
                      onChange={(e) => setCustomClassName(e.target.value)}
                      className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Real-time Preview */}
                <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                  Preview Nama: {isCustomClass ? (customClassName || '-') : 'Kelas ' + classLevel + '-' + classParallel}
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  {editingClass && (
                    <button
                      type="button"
                      onClick={() => handleOpenClassModal()}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                    >
                      Batal Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 transition-all"
                  >
                    {editingClass ? 'Simpan Perubahan' : 'Tambah Rombel'}
                  </button>
                </div>
              </form>

              {/* Class List and Deletion */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Daftar Rombel Saat Ini ({classes.length})</h4>
                  <p className="text-[10px] text-slate-400">Tingkat I - XII • Paralel A - Z</p>
                </div>
                
                {classes.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">Belum ada kelas terdaftar</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-150 dark:border-slate-700/80 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                    {classes.map(cls => {
                      const studentCount = students.filter(s => s.classId === cls.id).length;
                      return (
                        <div key={cls.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-all">
                          <div>
                            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{cls.name}</span>
                            <span className="ml-2 text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full">
                              {studentCount} Siswa
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenClassModal(cls)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                              title="Edit Nama Kelas"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClassLocal(cls.id, cls.name)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end flex-shrink-0">
              <button
                onClick={() => setIsClassModalOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/10 transition-all"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Import Modal */}
      {isImportSheetsOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Impor Absensi dari Google Sheets</span>
              </h3>
              <button onClick={() => setIsImportSheetsOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSheets} className="p-6 space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/30 p-3.5 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-400 leading-relaxed">
                Masukkan tautan edit atau ID Google Sheet Anda. Pastikan baris pertama (header) berisi nama kolom seperti: 
                <strong> Tanggal, Nama Siswa, NISN, Status Kehadiran, Catatan Keterangan.</strong>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tautan / ID Google Spreadsheet</label>
                <input
                  type="text"
                  required
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={importSheetUrl}
                  onChange={(e) => setImportSheetUrl(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setIsImportSheetsOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isImportingSheets}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg transition-all"
                >
                  {isImportingSheets ? 'Mengimpor...' : 'Impor Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Recap Modal */}
      {isRecapOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-slate-750 to-slate-900 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <span>Rekap Absensi Kelas</span>
              </h3>
              <button onClick={() => setIsRecapOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[520px] overflow-y-auto">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-150 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Rentang Waktu</label>
                    <select
                      value={recapPeriod}
                      onChange={(e) => setRecapPeriod(e.target.value as any)}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500 min-w-[140px] font-bold"
                    >
                      <option value="Mingguan">Mingguan</option>
                      <option value="Bulanan">Bulanan</option>
                      <option value="Semesteran">Semesteran</option>
                      <option value="Tahunan">Tahunan</option>
                    </select>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Acuan Tanggal</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed sm:text-right max-w-xs">
                  Menampilkan rekap berdasarkan kelas aktif dan rentang waktu yang dipilih dari acuan tanggal.
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[9px] font-black tracking-wider">
                        <th className="py-3 px-4 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={attendanceRecapData.length > 0 && selectedStudentIds.length === attendanceRecapData.length}
                            onChange={handleSelectAll}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-4 w-16 text-center">Nomor</th>
                        <th className="py-3 px-3">Nama Siswa</th>
                        <th className="py-3 px-3">NISN</th>
                        <th className="py-3 px-3 text-center">Jumlah Kehadiran</th>
                        <th className="py-3 px-3 text-center">Sakit</th>
                        <th className="py-3 px-3 text-center">Ijin</th>
                        <th className="py-3 px-3 text-center">Alpa</th>
                        <th className="py-3 px-3 text-center">Persentase Kehadiran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                      {attendanceRecapData.length > 0 ? (
                        attendanceRecapData.map((stat, idx) => (
                          <tr key={stat.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedStudentIds.includes(stat.studentId)}
                                onChange={() => {
                                  if (selectedStudentIds.includes(stat.studentId)) {
                                    setSelectedStudentIds(selectedStudentIds.filter(id => id !== stat.studentId));
                                  } else {
                                    setSelectedStudentIds([...selectedStudentIds, stat.studentId]);
                                  }
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4 text-center text-slate-400 font-bold">{stat.index}</td>
                            <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">{stat.name}</td>
                            <td className="py-3 px-3 font-mono text-[10px] text-slate-400">{stat.nisn}</td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{stat.hadir} Hari</td>
                            <td className="py-3 px-3 text-center font-bold text-amber-500">{stat.sakit} Hari</td>
                            <td className="py-3 px-3 text-center font-bold text-blue-500">{stat.izin} Hari</td>
                            <td className="py-3 px-3 text-center font-bold text-red-500">{stat.alpa} Hari</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                                stat.percentage >= 90 
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' 
                                  : stat.percentage >= 75 
                                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-500' 
                                  : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                              }`}>
                                {stat.percentage}%
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                            Belum ada data siswa terdaftar di kelas ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportRecapSheets}
                    disabled={isExportingRecap || attendanceRecapData.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{isExportingRecap ? 'Mengunduh...' : 'Unduh Google Sheets'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSelectedAttendance}
                    disabled={selectedStudentIds.length === 0}
                    className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Terpilih ({selectedStudentIds.length})</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={attendanceRecapData.length === 0}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {selectedStudentIds.length === attendanceRecapData.length ? 'Batalkan Semua' : 'Pilih Semua'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRecapOpen(false)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Tutup Rekap
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
