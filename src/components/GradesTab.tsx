/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Grade, Student, SchoolClass } from '../types';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Award, 
  Filter, 
  X, 
  Save, 
  Layers, 
  Grid 
} from 'lucide-react';

interface GradesTabProps {
  students: Student[];
  classes: SchoolClass[];
  grades: Grade[];
  onAddGrade: (grade: Omit<Grade, 'id'>) => void;
  onEditGrade: (grade: Grade) => void;
  onDeleteGrade: (id: string) => void;
  onBulkAddGrades: (grades: Omit<Grade, 'id'>[]) => void;
  kkm: number;
  onUpdateKkm: (value: number) => void;
}

export default function GradesTab({
  students,
  classes,
  grades,
  onAddGrade,
  onEditGrade,
  onDeleteGrade,
  onBulkAddGrades,
  kkm,
  onUpdateKkm,
}: GradesTabProps) {
  const [activeTab, setActiveTab] = useState<'view' | 'bulk'>('view');
  
  // Filters for View Tab
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Custom subject states (when 'Lainnya' is selected)
  const [customSubject, setCustomSubject] = useState('');
  const [customBulkSubject, setCustomBulkSubject] = useState('');

  // Single Grade Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [gradeForm, setGradeForm] = useState({
    studentId: '',
    subject: 'Matematika',
    type: 'Ulangan' as 'Tugas' | 'Ulangan' | 'UTS' | 'UAS',
    score: 80,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Bulk Grading Form State
  const [bulkClassId, setBulkClassId] = useState(classes[0]?.id || '');
  const [bulkSubject, setBulkSubject] = useState('Matematika');
  const [bulkType, setBulkType] = useState<'Tugas' | 'Ulangan' | 'UTS' | 'UAS'>('Ulangan');
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkScores, setBulkScores] = useState<{ [studentId: string]: number }>({});
  const [bulkNotes, setBulkNotes] = useState<{ [studentId: string]: string }>({});

  const subjects = ['Matematika', 'IPA', 'IPS', 'Bahasa Indonesia', 'PJOK', 'Seni Budaya', 'Bahasa Inggris', 'Pendidikan Pancasila', 'Agama'];

  // Dynamically compile a list of standard + custom subjects actually used, for filters
  const filterSubjects = useMemo(() => {
    const unique = new Set(subjects);
    grades.forEach(g => {
      if (g.subject) unique.add(g.subject);
    });
    return Array.from(unique);
  }, [grades, subjects]);

  // List of students for bulk grading
  const bulkStudents = useMemo(() => {
    return students.filter(s => s.classId === bulkClassId);
  }, [students, bulkClassId]);

  // Sync bulk scores when student list changes
  React.useEffect(() => {
    const scores: typeof bulkScores = {};
    const notes: typeof bulkNotes = {};
    bulkStudents.forEach(s => {
      scores[s.id] = 80; // Default score
      notes[s.id] = '';
    });
    setBulkScores(scores);
    setBulkNotes(notes);
  }, [bulkStudents, bulkClassId]);

  // Filtered grades for listing
  const filteredGrades = useMemo(() => {
    return grades.filter(g => {
      const student = students.find(s => s.id === g.studentId);
      if (!student) return false;

      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClass = selectedClassId === 'all' || student.classId === selectedClassId;
      const matchesSubject = selectedSubject === 'all' || g.subject === selectedSubject;
      const matchesType = selectedType === 'all' || g.type === selectedType;

      return matchesSearch && matchesClass && matchesSubject && matchesType;
    });
  }, [grades, students, selectedClassId, selectedSubject, selectedType, searchQuery]);

  // Handle single grade form submit
  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeForm.studentId) {
      alert('Pilih siswa terlebih dahulu!');
      return;
    }

    const finalSubject = gradeForm.subject === 'Lainnya' ? customSubject.trim() : gradeForm.subject;
    if (gradeForm.subject === 'Lainnya' && !customSubject.trim()) {
      alert('Tuliskan nama mata pelajaran kustom terlebih dahulu!');
      return;
    }

    const payload = {
      studentId: gradeForm.studentId,
      subject: finalSubject,
      type: gradeForm.type,
      score: Number(gradeForm.score),
      date: gradeForm.date,
      notes: gradeForm.notes,
    };

    if (editingGrade) {
      onEditGrade({
        ...editingGrade,
        ...payload,
      });
    } else {
      onAddGrade(payload);
    }

    setIsModalOpen(false);
  };

  // Open modal for add or edit
  const openGradeModal = (grade: Grade | null = null) => {
    if (grade) {
      setEditingGrade(grade);
      const isStandardSubject = subjects.includes(grade.subject);
      setGradeForm({
        studentId: grade.studentId,
        subject: isStandardSubject ? grade.subject : 'Lainnya',
        type: grade.type,
        score: grade.score,
        date: grade.date,
        notes: grade.notes,
      });
      if (!isStandardSubject) {
        setCustomSubject(grade.subject);
      } else {
        setCustomSubject('');
      }
    } else {
      setEditingGrade(null);
      // Pick first student from available students
      const firstStudent = students[0]?.id || '';
      setGradeForm({
        studentId: firstStudent,
        subject: 'Matematika',
        type: 'Ulangan',
        score: 80,
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setCustomSubject('');
    }
    setIsModalOpen(true);
  };

  // Handle Bulk Grades Save
  const handleSaveBulk = () => {
    if (bulkStudents.length === 0) return;

    const finalBulkSubject = bulkSubject === 'Lainnya' ? customBulkSubject.trim() : bulkSubject;
    if (bulkSubject === 'Lainnya' && !customBulkSubject.trim()) {
      alert('Tuliskan nama mata pelajaran kustom terlebih dahulu!');
      return;
    }

    const payload: Omit<Grade, 'id'>[] = bulkStudents.map(student => ({
      studentId: student.id,
      subject: finalBulkSubject,
      type: bulkType,
      score: Number(bulkScores[student.id] ?? 80),
      date: bulkDate,
      notes: bulkNotes[student.id] || '',
    }));

    onBulkAddGrades(payload);
    setActiveTab('view');
    alert(`Berhasil memasukkan ${payload.length} nilai baru untuk kelas!`);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data nilai siswa ini?')) {
      onDeleteGrade(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('view')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'view'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Riwayat Nilai Siswa</span>
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'bulk'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Input Nilai Sekaligus (Bulk)</span>
        </button>
      </div>

      {activeTab === 'view' ? (
        // VIEW AND FILTER GRADES LIST
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 pl-10 pr-4 py-2 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold self-stretch">
                <span className="text-slate-500 dark:text-slate-400">KKM Aktif:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={kkm}
                  onChange={(e) => onUpdateKkm(Number(e.target.value))}
                  className="w-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-1 py-0.5 rounded text-center font-bold focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newKkm = prompt("Masukkan nilai KKM baru secara manual (0-100):", kkm.toString());
                    if (newKkm !== null && !isNaN(Number(newKkm))) {
                      const val = Number(newKkm);
                      if (val >= 0 && val <= 100) {
                        onUpdateKkm(val);
                      } else {
                        alert("KKM harus berada di rentang 0 - 100!");
                      }
                    }
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline hover:text-indigo-500 transition-colors"
                >
                  Ubah
                </button>
              </div>

              <button
                onClick={() => openGradeModal()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center space-x-2 self-stretch"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Nilai</span>
              </button>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-50 dark:border-slate-700/50 text-xs">
              <div className="flex items-center space-x-1.5 text-slate-400 font-medium">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter:</span>
              </div>

              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg focus:outline-none"
              >
                <option value="all">Semua Kelas</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg focus:outline-none"
              >
                <option value="all">Semua Pelajaran</option>
                {filterSubjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg focus:outline-none"
              >
                <option value="all">Semua Jenis Evaluasi</option>
                <option value="Tugas">Tugas</option>
                <option value="Ulangan">Ulangan Harian</option>
                <option value="UTS">UTS</option>
                <option value="UAS">UAS</option>
              </select>
            </div>
          </div>

          {/* Grades Listing Grid */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                    <th className="py-4 px-6">Nama Siswa</th>
                    <th className="py-4 px-6">Mata Pelajaran</th>
                    <th className="py-4 px-6">Jenis</th>
                    <th className="py-4 px-6">Tanggal</th>
                    <th className="py-4 px-6">Nilai</th>
                    <th className="py-4 px-6">Catatan</th>
                    <th className="py-4 px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {filteredGrades.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Belum ada data nilai harian yang cocok dengan filter
                      </td>
                    </tr>
                  ) : (
                    filteredGrades.map((grade) => {
                      const student = students.find(s => s.id === grade.studentId);
                      const studentClass = student ? classes.find(c => c.id === student.classId) : null;
                      
                      const scoreColor = grade.score >= 80 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : grade.score >= 70 
                        ? 'text-indigo-600 dark:text-indigo-400' 
                        : 'text-rose-600 dark:text-rose-400';

                      return (
                        <tr key={grade.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="py-4 px-6">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{student ? student.name : 'Unknown'}</span>
                            <div className="text-xs text-slate-400">Kelas: {studentClass ? studentClass.name : '-'}</div>
                          </td>
                          <td className="py-4 px-6 font-medium text-slate-700 dark:text-slate-300">{grade.subject}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              grade.type === 'Ulangan' 
                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600' 
                                : grade.type === 'Tugas' 
                                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600'
                                : 'bg-red-50 dark:bg-red-950/30 text-red-600'
                            }`}>
                              {grade.type === 'Ulangan' ? 'Ulangan' : grade.type}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-500 dark:text-slate-400 font-mono text-xs">
                            {new Date(grade.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className={`py-4 px-6 font-extrabold text-base ${scoreColor}`}>
                            {grade.score}
                          </td>
                          <td className="py-4 px-6 text-slate-500 dark:text-slate-400 italic text-xs max-w-[150px] truncate">{grade.notes || '-'}</td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => openGradeModal(grade)}
                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(grade.id)}
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
      ) : (
        // BULK GRADE INPUT TAB
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pilih Kelas</label>
              <select
                value={bulkClassId}
                onChange={(e) => setBulkClassId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mata Pelajaran</label>
              <select
                value={bulkSubject}
                onChange={(e) => setBulkSubject(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
              >
                {subjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
                <option value="Lainnya">Lainnya...</option>
              </select>
              {bulkSubject === 'Lainnya' && (
                <div className="mt-2 space-y-1 animate-fadeIn">
                  <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block">Tulis Pelajaran Manual</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bahasa Sunda"
                    value={customBulkSubject}
                    onChange={(e) => setCustomBulkSubject(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Jenis Penilaian</label>
              <select
                value={bulkType}
                onChange={(e) => setBulkType(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
              >
                <option value="Tugas">Tugas</option>
                <option value="Ulangan">Ulangan Harian</option>
                <option value="UTS">UTS</option>
                <option value="UAS">UAS</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tanggal Pelaksanaan</label>
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-indigo-500" />
              <span>Daftar Nilai Siswa Kelas</span>
            </h4>

            {bulkStudents.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Tidak ada siswa terdaftar di kelas ini</div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {bulkStudents.map(student => (
                  <div key={student.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-50/70 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/30">
                    <div className="md:col-span-5">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{student.name}</span>
                      <p className="text-[10px] text-slate-400">NISN: {student.nisn || '-'}</p>
                    </div>

                    <div className="md:col-span-3 flex items-center space-x-2">
                      <label className="text-[10px] text-slate-400 md:hidden">Nilai:</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={bulkScores[student.id] ?? 80}
                        onChange={(e) => setBulkScores({ ...bulkScores, [student.id]: Number(e.target.value) })}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-xl text-sm font-bold w-24 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs text-slate-400">/100</span>
                    </div>

                    <div className="md:col-span-4">
                      <input
                        type="text"
                        placeholder="Catatan tambahan..."
                        value={bulkNotes[student.id] || ''}
                        onChange={(e) => setBulkNotes({ ...bulkNotes, [student.id]: e.target.value })}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4 flex justify-end">
            <button
              onClick={handleSaveBulk}
              disabled={bulkStudents.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-emerald-600/10 transition-all flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Semua Nilai ({bulkStudents.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Single Grade Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg">{editingGrade ? 'Edit Nilai Siswa' : 'Tambah Nilai Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pilih Siswa</label>
                <select
                  disabled={!!editingGrade}
                  value={gradeForm.studentId}
                  onChange={(e) => setGradeForm({ ...gradeForm, studentId: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 disabled:opacity-60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map(s => {
                    const c = classes.find(cls => cls.id === s.classId);
                    return (
                      <option key={s.id} value={s.id}>{s.name} ({c ? c.name : ''})</option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mata Pelajaran</label>
                  <select
                    value={gradeForm.subject}
                    onChange={(e) => setGradeForm({ ...gradeForm, subject: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                  >
                    {subjects.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    <option value="Lainnya">Lainnya...</option>
                  </select>
                  {gradeForm.subject === 'Lainnya' && (
                    <div className="mt-2 space-y-1 animate-fadeIn">
                      <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block">Tulis Pelajaran Manual</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Bahasa Daerah"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Jenis Evaluasi</label>
                  <select
                    value={gradeForm.type}
                    onChange={(e) => setGradeForm({ ...gradeForm, type: e.target.value as any })}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                  >
                    <option value="Tugas">Tugas</option>
                    <option value="Ulangan">Ulangan</option>
                    <option value="UTS">UTS</option>
                    <option value="UAS">UAS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Skor Nilai (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={gradeForm.score}
                    onChange={(e) => setGradeForm({ ...gradeForm, score: Number(e.target.value) })}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={gradeForm.date}
                    onChange={(e) => setGradeForm({ ...gradeForm, date: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Catatan Nilai</label>
                <input
                  type="text"
                  placeholder="e.g. Kuis Aljabar dasar"
                  value={gradeForm.notes}
                  onChange={(e) => setGradeForm({ ...gradeForm, notes: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
                >
                  {editingGrade ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
