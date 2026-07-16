/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CurriculumData, CurriculumColumn, CurriculumRow } from '../types';
import { 
  Table as TableIcon,
  Plus, 
  Trash2, 
  Edit, 
  Download, 
  Upload, 
  Save, 
  X, 
  Settings, 
  FileSpreadsheet, 
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { getAccessToken, googleSignIn } from '../firebase';
import { exportToGoogleSheets, importFromGoogleSheets, SheetExportPayload } from '../googleDrive';

interface CurriculumTabProps {
  curriculum: CurriculumData;
  onUpdateCurriculum: (data: CurriculumData) => void;
}

export default function CurriculumTab({
  curriculum,
  onUpdateCurriculum,
}: CurriculumTabProps) {
  // Local States
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSheetUrl, setExportedSheetUrl] = useState<string | null>(null);
  
  // Sheet Import States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [importRange, setImportRange] = useState('Sheet1!A1:Z100');
  const [isImporting, setIsImporting] = useState(false);
  
  // Modal states for custom column addition
  const [isAddColOpen, setIsAddColOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  
  // Modal states for row edit
  const [isEditRowOpen, setIsEditRowOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CurriculumRow | null>(null);
  
  // Quick Edit Mode Toggle (renders table cells as inputs for direct editing)
  const [quickEditMode, setQuickEditMode] = useState(false);

  // Fallback defaults in case the curriculum is empty or corrupted
  const columns = curriculum?.columns || [];
  const rows = curriculum?.rows || [];

  // Mutator helpers
  const handleAddRow = () => {
    const newId = `row_${Date.now()}`;
    const newNo = (rows.length + 1).toString();
    
    // Create new row object with empty values for all columns
    const newRow: CurriculumRow = { id: newId };
    columns.forEach(col => {
      if (col.id === 'no') {
        newRow[col.id] = newNo;
      } else {
        newRow[col.id] = '';
      }
    });

    const updatedRows = [...rows, newRow];
    onUpdateCurriculum({
      columns,
      rows: updatedRows
    });
  };

  const handleDeleteRow = (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus baris ini?')) return;
    
    // Filter and update No sequentially to keep it clean
    const filteredRows = rows.filter(r => r.id !== id);
    const updatedRows = filteredRows.map((r, idx) => ({
      ...r,
      no: (idx + 1).toString()
    }));

    onUpdateCurriculum({
      columns,
      rows: updatedRows
    });
  };

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    const colId = `col_${Date.now()}`;
    const newCol: CurriculumColumn = {
      id: colId,
      name: newColName.trim()
    };

    const updatedColumns = [...columns, newCol];
    const updatedRows = rows.map(r => ({
      ...r,
      [colId]: ''
    }));

    onUpdateCurriculum({
      columns: updatedColumns,
      rows: updatedRows
    });

    setNewColName('');
    setIsAddColOpen(false);
  };

  const handleDeleteColumn = (colId: string, colName: string) => {
    if (colId === 'no' || colId === 'subject') {
      alert('Kolom utama tidak dapat dihapus!');
      return;
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus kolom "${colName}"? Semua data di kolom ini akan hilang.`)) return;

    const updatedColumns = columns.filter(c => c.id !== colId);
    const updatedRows = rows.map(r => {
      const copy = { ...r };
      delete copy[colId];
      return copy;
    });

    onUpdateCurriculum({
      columns: updatedColumns,
      rows: updatedRows
    });
  };

  const handleCellChange = (rowId: string, colId: string, value: string) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        return { ...r, [colId]: value };
      }
      return r;
    });
    onUpdateCurriculum({
      columns,
      rows: updatedRows
    });
  };

  const handleOpenEditRow = (row: CurriculumRow) => {
    setEditingRow({ ...row });
    setIsEditRowOpen(true);
  };

  const handleSaveEditRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;

    const updatedRows = rows.map(r => r.id === editingRow.id ? editingRow : r);
    onUpdateCurriculum({
      columns,
      rows: updatedRows
    });

    setIsEditRowOpen(false);
    setEditingRow(null);
  };

  const handleResetToDefault = () => {
    if (!confirm('Apakah Anda yakin ingin mengatur ulang tabel kurikulum ke struktur standar? Seluruh perubahan saat ini akan diganti.')) return;
    
    const standardCurriculum: CurriculumData = {
      columns: [
        { id: 'no', name: 'No' },
        { id: 'subject', name: 'Mata Pelajaran' },
        { id: 'intra_hours', name: 'Alokasi Intrakurikuler per Tahun (JP)' },
        { id: 'p5_hours', name: 'Alokasi Projek P5 per Tahun (JP)' },
        { id: 'total_hours', name: 'Total JP per Tahun' },
        { id: 'capaian', name: 'Capaian Pembelajaran' },
        { id: 'elemen', name: 'Elemen Capaian Pembelajaran' },
        { id: 'tujuan', name: 'Tujuan Pembelajaran' },
        { id: 'notes', name: 'Keterangan' }
      ],
      rows: [
        { 
          id: 'r1', 
          no: '1', 
          subject: 'Pendidikan Agama dan Budi Pekerti', 
          intra_hours: '108', 
          p5_hours: '36', 
          total_hours: '144', 
          capaian: 'Peserta didik mampu memahami nilai-nilai keagamaan, akhlak mulia, dan sejarah kebudayaan agama.',
          elemen: ["Al-Qur'an dan Hadis", "Akidah dan Akhlak"],
          tujuan: [
            { code: 'PABP.1', desc: 'Membaca dan melafalkan ayat dengan makhraj yang benar.' },
            { code: 'PABP.2', desc: 'Menjelaskan perilaku akhlak mulia dalam kehidupan sehari-hari.' }
          ],
          notes: 'Kurikulum Merdeka' 
        },
        { 
          id: 'r2', 
          no: '2', 
          subject: 'Pendidikan Pancasila', 
          intra_hours: '144', 
          p5_hours: '36', 
          total_hours: '180', 
          capaian: 'Peserta didik memahami Pancasila sebagai dasar negara, UUD NRI Tahun 1945, NKRI, dan Bhinneka Tunggal Ika.',
          elemen: ["Pancasila", "Undang-Undang Dasar NRI 1945", "Bhinneka Tunggal Ika"],
          tujuan: [
            { code: 'PP.1', desc: 'Menjelaskan fungsi dan kedudukan Pancasila.' },
            { code: 'PP.2', desc: 'Menerapkan nilai-nilai gotong royong di lingkungan sekolah.' }
          ],
          notes: 'Wajib Nasional' 
        },
        { 
          id: 'r3', 
          no: '3', 
          subject: 'Bahasa Indonesia', 
          intra_hours: '216', 
          p5_hours: '36', 
          total_hours: '252', 
          capaian: 'Peserta didik memiliki kemampuan berbahasa untuk berkomunikasi, membaca, menulis, dan berdiskusi dengan efektif.',
          elemen: ["Menyimak", "Membaca dan Memirsa", "Berbicara dan Mempresentasikan", "Menulis"],
          tujuan: [
            { code: 'IND.1', desc: 'Menemukan informasi penting dari teks eksposisi.' },
            { code: 'IND.2', desc: 'Menulis teks narasi dengan struktur kebahasaan yang runtut.' }
          ],
          notes: 'Kompetensi Bahasa' 
        },
        { 
          id: 'r4', 
          no: '4', 
          subject: 'Matematika', 
          intra_hours: '144', 
          p5_hours: '36', 
          total_hours: '180', 
          capaian: 'Peserta didik mampu melakukan operasi aritmetika, aljabar, geometri, dan analisis data.',
          elemen: ["Bilangan", "Aljabar", "Pengukuran"],
          tujuan: [
            { code: 'MAT.1', desc: 'Melakukan operasi hitung bilangan bulat dan pecahan.' },
            { code: 'MAT.2', desc: 'Menyelesaikan persamaan linier satu variabel.' }
          ],
          notes: 'Numerasi Dasar' 
        },
        { 
          id: 'r5', 
          no: '5', 
          subject: 'IPAS (IPA & IPS)', 
          intra_hours: '180', 
          p5_hours: '36', 
          total_hours: '216', 
          capaian: 'Peserta didik menganalisis fenomena alam, makhluk hidup, interaksi sosial, dan pelestarian lingkungan.',
          elemen: ["Pemahaman IPAS", "Keterampilan Proses"],
          tujuan: [
            { code: 'IPAS.1', desc: 'Menganalisis sistem organisasi kehidupan makhluk hidup.' },
            { code: 'IPAS.2', desc: 'Mengidentifikasi interaksi sosial di masyarakat sekitar.' }
          ],
          notes: 'Kurikulum Merdeka' 
        },
        { 
          id: 'r6', 
          no: '6', 
          subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', 
          intra_hours: '108', 
          p5_hours: '36', 
          total_hours: '144', 
          capaian: 'Peserta didik menunjukkan kemampuan mempraktikkan keterampilan gerak spesifik dan menjaga kesehatan fisik.',
          elemen: ["Keterampilan Gerak", "Pengetahuan Gerak"],
          tujuan: [
            { code: 'PJOK.1', desc: 'Mempraktikkan teknik dasar permainan bola besar.' },
            { code: 'PJOK.2', desc: 'Menjelaskan pola makan sehat bergizi dan seimbang.' }
          ],
          notes: 'Kesehatan Fisik' 
        },
        { 
          id: 'r7', 
          no: '7', 
          subject: 'Seni dan Budaya', 
          intra_hours: '108', 
          p5_hours: '36', 
          total_hours: '144', 
          capaian: 'Peserta didik mampu berkreasi, mengapresiasi karya seni rupa/musik/tari sesuai kearifan lokal.',
          elemen: ["Mengalami", "Menciptakan", "Merefleksikan"],
          tujuan: [
            { code: 'SENI.1', desc: 'Membuat karya seni rupa dua dimensi menggunakan media lokal.' },
            { code: 'SENI.2', desc: 'Menyanyikan lagu daerah dengan intonasi dan artikulasi yang tepat.' }
          ],
          notes: 'Seni Rupa/Musik/Tari' 
        },
        { 
          id: 'r8', 
          no: '8', 
          subject: 'Bahasa Inggris', 
          intra_hours: '72', 
          p5_hours: '0', 
          total_hours: '72', 
          capaian: 'Peserta didik mampu menggunakan bahasa Inggris untuk berinteraksi, membaca, dan menulis topik sederhana.',
          elemen: ["Menyimak - Berbicara", "Membaca - Memirsa", "Menulis - Mempresentasikan"],
          tujuan: [
            { code: 'ING.1', desc: 'Menggunakan kalimat sapaan dan perkenalan diri dalam bahasa Inggris.' },
            { code: 'ING.2', desc: 'Membaca teks deskriptif pendek dan memahami ide pokok.' }
          ],
          notes: 'Mata Pelajaran Pilihan' 
        },
        { 
          id: 'r9', 
          no: '9', 
          subject: 'Muatan Lokal', 
          intra_hours: '72', 
          p5_hours: '0', 
          total_hours: '72', 
          capaian: 'Peserta didik mempelajari tradisi, bahasa daerah, dan kearifan lokal daerah setempat.',
          elemen: ["Apresiasi Bahasa Daerah", "Seni Tradisional"],
          tujuan: [
            { code: 'MULOK.1', desc: 'Melafalkan kosakata sopan santun dalam bahasa daerah.' },
            { code: 'MULOK.2', desc: 'Mengidentifikasi jenis upacara adat tradisional setempat.' }
          ],
          notes: 'Bahasa Daerah / Budaya Lokal' 
        },
      ]
    };

    onUpdateCurriculum(standardCurriculum);
  };

  // Helper mutators for "Capaian Pembelajaran"
  const getCapaianList = (row: CurriculumRow): string[] => {
    const val = row.capaian;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim()) {
      return [val];
    }
    return [];
  };

  const handleAddCapaian = (rowId: string) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const arr = getCapaianList(r);
        return { ...r, capaian: [...arr, ''] };
      }
      return r;
    });
    onUpdateCurriculum({ columns, rows: updatedRows });
  };

  const handleRemoveCapaian = (rowId: string, index: number) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const arr = getCapaianList(r);
        const copy = [...arr];
        copy.splice(index, 1);
        return { ...r, capaian: copy };
      }
      return r;
    });
    onUpdateCurriculum({ columns, rows: updatedRows });
  };

  const handleUpdateCapaian = (rowId: string, index: number, value: string) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const arr = getCapaianList(r);
        const copy = [...arr];
        copy[index] = value;
        return { ...r, capaian: copy };
      }
      return r;
    });
    onUpdateCurriculum({ columns, rows: updatedRows });
  };

  // Helper mutators for "Elemen" and "Tujuan Pembelajaran"
  const handleAddElemen = (rowId: string) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const arr = Array.isArray(r.elemen) ? [...r.elemen] : [];
        arr.push('');
        return { ...r, elemen: arr };
      }
      return r;
    });
    onUpdateCurriculum({ columns, rows: updatedRows });
  };

  const handleRemoveElemen = (rowId: string, index: number) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const arr = Array.isArray(r.elemen) ? [...r.elemen] : [];
        arr.splice(index, 1);
        return { ...r, elemen: arr };
      }
      return r;
    });
    onUpdateCurriculum({ columns, rows: updatedRows });
  };

  const handleUpdateElemen = (rowId: string, index: number, value: string) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const arr = Array.isArray(r.elemen) ? [...r.elemen] : [];
        arr[index] = value;
        return { ...r, elemen: arr };
      }
      return r;
    });
    onUpdateCurriculum({ columns, rows: updatedRows });
  };

  const handleAddTujuan = (rowId: string) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const arr = Array.isArray(r.tujuan) ? [...r.tujuan] : [];
        const nextIdx = arr.length + 1;
        arr.push({ code: `TP.${nextIdx}`, desc: '' });
        return { ...r, tujuan: arr };
      }
      return r;
    });
    onUpdateCurriculum({ columns, rows: updatedRows });
  };

  const handleRemoveTujuan = (rowId: string, index: number) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const arr = Array.isArray(r.tujuan) ? [...r.tujuan] : [];
        arr.splice(index, 1);
        return { ...r, tujuan: arr };
      }
      return r;
    });
    onUpdateCurriculum({ columns, rows: updatedRows });
  };

  const handleUpdateTujuan = (rowId: string, index: number, field: 'code' | 'desc', value: string) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        const arr = Array.isArray(r.tujuan) ? [...r.tujuan] : [];
        if (!arr[index]) {
          arr[index] = { code: '', desc: '' };
        }
        arr[index] = { ...arr[index], [field]: value };
        return { ...r, tujuan: arr };
      }
      return r;
    });
    onUpdateCurriculum({ columns, rows: updatedRows });
  };

  // Google Sheets Export
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
      const headersArray = columns.map(c => c.name);
      const rowsArray = rows.map(r => columns.map(c => {
        const val = r[c.id];
        if (c.id === 'capaian') {
          return Array.isArray(val) ? val.join('; ') : (val || '').toString();
        }
        if (c.id === 'elemen') {
          return Array.isArray(val) ? val.join('; ') : '';
        }
        if (c.id === 'tujuan') {
          return Array.isArray(val) ? val.map(t => `[${t.code || ''}] ${t.desc || ''}`).join('; ') : '';
        }
        return (val || '').toString();
      }));

      const payload: SheetExportPayload = {
        title: 'Alokasi Kurikulum',
        headers: headersArray,
        rows: rowsArray,
      };

      const url = await exportToGoogleSheets(token, payload);
      setExportedSheetUrl(url);
    } catch (err: any) {
      console.error(err);
      alert('Gagal mengekspor kurikulum ke Google Sheet: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Google Sheets Import
  const handleImportSheets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrlInput) {
      alert('Silakan masukkan link spreadsheet!');
      return;
    }

    // Extract Spreadsheet ID from Google Sheets URL
    const idMatch = sheetUrlInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = idMatch ? idMatch[1] : sheetUrlInput.trim();

    if (!spreadsheetId) {
      alert('Link atau ID Spreadsheet tidak valid!');
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

    setIsImporting(true);
    try {
      const rawData = await importFromGoogleSheets(token, spreadsheetId, importRange);
      if (!rawData || rawData.length === 0) {
        alert('Tidak ada data yang ditemukan di spreadsheet pada range tersebut!');
        return;
      }

      // Reconstruct curriculum structure dynamically from the Google Sheet
      const headers = rawData[0];
      const dataRows = rawData.slice(1);

      // Map headers to columns
      const importedColumns: CurriculumColumn[] = headers.map((h, i) => {
        let id = '';
        const hLower = (h || '').toLowerCase();
        if (i === 0) id = 'no';
        else if (i === 1) id = 'subject';
        else if (hLower.includes('capaian pembelajaran')) id = 'capaian';
        else if (hLower.includes('elemen')) id = 'elemen';
        else if (hLower.includes('tujuan')) id = 'tujuan';
        else id = `col_${Date.now()}_${i}`;
        
        return { id, name: h || `Kolom ${i + 1}` };
      });

      // Map rows
      const importedRows: CurriculumRow[] = dataRows.map((r, rowIdx) => {
        const rowObj: CurriculumRow = { id: `row_imported_${Date.now()}_${rowIdx}` };
        importedColumns.forEach((col, colIdx) => {
          const rawVal = r[colIdx] || '';
          if (col.id === 'capaian') {
            rowObj[col.id] = rawVal ? rawVal.split(/[;\n]+/).map((s: string) => s.trim()).filter(Boolean) : [];
          } else if (col.id === 'elemen') {
            rowObj[col.id] = rawVal ? rawVal.split(/[;\n]+/).map((s: string) => s.trim()).filter(Boolean) : [];
          } else if (col.id === 'tujuan') {
            if (!rawVal) {
              rowObj[col.id] = [];
            } else {
              const items = rawVal.split(/[;\n]+/).map((s: string) => s.trim()).filter(Boolean);
              rowObj[col.id] = items.map((item: string, idx: number) => {
                const match = item.match(/^\[([^\]]+)\]\s*(.*)$/);
                if (match) {
                  return { code: match[1].trim(), desc: match[2].trim() };
                } else {
                  return { code: `TP.${idx + 1}`, desc: item };
                }
              });
            }
          } else {
            rowObj[col.id] = rawVal;
          }
        });
        return rowObj;
      });

      onUpdateCurriculum({
        columns: importedColumns,
        rows: importedRows
      });

      alert('Kurikulum berhasil diimpor dari Google Sheet!');
      setIsImportOpen(false);
      setSheetUrlInput('');
    } catch (err: any) {
      console.error(err);
      alert('Gagal mengimpor kurikulum dari Google Sheet: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <TableIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-snug">Kurikulum & Alokasi JP</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Kelola data mata pelajaran, alokasi intrakurikuler, projek P5, dan total beban mengajar tahunan secara manual.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setQuickEditMode(!quickEditMode)}
            className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all flex items-center space-x-1.5 ${
              quickEditMode 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Edit className="w-3.5 h-3.5" />
            <span>{quickEditMode ? 'Nonaktifkan Edit Cepat' : 'Edit Cepat di Tabel'}</span>
          </button>

          <button
            onClick={handleResetToDefault}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5"
            title="Atur ulang ke standar Kurikulum Merdeka"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Struktur</span>
          </button>
        </div>
      </div>

      {/* TABLE OPERATIONS BAR */}
      <div className="bg-slate-100/60 dark:bg-slate-900/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-200/50 dark:border-slate-800/40">
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Row Button */}
          <button
            onClick={handleAddRow}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 shadow-md shadow-indigo-600/10"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Baris</span>
          </button>

          {/* Add Column Button */}
          <button
            onClick={() => setIsAddColOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 shadow-md shadow-emerald-600/10"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kolom</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sheets Export Button */}
          <button
            onClick={handleExportSheets}
            disabled={isExporting}
            className="bg-white dark:bg-slate-850 hover:bg-slate-50 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5"
          >
            {isExporting ? (
              <span className="w-4 h-4 border-2 border-slate-400 border-t-indigo-600 rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-emerald-600" />
            )}
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor ke Google Sheet'}</span>
          </button>

          {/* Sheets Import Button */}
          <button
            onClick={() => setIsImportOpen(true)}
            className="bg-white dark:bg-slate-850 hover:bg-slate-50 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>Impor dari Google Sheet</span>
          </button>
        </div>
      </div>

      {/* SUCCESS SHEET EXPORT NOTIFICATION LINK */}
      {exportedSheetUrl && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold">Ekspor Google Sheet Berhasil!</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Spreadsheet baru telah berhasil dibuat di akun Google Anda.</p>
            </div>
          </div>
          <a
            href={exportedSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/10"
          >
            Buka Spreadsheet
          </a>
        </div>
      )}

      {/* CURRICULUM TABLE COMPONENT */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800">
                {columns.map(col => (
                  <th key={col.id} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider relative group">
                    <div className="flex items-center justify-between pr-4">
                      <span>{col.name}</span>
                      
                      {/* Delete Column button inside header (only for custom added columns) */}
                      {col.id !== 'no' && col.id !== 'subject' && (
                        <button
                          onClick={() => handleDeleteColumn(col.id, col.name)}
                          className="opacity-0 group-hover:opacity-100 p-1 bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100 rounded transition-all ml-2"
                          title={`Hapus kolom "${col.name}"`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="p-8 text-center text-sm text-slate-400">
                    Belum ada data kurikulum. Silakan tambah baris baru atau klik "Reset Struktur".
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition-all">
                    {columns.map(col => {
                      const isLockedNo = col.id === 'no';
                      
                      if (col.id === 'capaian') {
                        const capaianList = getCapaianList(row);
                        return (
                          <td key={col.id} className="p-3 text-xs min-w-[240px]">
                            <div className="space-y-2">
                              {capaianList.map((cp, cpIdx) => (
                                <div key={cpIdx} className="group/cp flex items-start space-x-1.5">
                                  {quickEditMode ? (
                                    <>
                                      <textarea
                                        rows={2}
                                        value={cp || ''}
                                        onChange={(e) => handleUpdateCapaian(row.id, cpIdx, e.target.value)}
                                        placeholder={`Capaian Pembelajaran Paragraf ${cpIdx + 1}`}
                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 text-xs"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCapaian(row.id, cpIdx)}
                                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-all mt-1"
                                        title="Hapus Capaian"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <div className="flex-1 text-slate-700 dark:text-slate-350 leading-relaxed whitespace-pre-line bg-slate-50/50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800/40">
                                      {cp || <em className="text-slate-400">Kosong</em>}
                                    </div>
                                  )}
                                </div>
                              ))}
                              
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddCapaian(row.id);
                                  if (!quickEditMode) setQuickEditMode(true);
                                }}
                                className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center space-x-1 py-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Tambah Capaian</span>
                              </button>

                              {!quickEditMode && capaianList.length === 0 && (
                                <span className="text-slate-400 italic text-xs block">Belum ada capaian pembelajaran</span>
                              )}
                            </div>
                          </td>
                        );
                      }

                      if (col.id === 'elemen') {
                        const elementList = Array.isArray(row.elemen) ? row.elemen : [];
                        return (
                          <td key={col.id} className="p-3 text-xs min-w-[200px]">
                            <div className="space-y-2">
                              {elementList.map((el, elIdx) => (
                                <div key={elIdx} className="flex items-center space-x-1">
                                  {quickEditMode ? (
                                    <>
                                      <input
                                        type="text"
                                        value={el || ''}
                                        onChange={(e) => handleUpdateElemen(row.id, elIdx, e.target.value)}
                                        placeholder={`Elemen ${elIdx + 1}`}
                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 text-xs"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveElemen(row.id, elIdx)}
                                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-all"
                                        title="Hapus Elemen"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <div className="flex items-center space-x-1.5 bg-indigo-50/60 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-lg text-xs border border-indigo-100/30 w-full">
                                      <span className="font-semibold text-indigo-400">{elIdx + 1}.</span>
                                      <span className="truncate">{el || <em className="text-slate-400">Kosong</em>}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                              
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddElemen(row.id);
                                  if (!quickEditMode) setQuickEditMode(true);
                                }}
                                className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center space-x-1 py-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Tambah Elemen</span>
                              </button>

                              {!quickEditMode && elementList.length === 0 && (
                                <span className="text-slate-400 italic text-xs block">Belum ada elemen</span>
                              )}
                            </div>
                          </td>
                        );
                      }

                      if (col.id === 'tujuan') {
                        const tujuanList = Array.isArray(row.tujuan) ? row.tujuan : [];
                        return (
                          <td key={col.id} className="p-3 text-xs min-w-[340px] max-w-[480px]">
                            <div className="space-y-2">
                              {tujuanList.length > 0 && (
                                <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm bg-slate-50/40 dark:bg-slate-900/40">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                        <th className="p-1.5 text-[10px] font-bold text-slate-400 uppercase w-20">Kode TP</th>
                                        <th className="p-1.5 text-[10px] font-bold text-slate-400 uppercase">Deskripsi Tujuan Pembelajaran</th>
                                        {quickEditMode && <th className="p-1.5 text-[10px] font-bold text-slate-400 uppercase w-8 text-center"></th>}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                      {tujuanList.map((tp, tpIdx) => (
                                        <tr key={tpIdx} className="hover:bg-white/40 dark:hover:bg-slate-850/40">
                                          <td className="p-1.5 align-top">
                                            {quickEditMode ? (
                                              <input
                                                type="text"
                                                value={tp.code || ''}
                                                onChange={(e) => handleUpdateTujuan(row.id, tpIdx, 'code', e.target.value)}
                                                placeholder="e.g. TP.1"
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                              />
                                            ) : (
                                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded text-[10px]">
                                                {tp.code || '-'}
                                              </span>
                                            )}
                                          </td>
                                          <td className="p-1.5">
                                            {quickEditMode ? (
                                              <textarea
                                                rows={2}
                                                value={tp.desc || ''}
                                                onChange={(e) => handleUpdateTujuan(row.id, tpIdx, 'desc', e.target.value)}
                                                placeholder="Masukkan deskripsi tujuan..."
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                              />
                                            ) : (
                                              <span className="text-slate-600 dark:text-slate-350 text-xs leading-relaxed block whitespace-pre-line">
                                                {tp.desc || <em className="text-slate-400">Belum ada deskripsi</em>}
                                              </span>
                                            )}
                                          </td>
                                          {quickEditMode && (
                                            <td className="p-1.5 text-center">
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveTujuan(row.id, tpIdx)}
                                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                                                title="Hapus Tujuan"
                                              >
                                                <X className="w-3.5 h-3.5" />
                                              </button>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddTujuan(row.id);
                                  if (!quickEditMode) setQuickEditMode(true);
                                }}
                                className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center space-x-1 py-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Tambah Tujuan (TP)</span>
                              </button>

                              {!quickEditMode && tujuanList.length === 0 && (
                                <span className="text-slate-400 italic text-xs block">Belum ada tujuan pembelajaran</span>
                              )}
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={col.id} className="p-3 text-xs">
                          {quickEditMode && !isLockedNo ? (
                            <input
                              type="text"
                              value={row[col.id] || ''}
                              onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                            />
                          ) : (
                            <span className={isLockedNo ? 'font-bold text-slate-400 dark:text-slate-500 px-1' : 'text-slate-700 dark:text-slate-350'}>
                              {row[col.id] || '-'}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Actions Column */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => handleOpenEditRow(row)}
                          className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/30 dark:text-indigo-400 rounded-xl transition-all"
                          title="Edit Baris"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100 hover:text-rose-750 dark:hover:bg-rose-900/30 dark:text-rose-450 rounded-xl transition-all"
                          title="Hapus Baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD CUSTOM COLUMN */}
      {isAddColOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 max-w-md w-full overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                <TableIcon className="w-5 h-5 text-indigo-500" />
                <span>Tambah Kolom Baru</span>
              </h3>
              <button onClick={() => setIsAddColOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddColumn} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nama Kolom</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Alokasi Semester 1, Guru Pengampu, dll."
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddColOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10 transition-all"
                >
                  Tambah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ROW DETAILS */}
      {isEditRowOpen && editingRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 max-w-xl w-full overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                <Edit className="w-5 h-5 text-indigo-500" />
                <span>Edit Data Kurikulum</span>
              </h3>
              <button onClick={() => setIsEditRowOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRow} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {columns.map(col => {
                const isLockedNo = col.id === 'no';

                if (col.id === 'capaian') {
                  const editingCapaian = getCapaianList(editingRow);
                  return (
                    <div key={col.id} className="space-y-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {col.name}
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {editingCapaian.map((cp, cpIdx) => (
                          <div key={cpIdx} className="flex items-start space-x-2">
                            <textarea
                              rows={2}
                              value={cp || ''}
                              onChange={(e) => {
                                const updated = [...editingCapaian];
                                updated[cpIdx] = e.target.value;
                                setEditingRow({ ...editingRow, capaian: updated });
                              }}
                              placeholder={`Capaian Pembelajaran Paragraf ${cpIdx + 1}`}
                              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRow({ ...editingRow, capaian: editingCapaian.filter((_, idx) => idx !== cpIdx) });
                              }}
                              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all mt-1"
                              title="Hapus Capaian"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRow({ ...editingRow, capaian: [...editingCapaian, ''] });
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center space-x-1 py-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Capaian</span>
                      </button>
                    </div>
                  );
                }

                if (col.id === 'elemen') {
                  const editingElemen = Array.isArray(editingRow.elemen) ? editingRow.elemen : [];
                  return (
                    <div key={col.id} className="space-y-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {col.name}
                      </label>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {editingElemen.map((el, elIdx) => (
                          <div key={elIdx} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={el || ''}
                              onChange={(e) => {
                                const updated = [...editingElemen];
                                updated[elIdx] = e.target.value;
                                setEditingRow({ ...editingRow, elemen: updated });
                              }}
                              placeholder={`Elemen ${elIdx + 1}`}
                              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRow({ ...editingRow, elemen: editingElemen.filter((_, idx) => idx !== elIdx) });
                              }}
                              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                              title="Hapus Elemen"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRow({ ...editingRow, elemen: [...editingElemen, ''] });
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center space-x-1 py-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Elemen</span>
                      </button>
                    </div>
                  );
                }

                if (col.id === 'tujuan') {
                  const editingTujuan = Array.isArray(editingRow.tujuan) ? editingRow.tujuan : [];
                  return (
                    <div key={col.id} className="space-y-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {col.name}
                      </label>
                      
                      <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-sm bg-slate-50/40 dark:bg-slate-900/40">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                              <th className="p-2.5 text-[10px] font-bold text-slate-400 uppercase w-24">Kode TP</th>
                              <th className="p-2.5 text-[10px] font-bold text-slate-400 uppercase">Deskripsi Tujuan Pembelajaran</th>
                              <th className="p-2.5 text-[10px] font-bold text-slate-400 uppercase w-10 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {editingTujuan.map((tp, tpIdx) => (
                              <tr key={tpIdx} className="hover:bg-white/40 dark:hover:bg-slate-850/40">
                                <td className="p-2 align-top">
                                  <input
                                    type="text"
                                    value={tp.code || ''}
                                    onChange={(e) => {
                                      const updated = [...editingTujuan];
                                      updated[tpIdx] = { ...updated[tpIdx], code: e.target.value };
                                      setEditingRow({ ...editingRow, tujuan: updated });
                                    }}
                                    placeholder="e.g. TP.1"
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                  />
                                </td>
                                <td className="p-2">
                                  <textarea
                                    rows={2}
                                    value={tp.desc || ''}
                                    onChange={(e) => {
                                      const updated = [...editingTujuan];
                                      updated[tpIdx] = { ...updated[tpIdx], desc: e.target.value };
                                      setEditingRow({ ...editingRow, tujuan: updated });
                                    }}
                                    placeholder="Masukkan deskripsi tujuan..."
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                  />
                                </td>
                                <td className="p-2 text-center align-middle">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRow({ ...editingRow, tujuan: editingTujuan.filter((_, idx) => idx !== tpIdx) });
                                    }}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                                    title="Hapus Tujuan"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = editingTujuan.length + 1;
                          setEditingRow({ ...editingRow, tujuan: [...editingTujuan, { code: `TP.${nextIdx}`, desc: '' }] });
                        }}
                        className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center space-x-1 py-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Tujuan (TP)</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={col.id}>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      {col.name} {isLockedNo && '(Kunci)'}
                    </label>
                    <input
                      type="text"
                      disabled={isLockedNo}
                      value={editingRow[col.id] || ''}
                      onChange={(e) => setEditingRow({ ...editingRow, [col.id]: e.target.value })}
                      placeholder={`Masukkan ${col.name.toLowerCase()}`}
                      className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white ${
                        isLockedNo ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-850' : ''
                      }`}
                    />
                  </div>
                );
              })}

              <div className="pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditRowOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10 transition-all flex items-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT FROM GOOGLE SHEET */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 max-w-lg w-full overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                <span>Impor dari Google Sheet</span>
              </h3>
              <button onClick={() => setIsImportOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSheets} className="p-6 space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/60 dark:border-indigo-900/40 text-xs text-indigo-800 dark:text-indigo-300 space-y-2 leading-relaxed">
                <p className="font-bold">💡 Petunjuk Impor Google Sheets:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Pastikan Anda telah menyambungkan Google Drive di tab Sistem.</li>
                  <li>Baris pertama pada spreadsheet akan dianggap sebagai **Header/Nama Kolom**.</li>
                  <li>Baris-baris berikutnya akan menjadi data isi kurikulum.</li>
                  <li>Kolom pertama akan dicocokkan sebagai **Nomor (No)** dan kolom kedua sebagai **Nama Mata Pelajaran**.</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Link / URL Google Sheet</label>
                <input
                  type="text"
                  required
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Range Worksheet (Opsional)</label>
                <input
                  type="text"
                  required
                  placeholder="Sheet1!A1:Z100"
                  value={importRange}
                  onChange={(e) => setImportRange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10 transition-all flex items-center space-x-1.5"
                >
                  {isImporting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{isImporting ? 'Mengimpor...' : 'Impor Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
