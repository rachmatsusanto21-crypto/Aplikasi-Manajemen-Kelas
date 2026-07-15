/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { LearningJournal, SchoolClass } from '../types';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  BookOpen, 
  X, 
  Calendar, 
  Clock, 
  Compass, 
  Smile, 
  Activity,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';
import { getAccessToken, googleSignIn } from '../firebase';
import { exportToGoogleSheets, importFromGoogleSheets, SheetExportPayload } from '../googleDrive';

interface JournalTabProps {
  classes: SchoolClass[];
  journals: LearningJournal[];
  onAddJournal: (journal: Omit<LearningJournal, 'id'>) => void;
  onEditJournal: (journal: LearningJournal) => void;
  onDeleteJournal: (id: string) => void;
  onOverwriteJournals?: (journals: LearningJournal[]) => void;
}

export default function JournalTab({
  classes,
  journals,
  onAddJournal,
  onEditJournal,
  onDeleteJournal,
  onOverwriteJournals,
}: JournalTabProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [activeTab, setActiveTab] = useState<'list' | 'recap'>('list');

  // Recap Filters
  const [recapMonth, setRecapMonth] = useState<number>(new Date().getMonth());
  const [recapYear, setRecapYear] = useState<number>(new Date().getFullYear());
  const [recapClassId, setRecapClassId] = useState<string>('all');
  const [recapSubject, setRecapSubject] = useState<string>('all');

  // Sheets Sync States
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [exportedSheetUrl, setExportedSheetUrl] = useState<string | null>(null);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJournal, setEditingJournal] = useState<LearningJournal | null>(null);
  const [journalForm, setJournalForm] = useState({
    date: new Date().toISOString().split('T')[0],
    classId: classes[0]?.id || '',
    subject: 'Matematika',
    topic: '',
    activities: '',
    achievement: '',
  });

  const subjects = ['Matematika', 'IPA', 'IPS', 'Bahasa Indonesia', 'PJOK', 'Seni Budaya', 'Bahasa Inggris', 'Pendidikan Pancasila', 'Agama'];

  // Filter journals
  const filteredJournals = useMemo(() => {
    return journals.filter(j => {
      const matchesClass = selectedClassId === 'all' || j.classId === selectedClassId;
      const matchesSubject = selectedSubject === 'all' || j.subject === selectedSubject;
      const matchesSearch = j.topic.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            j.activities.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesClass && matchesSubject && matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first
  }, [journals, selectedClassId, selectedSubject, searchQuery]);

  // Recap Journals Filtered
  const recapJournals = useMemo(() => {
    return journals.filter(j => {
      const dateObj = new Date(j.date);
      const matchesMonth = !isNaN(dateObj.getTime()) && dateObj.getMonth() === recapMonth;
      const matchesYear = !isNaN(dateObj.getTime()) && dateObj.getFullYear() === recapYear;
      const matchesClass = recapClassId === 'all' || j.classId === recapClassId;
      const matchesSubject = recapSubject === 'all' || j.subject === recapSubject;
      return matchesMonth && matchesYear && matchesClass && matchesSubject;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // oldest to newest for chronological recap
  }, [journals, recapMonth, recapYear, recapClassId, recapSubject]);

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
    setExportedSheetUrl(null);
    try {
      const headerRow = [
        'No', 'Tanggal', 'Kelas', 'Mata Pelajaran', 'Materi / Topik Pembelajaran', 'Kegiatan Pembelajaran', 'Capaian / Catatan Hambatan'
      ];

      const rows = recapJournals.map((j, idx) => {
        const cls = classes.find(c => c.id === j.classId)?.name || '-';
        return [
          (idx + 1).toString(),
          j.date,
          cls,
          j.subject,
          j.topic,
          j.activities || '',
          j.achievement || ''
        ];
      });

      const selectedMonthName = months[recapMonth];
      const selectedClassName = recapClassId === 'all' ? 'Semua Kelas' : (classes.find(c => c.id === recapClassId)?.name || '');
      const selectedSubjectName = recapSubject === 'all' ? 'Semua Pelajaran' : recapSubject;

      const payload: SheetExportPayload = {
        title: `Jurnal Harian - ${selectedMonthName} ${recapYear} - ${selectedClassName} - ${selectedSubjectName}`,
        headers: headerRow,
        rows: rows
      };

      const url = await exportToGoogleSheets(token, payload);
      setExportedSheetUrl(url);
      alert('Jurnal berhasil diekspor ke Google Sheets!');
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengekspor jurnal: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

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
      const rawRows = await importFromGoogleSheets(token, spreadsheetId, 'Sheet1!A1:G500');
      if (rawRows.length < 2) {
        alert('Data Google Sheet kosong atau tidak valid (minimal butuh baris header dan 1 baris data).');
        setIsImporting(false);
        return;
      }

      const headers = rawRows[0].map(h => h.trim().toLowerCase());
      
      let dateIdx = headers.findIndex(h => h.includes('tanggal') || h.includes('date'));
      let classIdx = headers.findIndex(h => h.includes('kelas') || h.includes('class'));
      let subjectIdx = headers.findIndex(h => h.includes('pelajaran') || h.includes('subject'));
      let topicIdx = headers.findIndex(h => h.includes('topik') || h.includes('materi') || h.includes('topic'));
      let activitiesIdx = headers.findIndex(h => h.includes('kegiatan') || h.includes('activity') || h.includes('activities'));
      let achievementIdx = headers.findIndex(h => h.includes('capaian') || h.includes('catatan') || h.includes('achievement') || h.includes('hambatan'));

      if (dateIdx === -1 || classIdx === -1 || subjectIdx === -1 || topicIdx === -1) {
        alert('Gagal mencocokkan kolom! Pastikan Google Sheet Anda memiliki baris header dengan nama kolom: Tanggal (Date), Kelas (Class), Mata Pelajaran (Subject), dan Topik/Materi (Topic/Materi).');
        setIsImporting(false);
        return;
      }

      const dataRows = rawRows.slice(1);
      const importedJournals: LearningJournal[] = [...journals];
      let addedCount = 0;
      let updatedCount = 0;

      dataRows.forEach((row) => {
        const dateVal = row[dateIdx]?.trim();
        const classVal = row[classIdx]?.trim();
        const subjectVal = row[subjectIdx]?.trim();
        const topicVal = row[topicIdx]?.trim();

        if (!dateVal || !classVal || !subjectVal || !topicVal) return;

        let parsedDate = dateVal;
        if (dateVal.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [d, m, y] = dateVal.split('/');
          parsedDate = `${y}-${m}-${d}`;
        }

        const clsObj = classes.find(c => c.name.toLowerCase() === classVal.toLowerCase());
        const classId = clsObj ? clsObj.id : (classes[0]?.id || 'unknown');

        const activitiesVal = activitiesIdx !== -1 ? row[activitiesIdx]?.trim() || '' : '';
        const achievementVal = achievementIdx !== -1 ? row[achievementIdx]?.trim() || '' : '';

        const existingIdx = importedJournals.findIndex(j => 
          j.date === parsedDate && 
          j.classId === classId && 
          j.subject.toLowerCase() === subjectVal.toLowerCase()
        );

        if (existingIdx !== -1) {
          importedJournals[existingIdx] = {
            ...importedJournals[existingIdx],
            topic: topicVal,
            activities: activitiesVal,
            achievement: achievementVal
          };
          updatedCount++;
        } else {
          importedJournals.push({
            id: 'j_' + (Date.now() + Math.random()),
            date: parsedDate,
            classId,
            subject: subjectVal,
            topic: topicVal,
            activities: activitiesVal,
            achievement: achievementVal
          });
          addedCount++;
        }
      });

      if (onOverwriteJournals) {
        onOverwriteJournals(importedJournals);
      } else {
        alert('Handler untuk menyimpan jurnal tidak ditemukan!');
        setIsImporting(false);
        return;
      }

      alert(`Impor Sukses!\nBerhasil menambahkan ${addedCount} jurnal baru dan memperbarui ${updatedCount} jurnal lama.`);
      setIsImportModalOpen(false);
      setSheetUrl('');
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengimpor data jurnal: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalForm.topic.trim()) {
      alert('Topik pembelajaran wajib diisi!');
      return;
    }

    const payload = {
      date: journalForm.date,
      classId: journalForm.classId,
      subject: journalForm.subject,
      topic: journalForm.topic,
      activities: journalForm.activities,
      achievement: journalForm.achievement,
    };

    if (editingJournal) {
      onEditJournal({
        ...editingJournal,
        ...payload,
      });
    } else {
      onAddJournal(payload);
    }

    setIsModalOpen(false);
  };

  const openJournalModal = (journal: LearningJournal | null = null) => {
    if (journal) {
      setEditingJournal(journal);
      setJournalForm({
        date: journal.date,
        classId: journal.classId,
        subject: journal.subject,
        topic: journal.topic,
        activities: journal.activities,
        achievement: journal.achievement,
      });
    } else {
      setEditingJournal(null);
      setJournalForm({
        date: new Date().toISOString().split('T')[0],
        classId: selectedClassId === 'all' ? (classes[0]?.id || '') : selectedClassId,
        subject: selectedSubject === 'all' ? 'Matematika' : selectedSubject,
        topic: '',
        activities: '',
        achievement: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus jurnal harian ini?')) {
      onDeleteJournal(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 scrollbar-none overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'list'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Daftar Jurnal Harian</span>
        </button>
        <button
          onClick={() => setActiveTab('recap')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'recap'
              ? 'border-violet-600 text-violet-600 dark:text-violet-400 dark:border-violet-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Rekap Bulanan Jurnal</span>
        </button>
      </div>

      {activeTab === 'list' ? (
        <>
          {/* Search and Filters */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row gap-3 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari materi, kegiatan, atau topik harian..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 pl-10 pr-4 py-2 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs focus:outline-none"
                >
                  <option value="all">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs focus:outline-none"
                >
                  <option value="all">Semua Pelajaran</option>
                  {subjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => openJournalModal()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jurnal</span>
            </button>
          </div>

          {/* Timeline of journals */}
          <div className="space-y-6">
            {filteredJournals.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Belum ada jurnal pembelajaran harian</p>
                <p className="text-xs text-slate-400 mt-1">Klik tombol di atas untuk mendokumentasikan kegiatan pembelajaran Anda hari ini.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-indigo-100 dark:border-indigo-950 ml-4 md:ml-6 pl-6 md:pl-8 space-y-6">
                {filteredJournals.map((journal) => {
                  const journalClass = classes.find(c => c.id === journal.classId);
                  return (
                    <div key={journal.id} className="relative group">
                      {/* Timeline bullet */}
                      <div className="absolute -left-[35px] md:-left-[43px] top-1.5 w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950 border-4 border-indigo-600 dark:border-indigo-400 group-hover:scale-110 transition-all flex items-center justify-center shadow-md">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>

                      {/* Journal Card */}
                      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-50 dark:border-slate-700/50 pb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg">
                              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                              {new Date(journal.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>

                            <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-2.5 py-1 rounded-lg text-xs">
                              {journalClass ? journalClass.name : '-'}
                            </span>

                            <span className="bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 font-bold px-2.5 py-1 rounded-lg text-xs">
                              {journal.subject}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1.5 self-end md:self-auto">
                            <button
                              onClick={() => openJournalModal(journal)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-all"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(journal.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Topic */}
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center space-x-1">
                            <Compass className="w-3.5 h-3.5" />
                            <span>Materi / Topik Pembelajaran:</span>
                          </h4>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed pl-4.5 border-l border-slate-100 dark:border-slate-700">
                            {journal.topic}
                          </p>
                        </div>

                        {/* Activities */}
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                            <Activity className="w-3.5 h-3.5 text-slate-400" />
                            <span>Kegiatan Pembelajaran:</span>
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-4.5 whitespace-pre-line">
                            {journal.activities || 'Tidak diisi.'}
                          </p>
                        </div>

                        {/* Achievements */}
                        {journal.achievement && (
                          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 p-3.5 rounded-xl space-y-1">
                            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                              <Smile className="w-3.5 h-3.5" />
                              <span>Capaian / Catatan Hambatan Pembelajaran:</span>
                            </h4>
                            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                              {journal.achievement}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        // RECAP VIEW
        <div className="space-y-6">
          {/* Recap Header Card with Google Sheets buttons */}
          <div className="bg-gradient-to-r from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20 border border-indigo-100 dark:border-indigo-900/30 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 flex items-center space-x-1.5">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Rekapitulasi Jurnal Pembelajaran</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Penyajian ringkas seluruh materi, kegiatan pembelajaran, dan hambatan per kelas dalam bentuk tabel bulanan terstruktur.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportSheets}
                disabled={isExporting}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                {isExporting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Ekspor ke Sheets</span>
              </button>
              
              <button
                onClick={() => setIsImportModalOpen(true)}
                disabled={isImporting}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                {isImporting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>Impor dari Sheets</span>
              </button>
            </div>
          </div>

          {/* Export link if available */}
          {exportedSheetUrl && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-3.5 rounded-xl text-xs flex items-center justify-between text-emerald-800 dark:text-emerald-300">
              <span className="font-medium">Spreadsheet baru berhasil dibuat dan diekspor!</span>
              <a 
                href={exportedSheetUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="underline font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
              >
                Buka Google Sheets &rarr;
              </a>
            </div>
          )}

          {/* Recap Filter Toolbar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-wrap gap-3">
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Bulan</label>
              <select
                value={recapMonth}
                onChange={(e) => setRecapMonth(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs focus:outline-none min-w-[120px]"
              >
                {months.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Tahun</label>
              <select
                value={recapYear}
                onChange={(e) => setRecapYear(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs focus:outline-none min-w-[90px]"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Kelas</label>
              <select
                value={recapClassId}
                onChange={(e) => setRecapClassId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs focus:outline-none min-w-[120px]"
              >
                <option value="all">Semua Kelas</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Pelajaran</label>
              <select
                value={recapSubject}
                onChange={(e) => setRecapSubject(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs focus:outline-none min-w-[140px]"
              >
                <option value="all">Semua Pelajaran</option>
                {subjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Recap Table */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-4 w-12 text-center">No</th>
                    <th className="py-4 px-4 w-40">Hari & Tanggal</th>
                    <th className="py-4 px-4 w-24">Kelas</th>
                    <th className="py-4 px-4 w-32">Pelajaran</th>
                    <th className="py-4 px-4 w-48">Materi Pokok / Topik</th>
                    <th className="py-4 px-4">Kegiatan Pembelajaran</th>
                    <th className="py-4 px-4 w-48">Capaian & Hambatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recapJournals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400 dark:text-slate-500">
                        <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <span className="font-semibold block">Tidak ada data rekap jurnal</span>
                        <span className="text-[11px] text-slate-400 block mt-1">Silakan sesuaikan filter pencarian di atas atau tambahkan jurnal pembelajaran baru.</span>
                      </td>
                    </tr>
                  ) : (
                    recapJournals.map((j, idx) => {
                      const journalClass = classes.find(c => c.id === j.classId);
                      const dateObj = new Date(j.date);
                      const formattedDate = isNaN(dateObj.getTime())
                        ? j.date
                        : dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                      return (
                        <tr key={j.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">{formattedDate}</td>
                          <td className="py-3 px-4">
                            <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded text-[10px]">
                              {journalClass ? journalClass.name : '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 font-bold px-2 py-0.5 rounded text-[10px]">
                              {j.subject}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">{j.topic}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">{j.activities || '-'}</td>
                          <td className="py-3 px-4">
                            {j.achievement ? (
                              <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl leading-relaxed text-[11px]">
                                {j.achievement}
                              </div>
                            ) : '-'}
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

      {/* Journal Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg">{editingJournal ? 'Edit Jurnal Pembelajaran' : 'Buat Jurnal Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tanggal Pelajaran</label>
                  <input
                    type="date"
                    required
                    value={journalForm.date}
                    onChange={(e) => setJournalForm({ ...journalForm, date: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mata Pelajaran</label>
                  <select
                    value={journalForm.subject}
                    onChange={(e) => setJournalForm({ ...journalForm, subject: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                  >
                    {subjects.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pilih Kelas</label>
                <select
                  value={journalForm.classId}
                  onChange={(e) => setJournalForm({ ...journalForm, classId: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Materi Pokok / Topik Pembelajaran</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pecahan Senilai dan Penyederhanaan Pecahan"
                  value={journalForm.topic}
                  onChange={(e) => setJournalForm({ ...journalForm, topic: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Detail Kegiatan Pembelajaran</label>
                <textarea
                  rows={3}
                  placeholder={`1. Pembukaan dan menyanyikan lagu Indonesia Raya.&#10;2. Penjelasan konsep pecahan senilai dengan media gambar apel.&#10;3. Latihan kelompok mengerjakan lembar kerja pecahan.`}
                  value={journalForm.activities}
                  onChange={(e) => setJournalForm({ ...journalForm, activities: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Capaian / Catatan Hambatan Pembelajaran</label>
                <textarea
                  rows={2}
                  placeholder="e.g. 85% siswa memahami materi dengan baik, 3 siswa masih membutuhkan bimbingan saat latihan mandiri."
                  value={journalForm.achievement}
                  onChange={(e) => setJournalForm({ ...journalForm, achievement: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500 font-sans"
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
                  {editingJournal ? 'Simpan Perubahan' : 'Terbitkan Jurnal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Impor Jurnal dari Google Sheets</span>
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSheets} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Tautan Spreadsheet / ID Google Sheets</label>
                <input
                  type="text"
                  required
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed mt-1">
                  Masukkan URL Spreadsheet Google Anda. Pastikan baris pertama berisi header kolom yang cocok: <b>Tanggal</b>, <b>Kelas</b>, <b>Mata Pelajaran</b>, <b>Topik</b>, <b>Kegiatan</b>, dan <b>Capaian</b>.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-1.5"
                >
                  {isImporting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>Mulai Impor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
