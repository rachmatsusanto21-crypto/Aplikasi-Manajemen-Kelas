/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Teacher } from '../types';
import { 
  UserPlus, 
  Edit2, 
  Trash2, 
  LogIn, 
  Plus, 
  X, 
  ChevronRight, 
  User, 
  UserCheck, 
  Settings,
  Sun,
  Moon
} from 'lucide-react';

interface LoginScreenProps {
  teachers: Teacher[];
  onSelectTeacher: (teacher: Teacher) => void;
  onAddTeacher: (name: string, email: string, color: string) => void;
  onEditTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  theme?: 'light' | 'dark';
  onChangeTheme?: (theme: 'light' | 'dark') => void;
}

export default function LoginScreen({
  teachers,
  onSelectTeacher,
  onAddTeacher,
  onEditTeacher,
  onDeleteTeacher,
  theme = 'light',
  onChangeTheme,
}: LoginScreenProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6366F1'); // Indigo default

  const avatarColors = [
    '#6366F1', // Indigo
    '#EC4899', // Pink
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#3B82F6', // Blue
    '#8B5CF6', // Violet
    '#EF4444', // Red
    '#14B8A6', // Teal
  ];

  const handleOpenAdd = () => {
    setEditingTeacher(null);
    setTeacherName('');
    setTeacherEmail('');
    setSelectedColor(avatarColors[Math.floor(Math.random() * avatarColors.length)]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (teacher: Teacher, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering login
    setEditingTeacher(teacher);
    setTeacherName(teacher.name);
    setTeacherEmail(teacher.email || '');
    setSelectedColor(teacher.avatarColor);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering login
    if (window.confirm(`Apakah Anda yakin ingin menghapus profil Guru "${name}"? Semua data lokal yang terkait akan terhapus.`)) {
      onDeleteTeacher(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim() || !teacherEmail.trim()) return;

    if (editingTeacher) {
      onEditTeacher({
        ...editingTeacher,
        name: teacherName,
        email: teacherEmail,
        avatarColor: selectedColor,
      });
    } else {
      onAddTeacher(teacherName, teacherEmail, selectedColor);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 relative">
      
      {/* Theme Toggle in Login Screen */}
      {onChangeTheme && (
        <div className="absolute top-4 right-4">
          <button
            type="button"
            onClick={() => onChangeTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2.5 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-800 shadow-md transition-all flex items-center justify-center text-slate-600 hover:text-indigo-600 dark:text-slate-350 dark:hover:text-indigo-400 cursor-pointer"
            title={theme === 'light' ? 'Aktifkan Mode Gelap' : 'Aktifkan Mode Terang'}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>
      )}

      {/* Title / Hero */}
      <div className="text-center space-y-2 max-w-md mb-6">
        <div className="w-12 h-12 rounded-lg bg-indigo-600 shadow-md shadow-indigo-600/10 text-white flex items-center justify-center font-bold text-xl mx-auto">
          GA
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Selamat Datang di GuruAsisten</h1>
          <p className="text-[11px] text-slate-400 mt-1">Platform pintar guru harian untuk mencatat absensi, nilai, membuat jadwal pelajaran otomatis, dan jurnal harian.</p>
        </div>
      </div>

      {/* Main Box */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg w-full max-w-md p-5 space-y-5 overflow-hidden">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Pilih Akun Guru</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Silakan pilih profil Anda untuk melanjutkan</p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg transition-all"
            title="Tambah Guru Baru"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* List of profiles */}
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {teachers.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <User className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold">Belum ada akun guru terdaftar</p>
                <p className="text-[10px] text-slate-400">Silakan buat akun guru pertama Anda dengan mengeklik tombol tambah di atas.</p>
              </div>
              <button
                onClick={handleOpenAdd}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-md shadow-indigo-600/10 transition-all inline-flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Profil Guru</span>
              </button>
            </div>
          ) : (
            teachers.map((teacher) => (
              <div
                key={teacher.id}
                onClick={() => onSelectTeacher(teacher)}
                className="group flex items-center justify-between p-3 rounded-lg border border-slate-150 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500/50 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-850 cursor-pointer transition-all"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-9 h-9 rounded-md text-white font-bold text-xs flex items-center justify-center shadow-inner"
                    style={{ backgroundColor: teacher.avatarColor }}
                  >
                    {teacher.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {teacher.name}
                    </h3>
                    <div className="flex flex-col text-[9px] text-slate-400">
                      <span className="font-medium text-slate-500 dark:text-slate-300">{teacher.email}</span>
                      <span>{teacher.lastLoggedIn ? `Aktif: ${teacher.lastLoggedIn}` : 'Profil Baru'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-0.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => handleOpenEdit(teacher, e)}
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded transition-all"
                    title="Edit Profil"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(teacher.id, teacher.name, e)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded transition-all"
                    title="Hapus Profil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Profile Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white">
              <h3 className="font-bold text-lg">{editingTeacher ? 'Edit Akun Guru' : 'Tambah Akun Guru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nama Lengkap Guru</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ibu Rachmat Susanto, S.Pd."
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Email Pribadi</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rachmatsusanto21@guru.sd.belajar.id"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl text-sm w-full focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              {/* Avatar Color picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Pilih Warna Profil</label>
                <div className="flex flex-wrap gap-2.5">
                  {avatarColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center"
                      style={{ 
                        backgroundColor: color,
                        borderColor: selectedColor === color ? '#ffffff' : 'transparent',
                        boxShadow: selectedColor === color ? '0 0 0 2px #6366f1' : 'none'
                      }}
                    />
                  ))}
                </div>
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
                  {editingTeacher ? 'Simpan Perubahan' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
