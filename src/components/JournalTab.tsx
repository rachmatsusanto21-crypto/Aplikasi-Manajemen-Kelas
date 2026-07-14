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
  Activity 
} from 'lucide-react';

interface JournalTabProps {
  classes: SchoolClass[];
  journals: LearningJournal[];
  onAddJournal: (journal: Omit<LearningJournal, 'id'>) => void;
  onEditJournal: (journal: LearningJournal) => void;
  onDeleteJournal: (id: string) => void;
}

export default function JournalTab({
  classes,
  journals,
  onAddJournal,
  onEditJournal,
  onDeleteJournal,
}: JournalTabProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center space-x-2"
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
    </div>
  );
}
