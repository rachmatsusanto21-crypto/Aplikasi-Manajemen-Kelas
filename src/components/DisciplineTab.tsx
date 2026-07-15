/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Student, SchoolClass, DisciplineRecord } from '../types';
import { 
  AlertCircle, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  X, 
  Save, 
  Calendar,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Award,
  Users
} from 'lucide-react';
import { getAccessToken, googleSignIn } from '../firebase';
import { exportToGoogleSheets, importFromGoogleSheets, SheetExportPayload } from '../googleDrive';

export const VIOLATION_RULES: { [key: string]: { corrective: string; recurring: string } } = {
  "Terlambat Masuk Sekolah": {
    corrective: "Teguran lisan, menuliskan janji tidak mengulangi, dan langsung masuk kelas setelah mendapat izin.",
    recurring: "Pemanggilan orang tua oleh wali kelas, membuat surat pernyataan tertulis, dan tugas kebersihan sekolah selama 15 menit sebelum masuk kelas."
  },
  "Tidak Memakai Seragam Lengkap / Rapi": {
    corrective: "Merapikan seragam di tempat dan teguran lisan oleh guru piket.",
    recurring: "Pemanggilan orang tua untuk membawakan seragam yang sesuai, serta teguran tertulis."
  },
  "Meninggalkan Kelas Tanpa Izin": {
    corrective: "Nasihat oleh guru kelas dan penugasan akademik tambahan yang tertinggal.",
    recurring: "Pemanggilan orang tua dan bimbingan khusus bersama guru BK / Wali Kelas."
  },
  "Membuang Sampah Sembarangan": {
    corrective: "Mengambil sampah tersebut dan membersihkan area sekitar sejauh 5 meter.",
    recurring: "Tugas kebersihan area sekolah (menyapu/membuang sampah di tempat sampah) selama 3 hari berturut-turut pada jam istirahat."
  },
  "Membuat Kegaduhan di Kelas": {
    corrective: "Ditegur secara lisan, dipindahkan tempat duduknya, atau diberi waktu menenangkan diri.",
    recurring: "Pemanggilan orang tua untuk membuat kesepakatan pembinaan bersama wali kelas."
  },
  "Membawa Barang yang Dilarang (HP/Mainan)": {
    corrective: "Penyitaan barang sementara oleh guru kelas untuk dikembalikan di akhir jam pelajaran.",
    recurring: "Penyitaan barang hingga diambil langsung oleh orang tua siswa yang bersangkutan disertai pembuatan surat perjanjian."
  },
  "Merusak Fasilitas Sekolah": {
    corrective: "Membersihkan atau merapikan kembali fasilitas yang dirusak, disertai teguran lisan.",
    recurring: "Kewajiban mengganti kerusakan bersama orang tua siswa, serta skorsing atau sanksi sosial yang mendidik."
  },
  "Perkelahian / Perundungan (Bullying)": {
    corrective: "Pemisahan segera, pembinaan lisan, mediasi antara kedua belah pihak, dan permintaan maaf secara tertulis.",
    recurring: "Pemanggilan orang tua secara formal, skorsing sementara, dan pendampingan psikologis intensif."
  }
};

interface DisciplineTabProps {
  classes: SchoolClass[];
  students: Student[];
  disciplineRecords: DisciplineRecord[];
  onAddDisciplineRecord: (rec: Omit<DisciplineRecord, 'id'>) => void;
  onEditDisciplineRecord: (rec: DisciplineRecord) => void;
  onDeleteDisciplineRecord: (id: string) => void;
  onOverwriteDisciplineRecords: (recs: DisciplineRecord[]) => void;
}

export default function DisciplineTab({
  classes,
  students,
  disciplineRecords,
  onAddDisciplineRecord,
  onEditDisciplineRecord,
  onDeleteDisciplineRecord,
  onOverwriteDisciplineRecords,
}: DisciplineTabProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all'); // "01" - "12"

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRecapOpen, setIsRecapOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  // Form State
  const [editingRecord, setEditingRecord] = useState<DisciplineRecord | null>(null);
  const [formClassId, setFormClassId] = useState<string>('');
  const [formStudentId, setFormStudentId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formViolationType, setFormViolationType] = useState<string>('Terlambat Masuk Sekolah');
  const [formNotes, setFormNotes] = useState<string>('');

  // Sheets sync states
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');

  // Setup initial class ID for forms
  React.useEffect(() => {
    if (classes.length > 0 && !formClassId) {
      setFormClassId(classes[0].id);
    }
  }, [classes, formClassId]);

  // Filter students by class in Form
  const formClassStudents = useMemo(() => {
    return students.filter(s => s.classId === formClassId);
  }, [students, formClassId]);

  // Setup initial student ID when formClassStudents changes
  React.useEffect(() => {
    if (formClassStudents.length > 0) {
      setFormStudentId(formClassStudents[0].id);
    } else {
      setFormStudentId('');
    }
  }, [formClassStudents]);

  // Auto calculate corrective and recurring sanction based on selection
  const previousViolationCount = useMemo(() => {
    if (!formStudentId || !formViolationType) return 0;
    // Count previous violations of this type for this student (excluding the one being edited, if editing)
    return disciplineRecords.filter(r => 
      r.studentId === formStudentId && 
      r.violationType === formViolationType && 
      (!editingRecord || r.id !== editingRecord.id)
    ).length;
  }, [disciplineRecords, formStudentId, formViolationType, editingRecord]);

  const computedCorrective = useMemo(() => {
    return VIOLATION_RULES[formViolationType]?.corrective || "Teguran lisan oleh guru kelas.";
  }, [formViolationType]);

  const computedRecurring = useMemo(() => {
    // If previousCount >= 2 (so this makes it the 3rd time or more), trigger recurring sanction
    if (previousViolationCount >= 2) {
      return VIOLATION_RULES[formViolationType]?.recurring || "Pemanggilan orang tua siswa untuk koordinasi pembinaan.";
    }
    return "";
  }, [formViolationType, previousViolationCount]);

  // Filter main list
  const filteredRecords = useMemo(() => {
    return disciplineRecords.filter(rec => {
      // Class filter
      if (selectedClassId !== 'all' && rec.classId !== selectedClassId) return false;
      
      // Month filter
      if (filterMonth !== 'all') {
        const month = rec.date.split('-')[1]; // YYYY-MM-DD
        if (month !== filterMonth) return false;
      }

      // Student search filter
      if (searchQuery.trim()) {
        const student = students.find(s => s.id === rec.studentId);
        if (!student || !student.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Latest first
  }, [disciplineRecords, selectedClassId, filterMonth, searchQuery, students]);

  // Open Form for Adding
  const openAddForm = () => {
    setEditingRecord(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormViolationType(Object.keys(VIOLATION_RULES)[0]);
    setFormNotes('');
    if (classes.length > 0) {
      setFormClassId(classes[0].id);
    }
    setIsFormOpen(true);
  };

  // Open Form for Editing
  const openEditForm = (rec: DisciplineRecord) => {
    setEditingRecord(rec);
    setFormClassId(rec.classId);
    setFormStudentId(rec.studentId);
    setFormDate(rec.date);
    setFormViolationType(rec.violationType);
    setFormNotes(rec.notes);
    setIsFormOpen(true);
  };

  // Handle Save Form
  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId) {
      alert("Pilih siswa terlebih dahulu!");
      return;
    }

    const payload = {
      date: formDate,
      studentId: formStudentId,
      classId: formClassId,
      violationType: formViolationType,
      correctiveAction: computedCorrective,
      recurringSanction: computedRecurring,
      notes: formNotes
    };

    if (editingRecord) {
      onEditDisciplineRecord({
        ...editingRecord,
        ...payload
      });
      alert("Berhasil memperbarui catatan pelanggaran disiplin.");
    } else {
      onAddDisciplineRecord(payload);
      alert("Berhasil menambahkan catatan pelanggaran disiplin.");
    }
    setIsFormOpen(false);
  };

  // Monthly Recap calculation
  const monthlyRecap = useMemo(() => {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    const stats: { [key: string]: { count: number; studentCounts: { [name: string]: number }; violationCounts: { [type: string]: number } } } = {};
    
    disciplineRecords.forEach(rec => {
      const dateObj = new Date(rec.date);
      if (isNaN(dateObj.getTime())) return;
      
      const monthIdx = dateObj.getMonth();
      const monthYear = `${months[monthIdx]} ${dateObj.getFullYear()}`;
      
      if (!stats[monthYear]) {
        stats[monthYear] = {
          count: 0,
          studentCounts: {},
          violationCounts: {}
        };
      }
      
      stats[monthYear].count++;
      
      const student = students.find(s => s.id === rec.studentId);
      const studentName = student ? student.name : 'Siswa Terhapus';
      
      stats[monthYear].studentCounts[studentName] = (stats[monthYear].studentCounts[studentName] || 0) + 1;
      stats[monthYear].violationCounts[rec.violationType] = (stats[monthYear].violationCounts[rec.violationType] || 0) + 1;
    });

    return Object.entries(stats).map(([monthYear, item]) => {
      // Find top student
      let topStudent = '-';
      let maxStudentCount = 0;
      Object.entries(item.studentCounts).forEach(([name, val]) => {
        if (val > maxStudentCount) {
          maxStudentCount = val;
          topStudent = `${name} (${val}x)`;
        }
      });

      // Find top violation
      let topViolation = '-';
      let maxViolationCount = 0;
      Object.entries(item.violationCounts).forEach(([type, val]) => {
        if (val > maxViolationCount) {
          maxViolationCount = val;
          topViolation = `${type} (${val}x)`;
        }
      });

      return {
        monthYear,
        count: item.count,
        topStudent,
        topViolation
      };
    });
  }, [disciplineRecords, students]);

  // Sheets Export Flow
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

    setIsExporting(true);
    try {
      const headerRow = [
        'No', 'Tanggal', 'Nama Siswa', 'Kelas', 'Jenis Pelanggaran', 'Tindakan Korektif', 'Sanksi Pelanggaran Berulang', 'Catatan Keterangan'
      ];

      const rows = filteredRecords.map((r, idx) => {
        const student = students.find(s => s.id === r.studentId);
        const clsName = classes.find(c => c.id === r.classId)?.name || '-';
        return [
          (idx + 1).toString(),
          r.date,
          student ? student.name : 'Siswa Tidak Ditemukan',
          clsName,
          r.violationType,
          r.correctiveAction,
          r.recurringSanction || 'Tidak ada',
          r.notes || ''
        ];
      });

      const payload: SheetExportPayload = {
        title: `Catatan Pelanggaran Disiplin Kelas - ${new Date().toLocaleDateString('id-ID')}`,
        headers: headerRow,
        rows: rows
      };

      const url = await exportToGoogleSheets(token, payload);
      setIsExporting(false);
      window.open(url, '_blank');
      alert('Berhasil mengekspor catatan pelanggaran ke Google Sheets!');
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengekspor catatan: ' + error.message);
      setIsExporting(false);
    }
  };

  // Sheets Import Flow
  const handleImportSheets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) {
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

    let spreadsheetId = sheetUrl.trim();
    const matches = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (matches && matches[1]) {
      spreadsheetId = matches[1];
    }

    setIsImporting(true);
    try {
      const rawRows = await importFromGoogleSheets(token, spreadsheetId, 'Sheet1!A1:H500');
      if (rawRows.length < 2) {
        alert('Data Google Sheet kosong atau tidak valid (minimal butuh baris header dan 1 baris data).');
        setIsImporting(false);
        return;
      }

      const headers = rawRows[0].map(h => h.trim().toLowerCase());
      
      let dateIdx = headers.findIndex(h => h.includes('tanggal') || h.includes('date'));
      let nameIdx = headers.findIndex(h => h.includes('siswa') || h.includes('name'));
      let classIdx = headers.findIndex(h => h.includes('kelas') || h.includes('class'));
      let violationIdx = headers.findIndex(h => h.includes('pelanggaran') || h.includes('violation'));
      let correctiveIdx = headers.findIndex(h => h.includes('korektif') || h.includes('corrective'));
      let recurringIdx = headers.findIndex(h => h.includes('berulang') || h.includes('sanksi') || h.includes('recurring'));
      let notesIdx = headers.findIndex(h => h.includes('catatan') || h.includes('keterangan') || h.includes('notes'));

      if (dateIdx === -1 || nameIdx === -1 || violationIdx === -1) {
        alert('Gagal mencocokkan kolom! Pastikan Google Sheet Anda memiliki baris header dengan minimal kolom: Tanggal (Date), Nama Siswa (Siswa), Jenis Pelanggaran (Pelanggaran).');
        setIsImporting(false);
        return;
      }

      const dataRows = rawRows.slice(1);
      const importedRecords: DisciplineRecord[] = [...disciplineRecords];
      let addedCount = 0;
      let updatedCount = 0;

      dataRows.forEach((row) => {
        const dateVal = row[dateIdx]?.trim();
        const studentNameVal = row[nameIdx]?.trim();
        const violationVal = row[violationIdx]?.trim();

        if (!dateVal || !studentNameVal || !violationVal) return;

        // Try matching student
        const studentObj = students.find(s => s.name.toLowerCase() === studentNameVal.toLowerCase());
        if (!studentObj) return; // Skip if student not found in current local database to prevent orphaned records

        const classId = studentObj.classId;
        const correctiveVal = correctiveIdx !== -1 ? row[correctiveIdx]?.trim() : (VIOLATION_RULES[violationVal]?.corrective || 'Teguran lisan.');
        const recurringVal = recurringIdx !== -1 ? row[recurringIdx]?.trim() : '';
        const notesVal = notesIdx !== -1 ? row[notesIdx]?.trim() || '' : '';

        // Check if matching entry already exists to update
        const existingIdx = importedRecords.findIndex(r => 
          r.date === dateVal && 
          r.studentId === studentObj.id && 
          r.violationType.toLowerCase() === violationVal.toLowerCase()
        );

        const payload: DisciplineRecord = {
          id: existingIdx !== -1 ? importedRecords[existingIdx].id : 'disc_' + Math.random().toString(36).substr(2, 9),
          date: dateVal,
          studentId: studentObj.id,
          classId: classId,
          violationType: violationVal,
          correctiveAction: correctiveVal || '',
          recurringSanction: recurringVal || '',
          notes: notesVal
        };

        if (existingIdx !== -1) {
          importedRecords[existingIdx] = payload;
          updatedCount++;
        } else {
          importedRecords.push(payload);
          addedCount++;
        }
      });

      onOverwriteDisciplineRecords(importedRecords);
      alert(`Berhasil mengimpor data! ${addedCount} data baru ditambahkan, ${updatedCount} data diperbarui.`);
      setIsImportOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('Gagal mengimpor dari Sheets: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Stats Card data
  const overallStats = useMemo(() => {
    const total = disciplineRecords.length;
    const currentMonth = new Date().toISOString().split('-')[1];
    const totalThisMonth = disciplineRecords.filter(r => r.date.split('-')[1] === currentMonth).length;
    
    // Most repeated violation
    const violationMap: { [key: string]: number } = {};
    disciplineRecords.forEach(r => {
      violationMap[r.violationType] = (violationMap[r.violationType] || 0) + 1;
    });
    
    let topViolation = '-';
    let maxCount = 0;
    Object.entries(violationMap).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topViolation = type;
      }
    });

    return { total, totalThisMonth, topViolation, maxCount };
  }, [disciplineRecords]);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center space-x-4">
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black block">Total Pelanggaran</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{overallStats.total} <span className="text-xs font-semibold text-slate-400">Kasus</span></span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center space-x-4">
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-2xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black block">Bulan Ini</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{overallStats.totalThisMonth} <span className="text-xs font-semibold text-slate-400">Kasus</span></span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center space-x-4 md:col-span-2">
          <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-black block">Pelanggaran Terbanyak</span>
            <span className="text-sm font-bold text-slate-800 dark:text-white leading-snug block truncate" title={overallStats.topViolation}>
              {overallStats.topViolation}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-semibold">Telah terjadi sebanyak {overallStats.maxCount} kali</span>
          </div>
        </div>
      </div>

      {/* Control Header Actions Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Filter left */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-2xl">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-100 focus:outline-none w-36"
            />
          </div>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-2 rounded-2xl text-xs font-bold focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Semua Kelas</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-2 rounded-2xl text-xs font-bold focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Semua Bulan</option>
            <option value="01">Januari</option>
            <option value="02">Februari</option>
            <option value="03">Maret</option>
            <option value="04">April</option>
            <option value="05">Mei</option>
            <option value="06">Juni</option>
            <option value="07">Juli</option>
            <option value="08">Agustus</option>
            <option value="09">September</option>
            <option value="10">Oktober</option>
            <option value="11">November</option>
            <option value="12">Desember</option>
          </select>
        </div>

        {/* Buttons Right */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsRecapOpen(true)}
            className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Rekap Bulanan</span>
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Impor Sheets</span>
          </button>

          <button
            onClick={handleExportSheets}
            disabled={isExporting}
            className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-750 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor Sheets'}</span>
          </button>

          <button
            onClick={openAddForm}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-2xl text-xs font-extrabold flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/10"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pelanggaran</span>
          </button>
        </div>
      </div>

      {/* Main Tabular Board */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                <th className="py-4 px-4 w-12 text-center">No</th>
                <th className="py-4 px-3 w-28">Tanggal</th>
                <th className="py-4 px-3 w-48">Nama Siswa</th>
                <th className="py-4 px-3 w-24">Kelas</th>
                <th className="py-4 px-3 w-48">Jenis Pelanggaran</th>
                <th className="py-4 px-3">Tindakan Korektif</th>
                <th className="py-4 px-3">Sanksi Berulang</th>
                <th className="py-4 px-3 w-16 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((rec, index) => {
                  const student = students.find(s => s.id === rec.studentId);
                  const clsName = classes.find(c => c.id === rec.classId)?.name || '-';
                  
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-bold">{index + 1}</td>
                      <td className="py-3 px-3 font-semibold text-slate-600 dark:text-slate-400">
                        {new Date(rec.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs">{student ? student.name : 'Siswa Terhapus'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{student ? `NISN: ${student.nisn}` : '-'}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-indigo-600 dark:text-indigo-400">{clsName}</td>
                      <td className="py-3 px-3 text-rose-600 dark:text-rose-400 font-bold leading-relaxed">
                        {rec.violationType}
                      </td>
                      <td className="py-3 px-3 leading-relaxed font-semibold">
                        {rec.correctiveAction}
                        {rec.notes && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-1 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                            Ket: {rec.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 leading-relaxed">
                        {rec.recurringSanction ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold flex items-start gap-1 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-xl border border-amber-100/30">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>{rec.recurringSanction}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => openEditForm(rec)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-all"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Hapus catatan pelanggaran siswa ini?`)) {
                                onDeleteDisciplineRecord(rec.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2.5" />
                    Tidak ada data catatan pelanggaran disiplin yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Creation Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg">{editingRecord ? 'Edit Catatan Pelanggaran' : 'Catat Pelanggaran Disiplin Siswa'}</h3>
              <button onClick={() => setIsFormOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="p-6 space-y-4 max-h-[520px] overflow-y-auto">
              
              {/* Select Class & Student */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Pilih Kelas</label>
                  <select
                    value={formClassId}
                    onChange={(e) => setFormClassId(e.target.value)}
                    disabled={!!editingRecord}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Pilih Nama Siswa</label>
                  <select
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                    disabled={!!editingRecord}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500 font-extrabold"
                  >
                    {formClassStudents.length === 0 ? (
                      <option value="">- Tidak ada siswa di kelas ini -</option>
                    ) : (
                      formClassStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.nisn})</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Date & Violation Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Tanggal Kejadian</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Jenis Pelanggaran</label>
                  <select
                    value={formViolationType}
                    onChange={(e) => setFormViolationType(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    {Object.keys(VIOLATION_RULES).map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Automated Previews */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-indigo-500 text-white font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md">
                    Sistem Otomatis
                  </span>
                  {previousViolationCount > 0 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold">
                      Pernah melanggar jenis ini: {previousViolationCount} kali
                    </span>
                  )}
                </div>

                <div className="space-y-2 pt-1 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block">TINDAKAN KOREKTIF (LANGSUNG)</span>
                    <p className="font-extrabold text-slate-800 dark:text-white bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 leading-relaxed">
                      {computedCorrective}
                    </p>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 block">SANKSI PELANGGARAN BERULANG (&gt; 2 KALI)</span>
                    {previousViolationCount >= 2 ? (
                      <div className="font-extrabold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/50 leading-relaxed flex items-start gap-1.5 animate-pulse">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="block text-[9px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-500 mb-0.5">Sanksi Berulang Diaktifkan</span>
                          {computedRecurring}
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 dark:text-slate-500 italic px-1">
                        Sanksi berulang belum aktif (Siswa baru melanggar {previousViolationCount + 1}x termasuk ini. Sanksi aktif otomatis jika pelanggaran harian &gt; 2x).
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes / Keterangan */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Catatan Tambahan (Kronologi / Informasi Tambahan)</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Siswa terlambat karena ban sepedanya bocor saat perjalanan, atau kronologi lainnya."
                  rows={2}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-600/20 transition-all"
                >
                  {editingRecord ? 'Simpan Perubahan' : 'Simpan Catatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Monthly Recap Viewer Modal */}
      {isRecapOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-slate-750 to-slate-900 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <span>Ringkasan & Rekap Bulanan Pelanggaran</span>
              </h3>
              <button onClick={() => setIsRecapOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[480px] overflow-y-auto">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Gunakan tabel rekap ini untuk melihat kecenderungan perilaku pelanggaran ketertiban sekolah secara berkala setiap bulannya sebagai dasar rapat komite atau konseling siswa.
                </p>
              </div>

              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[9px] font-black tracking-wider">
                      <th className="py-3 px-4">Bulan & Tahun</th>
                      <th className="py-3 px-3 text-center">Jumlah Kasus</th>
                      <th className="py-3 px-3">Siswa Paling Sering Melanggar</th>
                      <th className="py-3 px-3">Jenis Pelanggaran Terbanyak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {monthlyRecap.length > 0 ? (
                      monthlyRecap.map((stat, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{stat.monthYear}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-full text-[10px] font-black">
                              {stat.count} Kasus
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-semibold">{stat.topStudent}</td>
                          <td className="py-3 px-3 text-amber-600 dark:text-amber-400 font-semibold leading-relaxed">{stat.topViolation}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                          Belum ada catatan pelanggaran yang diinput untuk melakukan rekap harian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsRecapOpen(false)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  Tutup Rekap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sheets Import Link Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Impor dari Google Sheets</span>
              </h3>
              <button onClick={() => setIsImportOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSheets} className="p-6 space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/30 p-3.5 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-400 leading-relaxed">
                Masukkan tautan edit Google Sheet Anda. Pastikan baris pertama (header) berisi nama kolom seperti: 
                <strong> Tanggal, Nama Siswa, Jenis Pelanggaran, Catatan Keterangan.</strong>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Tautan / ID Spreadsheet Google</label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isImporting ? 'Mengimpor data...' : 'Mulai Impor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
