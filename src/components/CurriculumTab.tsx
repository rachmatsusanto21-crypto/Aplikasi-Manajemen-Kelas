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
        { id: 'notes', name: 'Keterangan' }
      ],
      rows: [
        { id: 'r1', no: '1', subject: 'Pendidikan Agama dan Budi Pekerti', intra_hours: '108', p5_hours: '36', total_hours: '144', notes: 'Kurikulum Merdeka' },
        { id: 'r2', no: '2', subject: 'Pendidikan Pancasila', intra_hours: '144', p5_hours: '36', total_hours: '180', notes: 'Wajib Nasional' },
        { id: 'r3', no: '3', subject: 'Bahasa Indonesia', intra_hours: '216', p5_hours: '36', total_hours: '252', notes: 'Kompetensi Bahasa' },
        { id: 'r4', no: '4', subject: 'Matematika', intra_hours: '144', p5_hours: '36', total_hours: '180', notes: 'Numerasi Dasar' },
        { id: 'r5', no: '5', subject: 'IPAS (IPA & IPS)', intra_hours: '180', p5_hours: '36', total_hours: '216', notes: 'Kurikulum Merdeka' },
        { id: 'r6', no: '6', subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', intra_hours: '108', p5_hours: '36', total_hours: '144', notes: 'Kesehatan Fisik' },
        { id: 'r7', no: '7', subject: 'Seni dan Budaya', intra_hours: '108', p5_hours: '36', total_hours: '144', notes: 'Seni Rupa/Musik/Tari' },
        { id: 'r8', no: '8', subject: 'Bahasa Inggris', intra_hours: '72', p5_hours: '0', total_hours: '72', notes: 'Mata Pelajaran Pilihan' },
        { id: 'r9', no: '9', subject: 'Muatan Lokal', intra_hours: '72', p5_hours: '0', total_hours: '72', notes: 'Bahasa Daerah / Budaya Lokal' },
      ]
    };

    onUpdateCurriculum(standardCurriculum);
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
      const rowsArray = rows.map(r => columns.map(c => (r[c.id] || '').toString()));

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
        if (i === 0) id = 'no';
        else if (i === 1) id = 'subject';
        else id = `col_${Date.now()}_${i}`;
        
        return { id, name: h || `Kolom ${i + 1}` };
      });

      // Map rows
      const importedRows: CurriculumRow[] = dataRows.map((r, rowIdx) => {
        const rowObj: CurriculumRow = { id: `row_imported_${Date.now()}_${rowIdx}` };
        importedColumns.forEach((col, colIdx) => {
          rowObj[col.id] = r[colIdx] || '';
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
