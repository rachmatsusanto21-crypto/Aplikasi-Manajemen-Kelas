/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Attendance, Grade, Student, SchoolClass } from '../types';
import { Award, CheckCircle, AlertCircle, TrendingUp, Users, BookOpen } from 'lucide-react';

interface StatsTabProps {
  students: Student[];
  classes: SchoolClass[];
  attendance: Attendance[];
  grades: Grade[];
  journalsCount: number;
  selectedClassId: string;
}

export default function StatsTab({
  students,
  classes,
  attendance,
  grades,
  journalsCount,
  selectedClassId,
}: StatsTabProps) {
  // Filter students based on selected class
  const filteredStudents = useMemo(() => {
    if (!selectedClassId || selectedClassId === 'all') return students;
    return students.filter(s => s.classId === selectedClassId);
  }, [students, selectedClassId]);

  const studentIds = useMemo(() => new Set(filteredStudents.map(s => s.id)), [filteredStudents]);

  // Filter attendance for these students
  const filteredAttendance = useMemo(() => {
    return attendance.filter(a => studentIds.has(a.studentId));
  }, [attendance, studentIds]);

  // Filter grades for these students
  const filteredGrades = useMemo(() => {
    return grades.filter(g => studentIds.has(g.studentId));
  }, [grades, studentIds]);

  // Attendance rate calculations
  const attendanceStats = useMemo(() => {
    const total = filteredAttendance.length;
    if (total === 0) return { H: 0, I: 0, S: 0, A: 0, rate: 100, total: 0 };

    const counts = { H: 0, I: 0, S: 0, A: 0 };
    filteredAttendance.forEach(a => {
      if (a.status in counts) {
        counts[a.status as 'H' | 'I' | 'S' | 'A']++;
      }
    });

    return {
      H: Math.round((counts.H / total) * 100),
      I: Math.round((counts.I / total) * 100),
      S: Math.round((counts.S / total) * 100),
      A: Math.round((counts.A / total) * 100),
      rawH: counts.H,
      rawI: counts.I,
      rawS: counts.S,
      rawA: counts.A,
      rate: Math.round((counts.H / total) * 100),
      total,
    };
  }, [filteredAttendance]);

  // Subject performance calculations
  const gradeStats = useMemo(() => {
    if (filteredGrades.length === 0) return { average: 0, subjects: [], count: 0 };

    const subjectMap: { [subject: string]: { sum: number; count: number } } = {};
    let totalSum = 0;

    filteredGrades.forEach(g => {
      totalSum += g.score;
      if (!subjectMap[g.subject]) {
        subjectMap[g.subject] = { sum: 0, count: 0 };
      }
      subjectMap[g.subject].sum += g.score;
      subjectMap[g.subject].count++;
    });

    const subjects = Object.entries(subjectMap).map(([name, data]) => ({
      name,
      average: Math.round(data.sum / data.count),
      count: data.count,
    })).sort((a, b) => b.average - a.average);

    return {
      average: Math.round(totalSum / filteredGrades.length),
      subjects,
      count: filteredGrades.length,
    };
  }, [filteredGrades]);

  // Outstanding students based on grades (top scorers)
  const outstandingStudents = useMemo(() => {
    if (filteredStudents.length === 0 || filteredGrades.length === 0) return [];

    const studentSum: { [id: string]: { sum: number; count: number } } = {};
    filteredGrades.forEach(g => {
      if (!studentSum[g.studentId]) {
        studentSum[g.studentId] = { sum: 0, count: 0 };
      }
      studentSum[g.studentId].sum += g.score;
      studentSum[g.studentId].count++;
    });

    return filteredStudents
      .map(s => {
        const scoreData = studentSum[s.id];
        const average = scoreData ? Math.round(scoreData.sum / scoreData.count) : null;
        return { ...s, average };
      })
      .filter(s => s.average !== null)
      .sort((a, b) => (b.average || 0) - (a.average || 0))
      .slice(0, 4);
  }, [filteredStudents, filteredGrades]);

  // Donut chart path/stroke-dasharray calculation
  const donutData = useMemo(() => {
    const s = attendanceStats;
    let accumulatedPercent = 0;
    
    return [
      { name: 'Hadir', percent: s.H, color: '#10B981', raw: s.rawH },
      { name: 'Izin', percent: s.I, color: '#3B82F6', raw: s.rawI },
      { name: 'Sakit', percent: s.S, color: '#F59E0B', raw: s.rawS },
      { name: 'Alpa', percent: s.A, color: '#EF4444', raw: s.rawA },
    ].filter(item => item.percent > 0);
  }, [attendanceStats]);

  const classNameText = useMemo(() => {
    if (selectedClassId === 'all') return 'Semua Kelas';
    const activeCls = classes.find(c => c.id === selectedClassId);
    return activeCls ? activeCls.name : 'Kelas';
  }, [selectedClassId, classes]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="stats-overview">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Siswa ({classNameText})</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">{filteredStudents.length}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Kehadiran</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
              {attendanceStats.total > 0 ? `${attendanceStats.rate}%` : '-'}
            </h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-sans">Rata-rata Nilai</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
              {gradeStats.count > 0 ? gradeStats.average : '-'}
            </h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-lg">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Jurnal Harian</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">{journalsCount} <span className="text-[10px] font-normal text-slate-400">Entri</span></h3>
          </div>
        </div>
      </div>

      {/* Main Stats Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Donut Chart */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-250 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">Statistik Kehadiran</h4>
            <p className="text-xs text-slate-400 mt-1">Proporsi status kehadiran siswa</p>
          </div>

          <div className="flex flex-col items-center justify-center py-6">
            {attendanceStats.total === 0 ? (
              <div className="text-center py-10 space-y-2">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-400">Belum ada data absensi untuk kelas ini</p>
              </div>
            ) : (
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-slate-100 dark:stroke-slate-700"
                    strokeWidth="12"
                    fill="transparent"
                  />
                  {/* Generate segments */}
                  {(() => {
                    let cumulativePercent = 0;
                    return donutData.map((item, idx) => {
                      const strokeDasharray = `${item.percent} ${100 - item.percent}`;
                      const strokeDashoffset = -cumulativePercent;
                      cumulativePercent += item.percent;
                      return (
                        <circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r="40"
                          stroke={item.color}
                          strokeWidth="12"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          strokePathLength="100"
                          fill="transparent"
                          className="transition-all duration-500 hover:stroke-[14px] cursor-pointer"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{attendanceStats.rate}%</span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Hadir</span>
                </div>
              </div>
            )}
          </div>

          {attendanceStats.total > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-500 dark:text-slate-400">Hadir: <b>{attendanceStats.H}%</b> ({attendanceStats.rawH})</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-slate-500 dark:text-slate-400">Izin: <b>{attendanceStats.I}%</b> ({attendanceStats.rawI})</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-500 dark:text-slate-400">Sakit: <b>{attendanceStats.S}%</b> ({attendanceStats.rawS})</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-slate-500 dark:text-slate-400">Alpa: <b>{attendanceStats.A}%</b> ({attendanceStats.rawA})</span>
              </div>
            </div>
          )}
        </div>

        {/* Grade Subject Performance Bar Chart */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-250 dark:border-slate-800 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">Nilai Rata-Rata Mata Pelajaran</h4>
            <p className="text-xs text-slate-400 mt-1">Perbandingan nilai rata-rata tiap mata pelajaran</p>
          </div>

          <div className="py-6 space-y-4 flex-1 flex flex-col justify-center">
            {gradeStats.subjects.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-400">Belum ada data nilai mata pelajaran untuk kelas ini</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {gradeStats.subjects.map((sub, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span>{sub.name}</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{sub.average} <span className="font-normal text-slate-400">/100</span></span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${sub.average}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">{sub.count} data nilai dimasukkan</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-between text-xs text-slate-400">
            <span>Standar KKM: <b>70</b></span>
            <span>Total Evaluasi: <b>{gradeStats.count} kali</b></span>
          </div>
        </div>
      </div>

      {/* Top Students / Low Performing Warning */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Outstanding Students Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-250 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                <Award className="w-5 h-5 text-amber-500" />
                <span>Siswa Berprestasi</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">Siswa dengan rata-rata nilai harian tertinggi</p>
            </div>
            <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-semibold px-2.5 py-1 rounded-full">Top Performers</span>
          </div>

          {outstandingStudents.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">Belum ada nilai yang dimasukkan</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {outstandingStudents.map((s, idx) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                      #{idx + 1}
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.name}</h5>
                      <p className="text-[10px] text-slate-400">NISN: {s.nisn || '-'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">{s.average}</span>
                    <p className="text-[9px] text-slate-400">Rata-rata</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance Summary alerts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-250 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <span>Pemantauan Kehadiran</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">Siswa dengan absensi Alpa / Ketidakhadiran terbanyak</p>
            </div>
            <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold px-2.5 py-1 rounded-full">Perhatian</span>
          </div>

          {(() => {
            if (filteredStudents.length === 0 || filteredAttendance.length === 0) {
              return <div className="text-center py-8 text-sm text-slate-400">Belum ada catatan ketidakhadiran</div>;
            }

            const alpaCounts: { [id: string]: { A: number; S: number; I: number } } = {};
            filteredAttendance.forEach(a => {
              if (a.status !== 'H') {
                if (!alpaCounts[a.studentId]) {
                  alpaCounts[a.studentId] = { A: 0, S: 0, I: 0 };
                }
                if (a.status === 'A') alpaCounts[a.studentId].A++;
                if (a.status === 'S') alpaCounts[a.studentId].S++;
                if (a.status === 'I') alpaCounts[a.studentId].I++;
              }
            });

            const absentees = filteredStudents
              .map(s => {
                const c = alpaCounts[s.id] || { A: 0, S: 0, I: 0 };
                const totalMissed = c.A + c.S + c.I;
                return { ...s, counts: c, totalMissed };
              })
              .filter(s => s.totalMissed > 0)
              .sort((a, b) => b.counts.A - a.counts.A || b.totalMissed - a.totalMissed)
              .slice(0, 4);

            if (absentees.length === 0) {
              return <div className="text-center py-8 text-sm text-slate-400">Semua siswa memiliki kehadiran sempurna! 🌟</div>;
            }

            return (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {absentees.map(s => (
                  <div key={s.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.name}</h5>
                      <p className="text-[10px] text-slate-400">Total tidak masuk: {s.totalMissed} kali</p>
                    </div>
                    <div className="flex items-center space-x-2 text-xs font-bold">
                      {s.counts.A > 0 && <span className="bg-red-50 dark:bg-red-950/30 text-red-600 px-2 py-0.5 rounded">Alpa: {s.counts.A}</span>}
                      {s.counts.S > 0 && <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-600 px-2 py-0.5 rounded">Sakit: {s.counts.S}</span>}
                      {s.counts.I > 0 && <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-600 px-2 py-0.5 rounded">Izin: {s.counts.I}</span>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
