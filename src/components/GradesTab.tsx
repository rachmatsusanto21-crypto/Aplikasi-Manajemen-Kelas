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
  Grid,
  FileSpreadsheet,
  FileUp,
  Download,
  Upload,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { getAccessToken, googleSignIn } from '../firebase';
import { exportToGoogleSheets, importFromGoogleSheets, SheetExportPayload } from '../googleDrive';

interface GradesTabProps {
  students: Student[];
  classes: SchoolClass[];
  grades: Grade[];
  onAddGrade: (grade: Omit<Grade, 'id'>) => void;
  onEditGrade: (grade: Grade) => void;
  onDeleteGrade: (id: string) => void;
  onBulkAddGrades: (grades: Omit<Grade, 'id'>[]) => void;
  onOverwriteGrades: (grades: Grade[]) => void;
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
  onOverwriteGrades,
  kkm,
  onUpdateKkm,
}: GradesTabProps) {
  const [activeTab, setActiveTab] = useState<'view' | 'bulk' | 'remedial' | 'enrichment' | 'recap'>('view');

  // States for Remedial / Enrichment Tabs
  const [remedialClassId, setRemedialClassId] = useState<string>('all');
  const [remedialSubject, setRemedialSubject] = useState<string>('all');
  const [remedialType, setRemedialType] = useState<string>('all');
  const [remedialSearchQuery, setRemedialSearchQuery] = useState<string>('');

  const [enrichmentClassId, setEnrichmentClassId] = useState<string>('all');
  const [enrichmentSubject, setEnrichmentSubject] = useState<string>('all');
  const [enrichmentType, setEnrichmentType] = useState<string>('all');
  const [enrichmentSearchQuery, setEnrichmentSearchQuery] = useState<string>('');

  // Persistent Action states mapping gradeId to chosen Action
  const [remedialActions, setRemedialActions] = useState<{[gradeId: string]: string}>(() => {
    try {
      return JSON.parse(localStorage.getItem('remedial_actions') || '{}');
    } catch {
      return {};
    }
  });

  const [enrichmentActions, setEnrichmentActions] = useState<{[gradeId: string]: string}>(() => {
    try {
      return JSON.parse(localStorage.getItem('enrichment_actions') || '{}');
    } catch {
      return {};
    }
  });

  // Action handlers
  const handleSetRemedialAction = (gradeId: string, action: string) => {
    const updated = { ...remedialActions, [gradeId]: action };
    setRemedialActions(updated);
    localStorage.setItem('remedial_actions', JSON.stringify(updated));
  };

  const handleSetEnrichmentAction = (gradeId: string, action: string) => {
    const updated = { ...enrichmentActions, [gradeId]: action };
    setEnrichmentActions(updated);
    localStorage.setItem('enrichment_actions', JSON.stringify(updated));
  };
  
  // Filters for View Tab
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // States and Helpers for Rekap Nilai Tab
  const [recapClassId, setRecapClassId] = useState<string>(classes[0]?.id || 'all');
  const [recapSubject, setRecapSubject] = useState<string>('Matematika');
  const [isExportingRecap, setIsExportingRecap] = useState(false);
  const [isImportingRecap, setIsImportingRecap] = useState(false);
  const [importRecapSheetUrl, setImportRecapSheetUrl] = useState('');
  const [isImportRecapOpen, setIsImportRecapOpen] = useState(false);

  // Helper to find unique assessment keys for Rekap Nilai
  const getColumnsForType = (type: 'Tugas' | 'Ulangan' | 'UTS' | 'UAS') => {
    const typeGrades = grades.filter(g => {
      const student = students.find(s => s.id === g.studentId);
      const matchesClass = recapClassId === 'all' || (student && student.classId === recapClassId);
      return g.subject === recapSubject && g.type === type && matchesClass;
    });
    
    const uniqueKeys = new Map<string, { date: string, notes: string }>();
    typeGrades.forEach(g => {
      const key = `${g.date}_${g.notes || ''}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.set(key, { date: g.date, notes: g.notes || '' });
      }
    });
    
    return Array.from(uniqueKeys.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const tugasCols = useMemo(() => getColumnsForType('Tugas'), [grades, students, recapClassId, recapSubject]);
  const ulanganCols = useMemo(() => getColumnsForType('Ulangan'), [grades, students, recapClassId, recapSubject]);
  const utsCols = useMemo(() => getColumnsForType('UTS'), [grades, students, recapClassId, recapSubject]);
  const uasCols = useMemo(() => getColumnsForType('UAS'), [grades, students, recapClassId, recapSubject]);

  const getStudentGrade = (studentId: string, type: 'Tugas' | 'Ulangan' | 'UTS' | 'UAS', col: { date: string, notes: string }) => {
    return grades.find(g => 
      g.studentId === studentId && 
      g.subject === recapSubject && 
      g.type === type && 
      g.date === col.date && 
      (g.notes || '') === col.notes
    );
  };

  const getStudentAverage = (studentId: string) => {
    const studentGrades = grades.filter(g => g.studentId === studentId && g.subject === recapSubject);
    if (studentGrades.length === 0) return '-';
    const sum = studentGrades.reduce((acc, g) => acc + g.score, 0);
    return (sum / studentGrades.length).toFixed(1);
  };

  const handleExportRecap = async () => {
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
    
    setIsExportingRecap(true);
    try {
      const recapStudents = students.filter(s => recapClassId === 'all' || s.classId === recapClassId);
      
      const headerRow1 = [
        'No', 'Nama Siswa', 'NISN',
        ...tugasCols.map((_, idx) => `Tugas ${idx + 1}`),
        ...ulanganCols.map((_, idx) => `Ulangan Harian ${idx + 1}`),
        ...utsCols.map((_, idx) => `UTS ${idx + 1}`),
        ...uasCols.map((_, idx) => `UAS ${idx + 1}`),
        'Rata-rata Akhir'
      ];
      
      const headerRow2 = [
        '', '', '',
        ...tugasCols.map(c => `${c.date}${c.notes ? ' (' + c.notes + ')' : ''}`),
        ...ulanganCols.map(c => `${c.date}${c.notes ? ' (' + c.notes + ')' : ''}`),
        ...utsCols.map(c => `${c.date}${c.notes ? ' (' + c.notes + ')' : ''}`),
        ...uasCols.map(c => `${c.date}${c.notes ? ' (' + c.notes + ')' : ''}`),
        ''
      ];
      
      const rows = recapStudents.map((s, sIdx) => {
        return [
          (sIdx + 1).toString(),
          s.name,
          s.nisn || '-',
          ...tugasCols.map(col => {
            const g = getStudentGrade(s.id, 'Tugas', col);
            return g ? g.score.toString() : '';
          }),
          ...ulanganCols.map(col => {
            const g = getStudentGrade(s.id, 'Ulangan', col);
            return g ? g.score.toString() : '';
          }),
          ...utsCols.map(col => {
            const g = getStudentGrade(s.id, 'UTS', col);
            return g ? g.score.toString() : '';
          }),
          ...uasCols.map(col => {
            const g = getStudentGrade(s.id, 'UAS', col);
            return g ? g.score.toString() : '';
          }),
          getStudentAverage(s.id).toString()
        ];
      });
      
      const payload: SheetExportPayload = {
        title: `Rekap Nilai ${recapSubject} - ${classes.find(c => c.id === recapClassId)?.name || 'Semua Kelas'}`,
        headers: headerRow1,
        rows: [headerRow2, ...rows]
      };
      
      let sheetUrl = '';
      try {
        sheetUrl = await exportToGoogleSheets(token, payload);
      } catch (innerErr: any) {
        if (innerErr?.message === "UNAUTHORIZED_OR_EXPIRED") {
          const authRes = await googleSignIn();
          if (authRes && authRes.accessToken) {
            token = authRes.accessToken;
            sheetUrl = await exportToGoogleSheets(token, payload);
          } else {
            throw new Error("Sesi Google Sheets kedaluwarsa atau kurang izin. Silakan hubungkan kembali akun Google Anda.");
          }
        } else {
          throw innerErr;
        }
      }

      alert('Rekap Nilai berhasil diekspor ke Google Sheets!');
      window.open(sheetUrl, '_blank');
    } catch (err: any) {
      console.error('Sheets recap export failed:', err);
      alert(`Gagal mengekspor data ke Google Sheets: ${err.message}`);
    } finally {
      setIsExportingRecap(false);
    }
  };

  const handleImportRecap = async () => {
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

    if (!importRecapSheetUrl) {
      alert('Silakan masukkan URL atau ID Google Sheets terlebih dahulu!');
      return;
    }

    let spreadsheetId = importRecapSheetUrl.trim();
    const sheetUrlRegex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = spreadsheetId.match(sheetUrlRegex);
    if (match && match[1]) {
      spreadsheetId = match[1];
    }

    if (spreadsheetId.length < 15) {
      alert('Format URL atau ID Google Sheets tidak valid. Silakan periksa kembali!');
      return;
    }

    setIsImportingRecap(true);
    try {
      const range = 'Sheet1!A1:Z500';
      let rawRows;
      try {
        rawRows = await importFromGoogleSheets(token, spreadsheetId, range);
      } catch (innerErr: any) {
        if (innerErr?.message === "UNAUTHORIZED_OR_EXPIRED") {
          const authRes = await googleSignIn();
          if (authRes && authRes.accessToken) {
            token = authRes.accessToken;
            rawRows = await importFromGoogleSheets(token, spreadsheetId, range);
          } else {
            throw new Error("Sesi Google Sheets kedaluwarsa atau kurang izin. Silakan hubungkan kembali akun Google Anda.");
          }
        } else {
          throw innerErr;
        }
      }

      if (!rawRows || rawRows.length < 2) {
        alert('Format spreadsheet tidak sesuai (minimal harus ada baris header kategori dan baris tanggal).');
        setIsImportingRecap(false);
        return;
      }

      const headerRow1 = rawRows[0];
      const headerRow2 = rawRows[1];
      const dataRows = rawRows.slice(2);

      if (dataRows.length === 0) {
        alert('Tidak ada baris data siswa yang ditemukan untuk diimpor.');
        setIsImportingRecap(false);
        return;
      }

      const nisnIdx = headerRow1.findIndex(h => h && h.toLowerCase().includes('nisn'));
      const nameIdx = headerRow1.findIndex(h => h && (h.toLowerCase().includes('nama') || h.toLowerCase().includes('siswa')));

      if (nameIdx === -1) {
        alert('Gagal mengimpor: Kolom "Nama Siswa" tidak ditemukan di baris pertama.');
        setIsImportingRecap(false);
        return;
      }

      const gradeCols: {
        index: number;
        type: 'Tugas' | 'Ulangan' | 'UTS' | 'UAS';
        date: string;
        notes: string;
      }[] = [];

      for (let i = 0; i < headerRow1.length; i++) {
        const cat = headerRow1[i]?.trim();
        const det = headerRow2[i]?.trim() || '';

        if (!cat) continue;
        if (i === nisnIdx || i === nameIdx) continue;
        if (cat.toLowerCase().includes('no') || cat.toLowerCase().includes('rata-rata') || cat.toLowerCase().includes('akhir')) {
          continue;
        }

        let type: 'Tugas' | 'Ulangan' | 'UTS' | 'UAS' | null = null;
        if (cat.toLowerCase().includes('tugas')) {
          type = 'Tugas';
        } else if (cat.toLowerCase().includes('ulangan') || cat.toLowerCase().includes('uh')) {
          type = 'Ulangan';
        } else if (cat.toLowerCase().includes('uts')) {
          type = 'UTS';
        } else if (cat.toLowerCase().includes('uas')) {
          type = 'UAS';
        }

        if (!type) continue;

        let date = new Date().toISOString().split('T')[0];
        let notes = '';

        const parenthesizedMatch = det.match(/^([^(]+)(?:\(([^)]+)\))?$/);
        if (parenthesizedMatch) {
          const rawDate = parenthesizedMatch[1].trim();
          const rawNotes = parenthesizedMatch[2]?.trim() || '';

          if (rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            date = rawDate;
          } else if (rawDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            const [d, m, y] = rawDate.split('/');
            date = `${y}-${m}-${d}`;
          } else {
            try {
              const p = new Date(rawDate);
              if (!isNaN(p.getTime())) {
                date = p.toISOString().split('T')[0];
              }
            } catch (e) {}
          }
          notes = rawNotes;
        } else {
          const parts = det.split(' ');
          if (parts[0]?.match(/^\d{4}-\d{2}-\d{2}$/)) {
            date = parts[0];
          }
          notes = parts.slice(1).join(' ').replace(/[()]/g, '').trim();
        }

        gradeCols.push({ index: i, type, date, notes });
      }

      const importedGrades = [...grades];
      let addedCount = 0;
      let updatedCount = 0;

      dataRows.forEach((row, rowIdx) => {
        const name = row[nameIdx]?.trim();
        const nisn = nisnIdx !== -1 ? row[nisnIdx]?.trim() : '';

        if (!name) return;

        const student = students.find(s => {
          const matchesNisn = nisn && s.nisn === nisn;
          const matchesName = s.name.toLowerCase() === name.toLowerCase();
          return matchesNisn || matchesName;
        });

        if (!student) return;

        gradeCols.forEach(col => {
          const scoreStr = row[col.index]?.trim();
          if (!scoreStr || scoreStr === '') return;

          const score = Number(scoreStr);
          if (isNaN(score)) return;

          const existingIdx = importedGrades.findIndex(g => 
            g.studentId === student.id &&
            g.subject === recapSubject &&
            g.type === col.type &&
            g.date === col.date &&
            (g.notes || '') === col.notes
          );

          if (existingIdx !== -1) {
            if (importedGrades[existingIdx].score !== score) {
              importedGrades[existingIdx] = { ...importedGrades[existingIdx], score };
              updatedCount++;
            }
          } else {
            importedGrades.push({
              id: 'g_sheet_recap_' + (Date.now() + rowIdx + Math.random().toString(36).substr(2, 5)),
              studentId: student.id,
              subject: recapSubject,
              type: col.type,
              score,
              date: col.date,
              notes: col.notes
            });
            addedCount++;
          }
        });
      });

      if (addedCount > 0 || updatedCount > 0) {
        onOverwriteGrades(importedGrades);
        alert(`Berhasil mengimpor Rekap Nilai! Baru: ${addedCount} data, Terupdate: ${updatedCount} data.`);
        setIsImportRecapOpen(false);
        setImportRecapSheetUrl('');
      } else {
        alert('Tidak ada data nilai baru atau perubahan terdeteksi.');
      }
    } catch (err: any) {
      console.error('Import recap error:', err);
      alert(`Gagal mengimpor Rekap Nilai: ${err.message}`);
    } finally {
      setIsImportingRecap(false);
    }
  };

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

  const subjects = ['Matematika', 'IPA', 'IPS', 'IPAS', 'Bahasa Indonesia', 'PJOK', 'Seni Budaya', 'Bahasa Inggris', 'Pendidikan Pancasila', 'Agama', 'Muatan Lokal'];

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

  // Filtered grades for Remedial Program (< KKM)
  const remedialGrades = useMemo(() => {
    return grades.filter(g => {
      if (g.score >= kkm) return false;
      const student = students.find(s => s.id === g.studentId);
      if (!student) return false;

      const matchesSearch = student.name.toLowerCase().includes(remedialSearchQuery.toLowerCase());
      const matchesClass = remedialClassId === 'all' || student.classId === remedialClassId;
      const matchesSubject = remedialSubject === 'all' || g.subject === remedialSubject;
      const matchesType = remedialType === 'all' || g.type === remedialType;

      return matchesSearch && matchesClass && matchesSubject && matchesType;
    });
  }, [grades, students, kkm, remedialClassId, remedialSubject, remedialType, remedialSearchQuery]);

  // Filtered grades for Enrichment Program (>= KKM)
  const enrichmentGrades = useMemo(() => {
    return grades.filter(g => {
      if (g.score < kkm) return false;
      const student = students.find(s => s.id === g.studentId);
      if (!student) return false;

      const matchesSearch = student.name.toLowerCase().includes(enrichmentSearchQuery.toLowerCase());
      const matchesClass = enrichmentClassId === 'all' || student.classId === enrichmentClassId;
      const matchesSubject = enrichmentSubject === 'all' || g.subject === enrichmentSubject;
      const matchesType = enrichmentType === 'all' || g.type === enrichmentType;

      return matchesSearch && matchesClass && matchesSubject && matchesType;
    });
  }, [grades, students, kkm, enrichmentClassId, enrichmentSubject, enrichmentType, enrichmentSearchQuery]);

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
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-700 gap-1">
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
        <button
          onClick={() => setActiveTab('remedial')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'remedial'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400 dark:border-rose-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span>Program Remedial (Nilai &lt; KKM)</span>
        </button>
        <button
          onClick={() => setActiveTab('enrichment')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'enrichment'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Program Pengayaan (Nilai &gt;= KKM)</span>
        </button>
        <button
          onClick={() => setActiveTab('recap')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'recap'
              ? 'border-violet-600 text-violet-600 dark:text-violet-400 dark:border-violet-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Rekap Nilai</span>
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
      ) : activeTab === 'bulk' ? (
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
      ) : activeTab === 'remedial' ? (
        // PROGRAM REMEDIAL VIEW
        <div className="space-y-4 animate-fadeIn">
          {/* Remedial Info & Controls */}
          <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-rose-800 dark:text-rose-300 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Program Remedial Aktif (Nilai di bawah KKM {kkm})</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Siswa dengan skor evaluasi lebih kecil dari standar ketuntasan ({kkm}) otomatis dikelompokkan di sini beserta tindakan tindak lanjutnya.
              </p>
            </div>
            <div className="flex items-center space-x-2 bg-rose-100/40 dark:bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900/30 text-xs font-semibold text-rose-700 dark:text-rose-400">
              <span>Rerata KKM Sekolah: {kkm}</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama siswa remedial..."
                  value={remedialSearchQuery}
                  onChange={(e) => setRemedialSearchQuery(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 pl-10 pr-4 py-2 rounded-xl text-sm w-full focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={remedialClassId}
                  onChange={(e) => setRemedialClassId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="all">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={remedialSubject}
                  onChange={(e) => setRemedialSubject(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="all">Semua Pelajaran</option>
                  {filterSubjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>

                <select
                  value={remedialType}
                  onChange={(e) => setRemedialType(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="all">Semua Jenis Evaluasi</option>
                  <option value="Tugas">Tugas</option>
                  <option value="Ulangan">Ulangan Harian</option>
                  <option value="UTS">UTS</option>
                  <option value="UAS">UAS</option>
                </select>
              </div>
            </div>
          </div>

          {/* List Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                    <th className="py-4 px-6">Nama Siswa</th>
                    <th className="py-4 px-6">Mata Pelajaran & Kelas</th>
                    <th className="py-4 px-6">Jenis Evaluasi</th>
                    <th className="py-4 px-6">Skor Awal</th>
                    <th className="py-4 px-6">Tindakan Remedial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {remedialGrades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Tidak ada siswa yang perlu bimbingan remedial untuk kriteria saat ini. Semua siswa tuntas! 🎉
                      </td>
                    </tr>
                  ) : (
                    remedialGrades.map((grade) => {
                      const student = students.find(s => s.id === grade.studentId);
                      const studentClass = student ? classes.find(c => c.id === student.classId) : null;
                      const isTugas = grade.type === 'Tugas';
                      
                      const currentAction = isTugas 
                        ? 'Penjelasan Ulang dan Penugasan'
                        : (remedialActions[grade.id] || 'Ujian Ulang');

                      return (
                        <tr key={grade.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="py-4 px-6">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{student ? student.name : 'Unknown'}</span>
                            <div className="text-xs text-slate-400">NISN: {student?.nisn || '-'}</div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-medium text-slate-700 dark:text-slate-300">{grade.subject}</div>
                            <div className="text-xs text-slate-400">Kelas: {studentClass ? studentClass.name : '-'}</div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              grade.type === 'Ulangan' 
                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600' 
                                : grade.type === 'Tugas' 
                                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600'
                                : 'bg-red-50 dark:bg-red-950/30 text-red-600'
                            }`}>
                              {grade.type === 'Ulangan' ? 'Ulangan Harian' : grade.type}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-black text-rose-600 dark:text-rose-400 text-base">{grade.score}</span>
                            <span className="text-xs text-slate-400 font-medium block">KKM: {kkm}</span>
                          </td>
                          <td className="py-4 px-6">
                            {isTugas ? (
                              <div className="inline-flex items-center space-x-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs px-3 py-2 rounded-xl border border-rose-100 dark:border-rose-900/40 font-bold">
                                <span>Penjelasan Ulang & Penugasan (Otomatis)</span>
                              </div>
                            ) : (
                              <select
                                value={currentAction}
                                onChange={(e) => handleSetRemedialAction(grade.id, e.target.value)}
                                className="bg-rose-50 dark:bg-slate-900 border border-rose-200 dark:border-slate-700 text-rose-700 dark:text-rose-300 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                              >
                                <option value="Ujian Ulang">Ujian Ulang</option>
                                <option value="Penjelasan Ulang dan Ujian Ulang">Penjelasan Ulang dan Ujian Ulang</option>
                                <option value="Penjelasan Ulang dan Penugasan">Penjelasan Ulang dan Penugasan</option>
                              </select>
                            )}
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
      ) : activeTab === 'enrichment' ? (
        // PROGRAM PENGAYAAN VIEW
        <div className="space-y-4 animate-fadeIn">
          {/* Enrichment Info & Controls */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Program Pengayaan Aktif (Nilai di atas/setara KKM {kkm})</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Siswa berprestasi dengan skor evaluasi di atas atau sama dengan standar ketuntasan ({kkm}) otomatis dikelompokkan di sini untuk mendapatkan materi pengayaan.
              </p>
            </div>
            <div className="flex items-center space-x-2 bg-emerald-100/40 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <span>Tuntas KKM: &gt;= {kkm}</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama siswa pengayaan..."
                  value={enrichmentSearchQuery}
                  onChange={(e) => setEnrichmentSearchQuery(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 pl-10 pr-4 py-2 rounded-xl text-sm w-full focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={enrichmentClassId}
                  onChange={(e) => setEnrichmentClassId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="all">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={enrichmentSubject}
                  onChange={(e) => setEnrichmentSubject(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="all">Semua Pelajaran</option>
                  {filterSubjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>

                <select
                  value={enrichmentType}
                  onChange={(e) => setEnrichmentType(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="all">Semua Jenis Evaluasi</option>
                  <option value="Tugas">Tugas</option>
                  <option value="Ulangan">Ulangan Harian</option>
                  <option value="UTS">UTS</option>
                  <option value="UAS">UAS</option>
                </select>
              </div>
            </div>
          </div>

          {/* List Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                    <th className="py-4 px-6">Nama Siswa</th>
                    <th className="py-4 px-6">Mata Pelajaran & Kelas</th>
                    <th className="py-4 px-6">Jenis Evaluasi</th>
                    <th className="py-4 px-6">Skor Perolehan</th>
                    <th className="py-4 px-6">Tindakan Pengayaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {enrichmentGrades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Tidak ada data siswa berprestasi yang memenuhi kriteria saat ini.
                      </td>
                    </tr>
                  ) : (
                    enrichmentGrades.map((grade) => {
                      const student = students.find(s => s.id === grade.studentId);
                      const studentClass = student ? classes.find(c => c.id === student.classId) : null;
                      
                      const currentAction = enrichmentActions[grade.id] || 'Eksplorasi Mandiri';

                      return (
                        <tr key={grade.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="py-4 px-6">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{student ? student.name : 'Unknown'}</span>
                            <div className="text-xs text-slate-400">NISN: {student?.nisn || '-'}</div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-medium text-slate-700 dark:text-slate-300">{grade.subject}</div>
                            <div className="text-xs text-slate-400">Kelas: {studentClass ? studentClass.name : '-'}</div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              grade.type === 'Ulangan' 
                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600' 
                                : grade.type === 'Tugas' 
                                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600'
                                : 'bg-red-50 dark:bg-red-950/30 text-red-600'
                            }`}>
                              {grade.type === 'Ulangan' ? 'Ulangan Harian' : grade.type}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">{grade.score}</span>
                            <span className="text-xs text-slate-400 font-medium block">Tuntas (&gt;= {kkm})</span>
                          </td>
                          <td className="py-4 px-6">
                            <select
                              value={currentAction}
                              onChange={(e) => handleSetEnrichmentAction(grade.id, e.target.value)}
                              className="bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            >
                              <option value="Eksplorasi Mandiri">Eksplorasi Mandiri</option>
                              <option value="Eksplorasi Terbimbing">Eksplorasi Terbimbing</option>
                              <option value="Pemecahan Kasus Kompleks">Pemecahan Kasus Kompleks</option>
                            </select>
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
        // REKAP NILAI VIEW
        <div className="space-y-4 animate-fadeIn">
          {/* Header Info Card */}
          <div className="bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-violet-800 dark:text-violet-300 flex items-center space-x-1.5">
                <FileSpreadsheet className="w-4 h-4 text-violet-600" />
                <span>Rekap Seluruh Nilai Siswa</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Penyajian seluruh rekapan nilai tugas, ulangan harian, UTS, dan UAS secara mendatar (horizontal) dengan pencatatan tanggal pengambilan nilai pada setiap kolom.
              </p>
            </div>
            
            {/* Google Sheets Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportRecap}
                disabled={isExportingRecap}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-violet-600/10 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                {isExportingRecap ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Ekspor ke Sheets</span>
              </button>
              
              <button
                onClick={() => setIsImportRecapOpen(true)}
                disabled={isImportingRecap}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                {isImportingRecap ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>Impor dari Sheets</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-auto flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Pelajaran:</span>
              <select
                value={recapSubject}
                onChange={(e) => setRecapSubject(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none w-full sm:w-48"
              >
                {filterSubjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-auto flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Kelas:</span>
              <select
                value={recapClassId}
                onChange={(e) => setRecapClassId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none w-full sm:w-48"
              >
                <option value="all">Semua Kelas</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="text-[11px] text-slate-400 italic font-medium ml-auto hidden lg:block">
              *Tampilan mendatar diurutkan otomatis berdasarkan tanggal pengambilan nilai
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed min-w-[950px]">
                <thead>
                  {/* Row 1: Major Category Headers */}
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase">
                    <th className="py-3 px-4 text-center w-12 border-r border-slate-100 dark:border-slate-800" rowSpan={2}>No</th>
                    <th className="py-3 px-4 w-52 border-r border-slate-100 dark:border-slate-800" rowSpan={2}>Nama Siswa</th>
                    <th className="py-3 px-4 w-32 border-r border-slate-100 dark:border-slate-800" rowSpan={2}>NISN</th>
                    
                    {/* Nilai Tugas */}
                    <th 
                      colSpan={tugasCols.length || 1} 
                      className="py-3 px-2 text-center bg-blue-50/50 dark:bg-blue-950/10 text-blue-700 border-r border-slate-100 dark:border-slate-800"
                    >
                      Nilai Tugas
                    </th>

                    {/* Ulangan Harian */}
                    <th 
                      colSpan={ulanganCols.length || 1} 
                      className="py-3 px-2 text-center bg-amber-50/50 dark:bg-amber-950/10 text-amber-700 border-r border-slate-100 dark:border-slate-800"
                    >
                      Ulangan Harian (UH)
                    </th>

                    {/* UTS */}
                    <th 
                      colSpan={utsCols.length || 1} 
                      className="py-3 px-2 text-center bg-purple-50/50 dark:bg-purple-950/10 text-purple-700 border-r border-slate-100 dark:border-slate-800"
                    >
                      UTS
                    </th>

                    {/* UAS */}
                    <th 
                      colSpan={uasCols.length || 1} 
                      className="py-3 px-2 text-center bg-rose-50/50 dark:bg-rose-950/10 text-rose-700 border-r border-slate-100 dark:border-slate-800"
                    >
                      UAS
                    </th>

                    <th className="py-3 px-4 text-center w-28 text-slate-800 dark:text-slate-200" rowSpan={2}>Rerata Akhir</th>
                  </tr>

                  {/* Row 2: Sub-headers with Specific Dates / Notes */}
                  <tr className="bg-slate-100/50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400">
                    {/* Tugas subheaders */}
                    {tugasCols.length === 0 ? (
                      <th className="py-2 text-center font-normal italic text-[9px] border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">Belum Ada</th>
                    ) : (
                      tugasCols.map((col, idx) => (
                        <th key={`t_sub_${idx}`} className="py-2 text-center border-r border-slate-200 dark:border-slate-800 px-1 truncate bg-blue-50/10 dark:bg-blue-950/5">
                          <div>Tugas {idx + 1}</div>
                          <div className="text-[8px] text-blue-500 font-medium">{col.date}</div>
                        </th>
                      ))
                    )}

                    {/* Ulangan subheaders */}
                    {ulanganCols.length === 0 ? (
                      <th className="py-2 text-center font-normal italic text-[9px] border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">Belum Ada</th>
                    ) : (
                      ulanganCols.map((col, idx) => (
                        <th key={`u_sub_${idx}`} className="py-2 text-center border-r border-slate-200 dark:border-slate-800 px-1 truncate bg-amber-50/10 dark:bg-amber-950/5">
                          <div>UH {idx + 1}</div>
                          <div className="text-[8px] text-amber-500 font-medium">{col.date}</div>
                        </th>
                      ))
                    )}

                    {/* UTS subheaders */}
                    {utsCols.length === 0 ? (
                      <th className="py-2 text-center font-normal italic text-[9px] border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">Belum Ada</th>
                    ) : (
                      utsCols.map((col, idx) => (
                        <th key={`uts_sub_${idx}`} className="py-2 text-center border-r border-slate-200 dark:border-slate-800 px-1 truncate bg-purple-50/10 dark:bg-purple-950/5">
                          <div>UTS {idx + 1}</div>
                          <div className="text-[8px] text-purple-500 font-medium">{col.date}</div>
                        </th>
                      ))
                    )}

                    {/* UAS subheaders */}
                    {uasCols.length === 0 ? (
                      <th className="py-2 text-center font-normal italic text-[9px] border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">Belum Ada</th>
                    ) : (
                      uasCols.map((col, idx) => (
                        <th key={`uas_sub_${idx}`} className="py-2 text-center border-r border-slate-200 dark:border-slate-800 px-1 truncate bg-rose-50/10 dark:bg-rose-950/5">
                          <div>UAS {idx + 1}</div>
                          <div className="text-[8px] text-rose-500 font-medium">{col.date}</div>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {students.filter(s => recapClassId === 'all' || s.classId === recapClassId).length === 0 ? (
                    <tr>
                      <td colSpan={3 + Math.max(tugasCols.length, 1) + Math.max(ulanganCols.length, 1) + Math.max(utsCols.length, 1) + Math.max(uasCols.length, 1) + 1} className="py-12 text-center text-slate-400">
                        Tidak ada siswa dalam kelas yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    students
                      .filter(s => recapClassId === 'all' || s.classId === recapClassId)
                      .map((student, sIdx) => {
                        const average = getStudentAverage(student.id);
                        const isUnderKkm = average !== '-' && Number(average) < kkm;

                        return (
                          <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all">
                            {/* No */}
                            <td className="py-3 px-4 text-center border-r border-slate-100 dark:border-slate-800 text-slate-400 font-bold">{sIdx + 1}</td>
                            
                            {/* Nama */}
                            <td className="py-3 px-4 border-r border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">
                              {student.name}
                            </td>

                            {/* NISN */}
                            <td className="py-3 px-4 border-r border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">{student.nisn || '-'}</td>

                            {/* Nilai Tugas */}
                            {tugasCols.length === 0 ? (
                              <td className="py-3 text-center text-slate-300 border-r border-slate-100 dark:border-slate-800 font-semibold">-</td>
                            ) : (
                              tugasCols.map((col, idx) => {
                                const g = getStudentGrade(student.id, 'Tugas', col);
                                return (
                                  <td key={`t_${student.id}_${idx}`} className="py-3 text-center border-r border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300 bg-blue-50/5">
                                    {g ? g.score : '-'}
                                  </td>
                                );
                              })
                            )}

                            {/* Nilai Ulangan */}
                            {ulanganCols.length === 0 ? (
                              <td className="py-3 text-center text-slate-300 border-r border-slate-100 dark:border-slate-800 font-semibold">-</td>
                            ) : (
                              ulanganCols.map((col, idx) => {
                                const g = getStudentGrade(student.id, 'Ulangan', col);
                                return (
                                  <td key={`u_${student.id}_${idx}`} className="py-3 text-center border-r border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300 bg-amber-50/5">
                                    {g ? g.score : '-'}
                                  </td>
                                );
                              })
                            )}

                            {/* Nilai UTS */}
                            {utsCols.length === 0 ? (
                              <td className="py-3 text-center text-slate-300 border-r border-slate-100 dark:border-slate-800 font-semibold">-</td>
                            ) : (
                              utsCols.map((col, idx) => {
                                const g = getStudentGrade(student.id, 'UTS', col);
                                return (
                                  <td key={`uts_${student.id}_${idx}`} className="py-3 text-center border-r border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300 bg-purple-50/5">
                                    {g ? g.score : '-'}
                                  </td>
                                );
                              })
                            )}

                            {/* Nilai UAS */}
                            {uasCols.length === 0 ? (
                              <td className="py-3 text-center text-slate-300 border-r border-slate-100 dark:border-slate-800 font-semibold">-</td>
                            ) : (
                              uasCols.map((col, idx) => {
                                const g = getStudentGrade(student.id, 'UAS', col);
                                return (
                                  <td key={`uas_${student.id}_${idx}`} className="py-3 text-center border-r border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300 bg-rose-50/5">
                                    {g ? g.score : '-'}
                                  </td>
                                );
                              })
                            )}

                            {/* Rata-rata Akhir */}
                            <td className="py-3 px-4 text-center font-black text-sm">
                              <span className={isUnderKkm ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                {average}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import Sheets Modal */}
          {isImportRecapOpen && (
            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 flex items-center justify-between text-white">
                  <h3 className="font-bold text-lg flex items-center space-x-2">
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>Impor Rekap Nilai</span>
                  </h3>
                  <button onClick={() => setIsImportRecapOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="bg-violet-50 dark:bg-violet-950/20 p-4 rounded-2xl border border-violet-100 dark:border-violet-900/30 text-xs text-violet-800 dark:text-violet-300 leading-relaxed space-y-2">
                    <p className="font-bold">Panduan Penting Format Google Sheets:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Gunakan format yang dihasilkan dari tombol <strong>Ekspor ke Sheets</strong> sebagai acuan pembuatan tabel.</li>
                      <li>Baris pertama <strong>harus</strong> berisi nama kolom utama seperti <code>Nama Siswa</code>, <code>NISN</code>, dan nama-nama evaluasi (e.g., <code>Tugas 1</code>, <code>UH 1</code>).</li>
                      <li>Baris kedua <strong>harus</strong> berisi tanggal pengambilan nilai (format: <code>YYYY-MM-DD</code>) dan opsional di dalam tanda kurung untuk deskripsi (e.g., <code>2026-07-14 (Bab 1)</code>).</li>
                      <li>Baris ketiga dan seterusnya adalah daftar nilai siswa yang akan dicocokkan otomatis berdasarkan NISN atau Nama Siswa.</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">URL atau ID Google Sheets</label>
                    <input
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={importRecapSheetUrl}
                      onChange={(e) => setImportRecapSheetUrl(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-3 rounded-xl text-xs w-full focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-700/50">
                    <button
                      type="button"
                      onClick={() => setIsImportRecapOpen(false)}
                      className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-all"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleImportRecap}
                      disabled={isImportingRecap || !importRecapSheetUrl}
                      className="bg-violet-600 hover:bg-violet-500 disabled:opacity-55 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-violet-600/25 transition-all flex items-center space-x-2 cursor-pointer"
                    >
                      {isImportingRecap ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Impor Sekarang</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
