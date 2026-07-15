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
  FileSpreadsheet
} from 'lucide-react';

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
  onImportStudentsCSV,
}: AttendanceTabProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab within AttendanceTab: 'mark' or 'students'
  const [subTab, setSubTab] = useState<'mark' | 'students'>('mark');

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

            <div className="flex items-center space-x-3 self-end md:self-auto">
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
    </div>
  );
}
