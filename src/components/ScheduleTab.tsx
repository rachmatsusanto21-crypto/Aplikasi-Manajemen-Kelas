/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Schedule, SchoolClass } from '../types';
import { 
  generateAutomatedSchedule, 
  SubjectDemand 
} from './ScheduleGenerator';
import { 
  Calendar, 
  Plus, 
  Wand2, 
  Trash2, 
  Edit, 
  Clock, 
  X, 
  Save, 
  AlertCircle 
} from 'lucide-react';

interface ScheduleTabProps {
  classes: SchoolClass[];
  schedules: Schedule[];
  onAddScheduleSlot: (slot: Omit<Schedule, 'id'>) => void;
  onEditScheduleSlot: (slot: Schedule) => void;
  onDeleteScheduleSlot: (id: string) => void;
  onOverwriteSchedules: (schedules: Schedule[]) => void;
}

export default function ScheduleTab({
  classes,
  schedules,
  onAddScheduleSlot,
  onEditScheduleSlot,
  onDeleteScheduleSlot,
  onOverwriteSchedules,
}: ScheduleTabProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Schedule | null>(null);

  // Manual Slot Form State
  const [manualForm, setManualForm] = useState({
    day: 'Senin' as 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu',
    period: 1,
    time: '07:30 - 08:15',
    subject: 'Matematika',
  });

  // Schedule Generator Config State
  const [generatorDays, setGeneratorDays] = useState<('Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu')[]>([
    'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'
  ]);
  const [generatorPeriods, setGeneratorPeriods] = useState<number>(6);
  
  const subjectsList = ['Matematika', 'IPA', 'IPS', 'Bahasa Indonesia', 'PJOK', 'Seni Budaya', 'Bahasa Inggris', 'Pendidikan Pancasila', 'Agama'];
  const [subjectDemands, setSubjectDemands] = useState<{ [subject: string]: number }>({
    'Matematika': 4,
    'IPA': 4,
    'IPS': 3,
    'Bahasa Indonesia': 5,
    'PJOK': 2,
    'Seni Budaya': 2,
    'Bahasa Inggris': 2,
    'Pendidikan Pancasila': 2,
    'Agama': 2,
  });

  const days: ('Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu')[] = [
    'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
  ];

  const standardTimeSlots = [
    "07:30 - 08:15",
    "08:15 - 09:00",
    "09:00 - 09:45",
    "09:45 - 10:15 (Istirahat)",
    "10:15 - 11:00",
    "11:00 - 11:45",
    "11:45 - 12:30",
    "12:30 - 13:15"
  ];

  // Filtered schedules for selected class
  const classSchedules = useMemo(() => {
    return schedules.filter(s => s.classId === selectedClassId);
  }, [schedules, selectedClassId]);

  // Max period in schedules or default to 6
  const maxPeriod = useMemo(() => {
    const activePeriods = classSchedules.map(s => s.period);
    if (activePeriods.length === 0) return 6;
    return Math.max(...activePeriods, 6);
  }, [classSchedules]);

  // Handle Manual Save
  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      day: manualForm.day,
      period: Number(manualForm.period),
      time: manualForm.time || standardTimeSlots[manualForm.period - 1] || "07:30 - 08:15",
      subject: manualForm.subject,
      classId: selectedClassId,
    };

    if (editingSlot) {
      onEditScheduleSlot({
        ...editingSlot,
        ...payload,
      });
    } else {
      onAddScheduleSlot(payload);
    }
    setIsManualModalOpen(false);
  };

  const openManualModal = (slot: Schedule | null = null) => {
    if (slot) {
      setEditingSlot(slot);
      setManualForm({
        day: slot.day,
        period: slot.period,
        time: slot.time,
        subject: slot.subject,
      });
    } else {
      setEditingSlot(null);
      setManualForm({
        day: 'Senin',
        period: 1,
        time: '07:30 - 08:15',
        subject: 'Matematika',
      });
    }
    setIsManualModalOpen(true);
  };

  const handleDeleteSlot = (id: string, subject: string) => {
    if (window.confirm(`Hapus mata pelajaran "${subject}" dari jam pelajaran ini?`)) {
      onDeleteScheduleSlot(id);
    }
  };

  // Run automated schedule generator
  const handleRunGenerator = () => {
    const activeClass = classes.find(c => c.id === selectedClassId);
    if (!activeClass) return;

    if (!window.confirm(`Apakah Anda yakin ingin membuat jadwal otomatis untuk "${activeClass.name}"? Jadwal yang sudah ada untuk kelas ini akan digantikan.`)) {
      return;
    }

    const demandsPayload: SubjectDemand[] = Object.entries(subjectDemands)
      .filter(([_, hours]) => (hours as number) > 0)
      .map(([subjectName, hoursPerWeek]) => ({
        subjectName,
        hoursPerWeek: hoursPerWeek as number,
      }));

    // Generate new schedule for this class
    const generated = generateAutomatedSchedule(
      [activeClass],
      { [activeClass.id]: demandsPayload },
      generatorDays,
      generatorPeriods,
      standardTimeSlots
    );

    // Merge with other classes' schedules
    const otherSchedules = schedules.filter(s => s.classId !== selectedClassId);
    const merged = [...otherSchedules, ...generated];

    onOverwriteSchedules(merged);
    setIsGeneratorModalOpen(false);
    alert(`Jadwal pelajaran otomatis untuk "${activeClass.name}" berhasil dibuat!`);
  };

  const toggleGeneratorDay = (day: typeof days[number]) => {
    if (generatorDays.includes(day)) {
      setGeneratorDays(generatorDays.filter(d => d !== day));
    } else {
      setGeneratorDays([...generatorDays, day]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Header */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-indigo-500" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Jadwal Pelajaran Mingguan</h3>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-xl text-sm focus:outline-none focus:border-indigo-500 min-w-[120px] font-semibold"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsGeneratorModalOpen(true)}
            className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center space-x-2"
          >
            <Wand2 className="w-4 h-4" />
            <span>Generate Otomatis</span>
          </button>

          <button
            onClick={() => openManualModal()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal</span>
          </button>
        </div>
      </div>

      {/* Grid Schedule Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                <th className="py-4 px-3 w-32 border-r border-slate-100 dark:border-slate-800">Waktu & Jam</th>
                {days.map(day => (
                  <th key={day} className="py-4 px-3 w-1/6">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {Array.from({ length: maxPeriod }).map((_, i) => {
                const period = i + 1;
                const timeStr = standardTimeSlots[i] || "07:30 - 08:15";
                const isBreak = timeStr.toLowerCase().includes('istirahat');

                return (
                  <tr key={period} className={`${isBreak ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''} hover:bg-slate-50/30 dark:hover:bg-slate-900/20`}>
                    {/* Period col */}
                    <td className="py-4 px-3 font-semibold border-r border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <div className="font-bold text-slate-700 dark:text-slate-200">Jam Ke-{period}</div>
                      <div className="text-[10px] font-mono mt-0.5">{timeStr}</div>
                    </td>

                    {/* Day cols */}
                    {days.map(day => {
                      const slot = classSchedules.find(s => s.day === day && s.period === period);
                      
                      if (isBreak) {
                        return (
                          <td key={day} className="py-4 px-3 text-amber-600 dark:text-amber-400 font-bold tracking-widest text-[10px] uppercase">
                            Istirahat
                          </td>
                        );
                      }

                      return (
                        <td key={day} className="py-3 px-2 border-r border-slate-50 dark:border-slate-800/40 last:border-r-0">
                          {slot ? (
                            <div className="group relative bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-400/50 transition-all text-center">
                              <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px] truncate">
                                {slot.subject}
                              </span>
                              
                              {/* Overlay actions on hover */}
                              <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center space-x-1 rounded-xl">
                                <button
                                  onClick={() => openManualModal(slot)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-all"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSlot(slot.id, slot.subject)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setManualForm({ day, period, time: timeStr, subject: 'Matematika' });
                                setIsManualModalOpen(true);
                              }}
                              className="w-full py-3 border border-dashed border-slate-200 dark:border-slate-700/60 hover:border-indigo-500 dark:hover:border-indigo-500/50 text-slate-300 dark:text-slate-600 hover:text-indigo-500 rounded-xl transition-all font-semibold flex items-center justify-center space-x-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span className="text-[10px]">Kosong</span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Slot Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg">{editingSlot ? 'Edit Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran'}</h3>
              <button onClick={() => setIsManualModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Hari</label>
                  <select
                    value={manualForm.day}
                    onChange={(e) => setManualForm({ ...manualForm, day: e.target.value as any })}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                  >
                    {days.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Jam Pelajaran Ke-</label>
                  <select
                    value={manualForm.period}
                    onChange={(e) => setManualForm({ ...manualForm, period: Number(e.target.value) })}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                  >
                    {Array.from({ length: 8 }).map((_, idx) => (
                      <option key={idx + 1} value={idx + 1}>Jam Ke-{idx + 1}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mata Pelajaran</label>
                <select
                  value={manualForm.subject}
                  onChange={(e) => setManualForm({ ...manualForm, subject: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                >
                  {subjectsList.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                  <option value="Mandiri / Free">Mandiri / Free</option>
                  <option value="Upacara">Upacara Bendera</option>
                  <option value="Senam">Senam Kesegaran Jasmani</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Waktu / Jam Pelaksanaan</label>
                <input
                  type="text"
                  placeholder="e.g. 07:30 - 08:15"
                  value={manualForm.time}
                  onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
                >
                  {editingSlot ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Automated Schedule Generator Modal */}
      {isGeneratorModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <Wand2 className="w-5 h-5" />
                <span>Pembuat Jadwal Pelajaran Otomatis</span>
              </h3>
              <button onClick={() => setIsGeneratorModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100/30 p-3.5 rounded-xl flex items-start space-x-2.5">
                <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-indigo-700 dark:text-indigo-400 leading-relaxed">
                  Fitur kecerdasan buatan akan mendistribusikan jam mengajar mata pelajaran secara merata sepanjang minggu dan menghindari tumpang tindih untuk kelas yang dipilih.
                </p>
              </div>

              {/* Set Days & Periods */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Pilih Hari Sekolah</label>
                  <div className="flex flex-wrap gap-1.5">
                    {days.map(d => {
                      const isSelected = generatorDays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleGeneratorDay(d)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isSelected 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Sesi Jam per Hari ({generatorPeriods} Jam)</label>
                  <input
                    type="range"
                    min="4"
                    max="8"
                    value={generatorPeriods}
                    onChange={(e) => setGeneratorPeriods(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>4 Jam</span>
                    <span>6 Jam (Standar)</span>
                    <span>8 Jam</span>
                  </div>
                </div>
              </div>

              {/* Subject hours demands list */}
              <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">Tentukan Jam per Minggu untuk Tiap Mata Pelajaran</h4>
                <div className="grid grid-cols-2 gap-3">
                  {subjectsList.map(subject => (
                    <div key={subject} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{subject}</span>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={subjectDemands[subject] ?? 0}
                          onChange={(e) => setSubjectDemands({ ...subjectDemands, [subject]: Number(e.target.value) })}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-2 py-1 rounded-lg text-xs font-bold w-12 text-center focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400">jam</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsGeneratorModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleRunGenerator}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-2"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>Generate Jadwal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
