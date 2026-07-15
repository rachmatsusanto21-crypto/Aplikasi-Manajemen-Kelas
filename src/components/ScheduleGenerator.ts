/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schedule, SchoolClass } from '../types';

export interface SubjectDemand {
  subjectName: string;
  hoursPerWeek: number; // Jumlah jam pelajaran seminggu
}

export function generateAutomatedSchedule(
  classes: SchoolClass[],
  demands: { [classId: string]: SubjectDemand[] },
  days: ('Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu')[],
  periodsPerDay: number,
  timeSlots: string[] // Array of time strings matching index (e.g., ["07:30 - 08:15", "08:15 - 09:00", ...])
): Schedule[] {
  const generated: Schedule[] = [];
  
  // Sederhanakan pembuatan jadwal dengan algoritma penempatan heuristik.
  // Menghindari tabrakan:
  // 1. Seorang guru mengajar satu kelas pada satu jam pelajaran tertentu (untuk single-teacher app, kita pastikan jadwal per kelas tidak bentrok)
  // 2. Setiap slot (hari, period, class) hanya boleh diisi satu mata pelajaran.
  // 3. Distribusikan mata pelajaran secara merata, hindari mata pelajaran yang sama berulang terlalu sering pada hari yang sama.
  
  classes.forEach((cls) => {
    const classDemands = demands[cls.id] || [];
    // Buat flat list berisi mata pelajaran yang perlu dijadwalkan, dikalikan dengan jumlah jamnya
    const subjectPool: string[] = [];
    classDemands.forEach((d) => {
      for (let i = 0; i < d.hoursPerWeek; i++) {
        subjectPool.push(d.subjectName);
      }
    });

    // Acak kolam mata pelajaran agar distribusinya alami
    const shuffledPool = [...subjectPool].sort(() => Math.random() - 0.5);

    // Buat grid untuk kelas ini
    let poolIndex = 0;

    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const day = days[dayIndex];
      for (let period = 1; period <= periodsPerDay; period++) {
        const timeStr = timeSlots[period - 1] || "";
        const isBreak = timeStr.toLowerCase().includes("istirahat");

        if (isBreak) {
          // Skip break slots from getting subjects assigned
          continue;
        }

        // Jika masih ada pelajaran di kolam, masukkan
        if (poolIndex < shuffledPool.length) {
          const subject = shuffledPool[poolIndex];
          
          // Cek apakah pelajaran ini sudah terlalu sering hari ini (maksimal 2 kali per hari berturut-turut)
          const subjectsToday = generated.filter(s => s.classId === cls.id && s.day === day).map(s => s.subject);
          const sameSubjectCount = subjectsToday.filter(s => s === subject).length;

          // Jika pelajaran ini sudah ada hari ini dan kita punya alternatif lain di kolam, coba cari alternatif
          if (sameSubjectCount >= 2 && poolIndex + 1 < shuffledPool.length) {
            // Cari mata pelajaran lain di sisa kolam
            let altIndex = poolIndex + 1;
            while (altIndex < shuffledPool.length && shuffledPool[altIndex] === subject) {
              altIndex++;
            }
            if (altIndex < shuffledPool.length) {
              // Tukar
               const temp = shuffledPool[poolIndex];
               shuffledPool[poolIndex] = shuffledPool[altIndex];
               shuffledPool[altIndex] = temp;
            }
          }

          generated.push({
            id: `${cls.id}-${day}-${period}-${Math.random().toString(36).substring(2, 7)}`,
            day: day,
            period: period,
            time: timeStr || "07:30 - 08:05",
            subject: shuffledPool[poolIndex],
            classId: cls.id
          });
          poolIndex++;
        } else {
          // Istirahat atau kosong
          generated.push({
            id: `${cls.id}-${day}-${period}-${Math.random().toString(36).substring(2, 7)}`,
            day: day,
            period: period,
            time: timeStr || "07:30 - 08:05",
            subject: "Mandiri / Free",
            classId: cls.id
          });
        }
      }
    }
  });

  return generated;
}
