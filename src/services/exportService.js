/**
 * ExportService
 * Exports clean CSV files and triggers PDF/print reports
 */

export class ExportService {
  static exportTableToCSV(filename, rows, headers) {
    if (!rows || rows.length === 0) return;

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  static printReport() {
    window.print();
  }
}
