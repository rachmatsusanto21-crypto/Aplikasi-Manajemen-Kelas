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
  AlertCircle,
  FileSpreadsheet,
  Upload,
  Settings
} from 'lucide-react';
import { googleSignIn, getAccessToken } from '../firebase';
import { exportToGoogleSheets, importFromGoogleSheets } from '../googleDrive';

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
    time: '07:30 - 08:05',
    subject: 'Matematika',
  });

  // Schedule Generator Config State
  const [generatorDays, setGeneratorDays] = useState<('Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu')[]>([
    'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'
  ]);
  const [generatorPeriods, setGeneratorPeriods] = useState<number>(13);
  
  const subjectsList = ['Matematika', 'IPA', 'IPS', 'Bahasa Indonesia', 'PJOK', 'Seni Budaya', 'Bahasa Inggris', 'Pendidikan Pancasila', 'Agama', 'Istirahat'];
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
    'Istirahat': 2,
  });

  const days: ('Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu')[] = [
    'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
  ];

  const [timeSlots, setTimeSlots] = useState<string[]>(() => {
    const saved = localStorage.getItem('school_time_slots');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return [
      "07:30 - 08:05", // Jam ke-1 (35 mins)
      "08:05 - 08:40", // Jam ke-2
      "08:40 - 09:15", // Jam ke-3
      "09:15 - 09:45 (Istirahat)", // Istirahat pertama (30 mins)
      "09:45 - 10:20", // Jam ke-4
      "10:20 - 10:55", // Jam ke-5
      "10:55 - 11:30", // Jam ke-6
      "11:30 - 12:00 (Istirahat kedua)", // Jam ke-7 (Istirahat kedua)
      "12:00 - 12:35", // Jam ke-8
      "12:35 - 13:10", // Jam ke-9
      "13:10 - 13:45", // Jam ke-10
      "13:45 - 14:20", // Jam ke-11
      "14:20 - 14:55"  // Jam ke-12
    ];
  });

  const saveTimeSlots = (newSlots: string[]) => {
    setTimeSlots(newSlots);
    localStorage.setItem('school_time_slots', JSON.stringify(newSlots));
  };

  // Google Sheets & Edit All Grid State
  const [isEditAllModalOpen, setIsEditAllModalOpen] = useState(false);
  const [tempTimeSlots, setTempTimeSlots] = useState<string[]>([]);
  const [tempGrid, setTempGrid] = useState<{ [key: string]: string }>({});

  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [isImportSheetsOpen, setIsImportSheetsOpen] = useState(false);
  const [isImportingSheets, setIsImportingSheets] = useState(false);
  const [importSheetUrl, setImportSheetUrl] = useState('');

  const [editingTimeSlotIdx, setEditingTimeSlotIdx] = useState<number | null>(null);
  const [editingTimeSlotValue, setEditingTimeSlotValue] = useState<string>('');

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
      time: manualForm.time || timeSlots[manualForm.period - 1] || "07:30 - 08:05",
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
        time: '07:30 - 08:05',
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
      timeSlots
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

  const handleOpenEditAllModal = () => {
    setTempTimeSlots([...timeSlots]);
    const grid: { [key: string]: string } = {};
    days.forEach(day => {
      timeSlots.forEach((_, idx) => {
        const period = idx + 1;
        const slot = classSchedules.find(s => s.day === day && s.period === period);
        grid[`${day}-${period}`] = slot ? slot.subject : 'Kosong';
      });
    });
    setTempGrid(grid);
    setIsEditAllModalOpen(true);
  };

  const handleSaveAllGrid = (e: React.FormEvent) => {
    e.preventDefault();
    saveTimeSlots(tempTimeSlots);

    // Filter schedules of other classes
    const otherSchedules = schedules.filter(s => s.classId !== selectedClassId);

    // Build new schedules for this class
    const newSchedules: Schedule[] = [];
    days.forEach(day => {
      tempTimeSlots.forEach((_, idx) => {
        const period = idx + 1;
        const subject = tempGrid[`${day}-${period}`];
        if (subject && subject.trim() && subject !== 'Kosong') {
          newSchedules.push({
            id: `sch-${selectedClassId}-${day}-${period}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            classId: selectedClassId,
            day,
            period,
            time: tempTimeSlots[idx],
            subject: subject.trim()
          });
        }
      });
    });

    onOverwriteSchedules([...otherSchedules, ...newSchedules]);
    setIsEditAllModalOpen(false);
    alert('Seluruh isi jadwal pelajaran berhasil diperbarui!');
  };

  const handleExportScheduleSheets = async () => {
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

    setIsExportingSheets(true);
    try {
      const activeClass = classes.find(c => c.id === selectedClassId);
      const className = activeClass ? activeClass.name : 'Kelas';

      const headerRow = [
        'Jam Ke-', 'Waktu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
      ];

      const rows = timeSlots.map((timeStr, i) => {
        const period = i + 1;
        
        const rowData = [
          `Jam ${period}`,
          timeStr
        ];

        days.forEach(day => {
          const slot = classSchedules.find(s => s.day === day && s.period === period);
          rowData.push(slot ? slot.subject : '');
        });

        return rowData;
      });

      const payload = {
        title: `Jadwal Pelajaran - ${className}`,
        headers: headerRow,
        rows: rows
      };

      const url = await exportToGoogleSheets(token, payload);
      setIsExportingSheets(false);
      window.open(url, '_blank');
      alert('Berhasil mengekspor jadwal pelajaran ke Google Sheets!');
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengekspor jadwal: ' + error.message);
      setIsExportingSheets(false);
    }
  };

  const handleImportScheduleSheets = async (e: React.FormEvent) => {
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
          alert('Silakan hubungkan akun Google Anda terlebih dahulu!');
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
      const rawRows = await importFromGoogleSheets(token, spreadsheetId, 'Sheet1!A1:I100');
      if (rawRows.length < 2) {
        alert('Data Google Sheet kosong atau tidak valid (minimal butuh baris header dan 1 baris data).');
        setIsImportingSheets(false);
        return;
      }

      const headers = rawRows[0].map(h => h.trim().toLowerCase());
      
      const timeIdx = headers.findIndex(h => h.includes('waktu') || h.includes('time'));
      
      const mondayIdx = headers.findIndex(h => h.includes('senin') || h.includes('mon'));
      const tuesdayIdx = headers.findIndex(h => h.includes('selasa') || h.includes('tue'));
      const wednesdayIdx = headers.findIndex(h => h.includes('rabu') || h.includes('wed'));
      const thursdayIdx = headers.findIndex(h => h.includes('kamis') || h.includes('thu'));
      const fridayIdx = headers.findIndex(h => h.includes('jumat') || h.includes('fri'));
      const saturdayIdx = headers.findIndex(h => h.includes('sabtu') || h.includes('sat'));

      if (timeIdx === -1 || mondayIdx === -1) {
        alert('Format kolom tidak cocok! Pastikan header Google Sheet berisi minimal: Jam Ke-, Waktu, Senin, Selasa, Rabu, Kamis, Jumat, Sabtu.');
        setIsImportingSheets(false);
        return;
      }

      const dataRows = rawRows.slice(1);
      const newTimeSlots: string[] = [];
      const newSchedules: Schedule[] = [];

      dataRows.forEach((row, idx) => {
        const period = idx + 1;
        const timeVal = row[timeIdx]?.trim() || `07:30 - 08:05`;
        newTimeSlots.push(timeVal);

        const dayIndices = [
          { day: 'Senin', idx: mondayIdx },
          { day: 'Selasa', idx: tuesdayIdx },
          { day: 'Rabu', idx: wednesdayIdx },
          { day: 'Kamis', idx: thursdayIdx },
          { day: 'Jumat', idx: fridayIdx },
          { day: 'Sabtu', idx: saturdayIdx }
        ];

        dayIndices.forEach(({ day, idx: colIdx }) => {
          if (colIdx !== -1 && row[colIdx]) {
            const subjectVal = row[colIdx].trim();
            if (subjectVal && subjectVal.toLowerCase() !== 'kosong') {
              newSchedules.push({
                id: `sch-${selectedClassId}-${day}-${period}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                classId: selectedClassId,
                day: day as any,
                period,
                time: timeVal,
                subject: subjectVal
              });
            }
          }
        });
      });

      if (newTimeSlots.length > 0) {
        saveTimeSlots(newTimeSlots);
      }

      const otherSchedules = schedules.filter(s => s.classId !== selectedClassId);
      onOverwriteSchedules([...otherSchedules, ...newSchedules]);

      setIsImportingSheets(false);
      setIsImportSheetsOpen(false);
      alert('Berhasil mengimpor jadwal pelajaran dari Google Sheets!');
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengimpor jadwal: ' + error.message);
      setIsImportingSheets(false);
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenEditAllModal}
            className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
            title="Edit Seluruh Jadwal"
          >
            <Settings className="w-4 h-4" />
            <span>Edit Jadwal</span>
          </button>

          <button
            onClick={() => setIsImportSheetsOpen(true)}
            className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Impor Sheets</span>
          </button>

          <button
            onClick={handleExportScheduleSheets}
            disabled={isExportingSheets}
            className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExportingSheets ? 'Mengekspor...' : 'Ekspor Sheets'}</span>
          </button>

          <button
            onClick={() => setIsGeneratorModalOpen(true)}
            className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
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
              {timeSlots.map((timeStr, i) => {
                const period = i + 1;
                const isBreak = timeStr.toLowerCase().includes('istirahat');

                const getPeriodLabel = (idx: number, currentStr: string) => {
                  const lower = currentStr.toLowerCase();
                  if (lower.includes('istirahat')) {
                    if (lower.includes('kedua') || idx === 7) {
                      return "Istirahat Kedua";
                    }
                    return "Istirahat";
                  }
                  if (idx < 3) return `Jam Ke-${idx + 1}`;
                  if (idx >= 4 && idx < 7) return `Jam Ke-${idx}`;
                  if (idx >= 8) return `Jam Ke-${idx}`;
                  return `Jam Ke-${idx + 1}`;
                };

                return (
                  <tr key={period} className={`${isBreak ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''} hover:bg-slate-50/30 dark:hover:bg-slate-900/20`}>
                    {/* Period col */}
                    <td className="py-4 px-3 font-semibold border-r border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 min-w-[150px]">
                      {editingTimeSlotIdx === i ? (
                        <div className="flex flex-col items-center justify-center space-y-1 px-1">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {getPeriodLabel(i, timeStr)}
                          </span>
                          <div className="flex items-center space-x-1">
                            <input
                              type="text"
                              value={editingTimeSlotValue}
                              onChange={(e) => setEditingTimeSlotValue(e.target.value)}
                              className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-slate-800 dark:text-slate-100 px-2 py-1 rounded text-[11px] w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center font-semibold"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const updated = [...timeSlots];
                                  updated[i] = editingTimeSlotValue;
                                  saveTimeSlots(updated);
                                  setEditingTimeSlotIdx(null);
                                } else if (e.key === 'Escape') {
                                  setEditingTimeSlotIdx(null);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...timeSlots];
                                updated[i] = editingTimeSlotValue;
                                saveTimeSlots(updated);
                                setEditingTimeSlotIdx(null);
                              }}
                              className="p-1 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded transition-all"
                              title="Simpan"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTimeSlotIdx(null)}
                              className="p-1 text-rose-500 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 rounded transition-all"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="group relative flex flex-col items-center justify-center py-1">
                          <div className="font-bold text-slate-700 dark:text-slate-200">
                            {getPeriodLabel(i, timeStr)}
                          </div>
                          <div className="text-[10px] font-mono mt-0.5 text-slate-400 flex items-center justify-center space-x-1">
                            <span>{timeStr}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTimeSlotIdx(i);
                                setEditingTimeSlotValue(timeStr);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 transition-all cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                              title="Edit waktu"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
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
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono block mt-0.5 truncate">
                                {slot.time}
                              </span>
                              
                              {/* Overlay actions on hover */}
                              <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center space-x-1 rounded-xl">
                                <button
                                  type="button"
                                  onClick={() => openManualModal(slot)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-all"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSlot(slot.id, slot.subject)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSlot(null);
                                setManualForm({ day, period, time: timeStr, subject: '' });
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
                    onChange={(e) => {
                      const selectedPeriod = Number(e.target.value);
                      const timeVal = timeSlots[selectedPeriod - 1] || "";
                      setManualForm({ 
                        ...manualForm, 
                        period: selectedPeriod,
                        time: timeVal
                      });
                    }}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none"
                  >
                    {timeSlots.map((timeStr, idx) => {
                      const p = idx + 1;
                      const getPeriodLabel = (index: number, currentStr: string) => {
                        const lower = currentStr.toLowerCase();
                        if (lower.includes('istirahat')) {
                          if (lower.includes('kedua') || index === 7) {
                            return "Istirahat Kedua";
                          }
                          return "Istirahat";
                        }
                        if (index < 3) return `Jam Ke-${index + 1}`;
                        if (index >= 4 && index < 7) return `Jam Ke-${index}`;
                        if (index >= 8) return `Jam Ke-${index}`;
                        return `Jam Ke-${index + 1}`;
                      };
                      return (
                        <option key={p} value={p}>
                          {getPeriodLabel(idx, timeStr)} ({timeStr})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mata Pelajaran</label>
                <input
                  type="text"
                  list="subjects-datalist"
                  placeholder="e.g. Matematika, Fisika, Upacara, dll."
                  value={manualForm.subject}
                  onChange={(e) => setManualForm({ ...manualForm, subject: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500"
                  required
                />
                <datalist id="subjects-datalist">
                  {subjectsList.map(sub => (
                    <option key={sub} value={sub} />
                  ))}
                  <option value="Mandiri / Free" />
                  <option value="Upacara Bendera" />
                  <option value="Senam Kesegaran Jasmani" />
                </datalist>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1">Anda bebas mengetik pelajaran manual atau memilih dari saran di atas.</span>
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

      {/* Edit Seluruh Jadwal Modal */}
      {isEditAllModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col h-[90vh]">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white flex-shrink-0">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Edit Seluruh Jadwal Kelas</span>
              </h3>
              <button onClick={() => setIsEditAllModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Two column layout with scrollable grid */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100/30 p-3.5 rounded-xl text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">
                Anda sedang mengubah seluruh isi jadwal pelajaran kelas aktif sekaligus. Anda dapat menentukan/mengubah durasi waktu untuk tiap sesi jam pelajaran, menambahkan atau menghapus baris jam pelajaran, dan langsung memilih mata pelajaran (termasuk <strong>"Istirahat"</strong>) pada tabel di bawah ini.
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Time Slots Column */}
                <div className="lg:col-span-1 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Waktu & Jam Sesi</span>
                    <button
                      type="button"
                      onClick={() => setTempTimeSlots([...tempTimeSlots, '00:00 - 00:00'])}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline"
                    >
                      + Tambah Jam
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {tempTimeSlots.map((timeVal, idx) => (
                      <div key={idx} className="flex items-center space-x-1 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-150 dark:border-slate-700 shadow-sm">
                        <span className="text-[10px] font-black text-slate-400 w-10 text-center">Jam {idx + 1}</span>
                        <input
                          type="text"
                          value={timeVal}
                          onChange={(e) => {
                            const updated = [...tempTimeSlots];
                            updated[idx] = e.target.value;
                            setTempTimeSlots(updated);
                          }}
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-2 py-1 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 w-full"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (tempTimeSlots.length <= 1) return;
                            const updated = tempTimeSlots.filter((_, i) => i !== idx);
                            setTempTimeSlots(updated);
                          }}
                          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950 p-1 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grid Matrix Column */}
                <div className="lg:col-span-3 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-xs min-w-[650px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase">
                          <th className="py-3 px-2 w-20">Jam</th>
                          {days.map(d => (
                            <th key={d} className="py-3 px-2">{d}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {tempTimeSlots.map((timeVal, idx) => {
                          const period = idx + 1;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-900/10">
                              <td className="py-3 px-2 font-bold text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                                Jam {period}
                              </td>
                              {days.map(day => {
                                const key = `${day}-${period}`;
                                const currentValue = tempGrid[key] || 'Kosong';
                                return (
                                  <td key={day} className="py-2 px-1">
                                    <select
                                      value={currentValue}
                                      onChange={(e) => {
                                        setTempGrid({ ...tempGrid, [key]: e.target.value });
                                      }}
                                      className={`w-full p-1.5 rounded-lg text-[11px] font-bold border ${
                                        currentValue === 'Istirahat'
                                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 text-amber-700 dark:text-amber-400'
                                          : currentValue === 'Kosong'
                                          ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400'
                                          : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 text-indigo-700 dark:text-indigo-400'
                                      } focus:outline-none`}
                                    >
                                      <option value="Kosong">-- Kosong --</option>
                                      {subjectsList.map(sub => (
                                        <option key={sub} value={sub}>{sub}</option>
                                      ))}
                                    </select>
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
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-150 dark:border-slate-800 flex justify-end space-x-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsEditAllModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAllGrid}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all"
              >
                Simpan Perubahan Jadwal
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
                <span>Impor Jadwal dari Google Sheets</span>
              </h3>
              <button onClick={() => setIsImportSheetsOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportScheduleSheets} className="p-6 space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/30 p-3.5 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-400 leading-relaxed">
                Masukkan tautan edit atau ID Google Sheet Anda. Pastikan baris pertama (header) berisi nama kolom seperti: 
                <strong> Jam Ke-, Waktu, Senin, Selasa, Rabu, Kamis, Jumat, Sabtu.</strong>
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
    </div>
  );
}
