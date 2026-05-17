/* ================================================================
   BuildPro Data Export System — export.js
   ================================================================ */
(function(){
  'use strict';

  const EX = window.BuildProExport = {};

  /* ── Helpers ── */
  function $(s){ return document.querySelector(s); }

  /* ── CSV Export ── */
  EX.exportCSV = function(tableSelector, filename, customHeaders){
    const table = $(tableSelector);
    if(!table){ console.error('Table not found:', tableSelector); return; }

    let csv = '';
    const headers = [];
    const ths = table.querySelectorAll('thead th, thead td');
    ths.forEach((th, i) => {
      if(th.textContent.toLowerCase().includes('işlem') || th.textContent.toLowerCase().includes('actions') || th.textContent.toLowerCase().includes('acties')) return;
      headers.push({ index: i, text: customHeaders && customHeaders[i] ? customHeaders[i] : th.textContent.trim() });
    });

    csv += headers.map(h => '"' + h.text.replace(/"/g, '""') + '"').join(',') + '\n';

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      if(row.style.display === 'none') return;
      const cells = row.querySelectorAll('td');
      const vals = [];
      headers.forEach(h => {
        const cell = cells[h.index];
        if(!cell){ vals.push('""'); return; }
        let text = cell.textContent.trim().replace(/\s+/g, ' ');
        vals.push('"' + text.replace(/"/g, '""') + '"');
      });
      csv += vals.join(',') + '\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '_' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── Excel Export ── */
  EX.exportExcel = function(tableSelector, filename, sheetName){
    const table = $(tableSelector);
    if(!table){ console.error('Table not found:', tableSelector); return; }
    if(typeof XLSX === 'undefined'){ alert('Excel kütüphanesi yükleniyor... / Excel library loading...'); return; }

    const wb = XLSX.utils.book_new();
    const headers = [];
    const ths = table.querySelectorAll('thead th, thead td');
    ths.forEach((th, i) => {
      if(th.textContent.toLowerCase().includes('işlem') || th.textContent.toLowerCase().includes('actions') || th.textContent.toLowerCase().includes('acties')) return;
      headers.push({ index: i, text: th.textContent.trim() });
    });

    const data = [headers.map(h => h.text)];
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      if(row.style.display === 'none') return;
      const cells = row.querySelectorAll('td');
      const rowData = [];
      headers.forEach(h => {
        const cell = cells[h.index];
        if(!cell){ rowData.push(''); return; }
        rowData.push(cell.textContent.trim().replace(/\s+/g, ' '));
      });
      data.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Data');
    XLSX.writeFile(wb, filename + '_' + new Date().toISOString().slice(0,10) + '.xlsx');
  };

  /* ── PDF Export ── */
  EX.exportPDF = function(tableSelector, filename, title, customHeaders){
    const table = $(tableSelector);
    if(!table){ console.error('Table not found:', tableSelector); return; }
    if(typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined'){
      alert('PDF kütüphanesi yükleniyor... / PDF library loading...'); return;
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

    const pageTitle = title || document.querySelector('.page-title')?.textContent.trim() || document.querySelector('.header-title')?.textContent.trim() || 'BuildPro Report';
    const company = 'BuildPro Demo BV';
    const dateStr = new Date().toLocaleDateString();

    doc.setFontSize(18);
    doc.text(pageTitle, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(company + ' — ' + dateStr, 14, 28);

    const headers = [];
    const ths = table.querySelectorAll('thead th, thead td');
    ths.forEach((th, i) => {
      if(th.textContent.toLowerCase().includes('işlem') || th.textContent.toLowerCase().includes('actions') || th.textContent.toLowerCase().includes('acties')) return;
      headers.push({ index: i, text: customHeaders && customHeaders[i] ? customHeaders[i] : th.textContent.trim() });
    });

    const body = [];
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      if(row.style.display === 'none') return;
      const cells = row.querySelectorAll('td');
      const rowData = [];
      headers.forEach(h => {
        const cell = cells[h.index];
        if(!cell){ rowData.push(''); return; }
        rowData.push(cell.textContent.trim().replace(/\s+/g, ' '));
      });
      body.push(rowData);
    });

    doc.autoTable({
      head: [headers.map(h => h.text)],
      body: body,
      startY: 35,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
      didDrawPage: function(data) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('BuildPro — ' + dateStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
        doc.text('Sayfa ' + data.pageNumber, doc.internal.pageSize.width - data.settings.margin.right - 20, doc.internal.pageSize.height - 10);
      }
    });

    doc.save(filename + '_' + new Date().toISOString().slice(0,10) + '.pdf');
  };

  /* ── Print ── */
  EX.printTable = function(tableSelector){
    window.print();
  };

  /* ── Build Export Buttons ── */
  EX.buildButtons = function(config){
    const { container, tableSelector, filename, title, customHeaders } = config;
    const cont = typeof container === 'string' ? $(container) : container;
    if(!cont) return;

    const wrap = document.createElement('div');
    wrap.className = 'export-btns';
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-left:8px;';

    const btnCSV = document.createElement('button');
    btnCSV.className = 'btn btn-secondary btn-sm';
    btnCSV.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV';
    btnCSV.onclick = () => EX.exportCSV(tableSelector, filename, customHeaders);
    wrap.appendChild(btnCSV);

    const btnExcel = document.createElement('button');
    btnExcel.className = 'btn btn-secondary btn-sm';
    btnExcel.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Excel';
    btnExcel.onclick = () => EX.exportExcel(tableSelector, filename, title);
    wrap.appendChild(btnExcel);

    const btnPDF = document.createElement('button');
    btnPDF.className = 'btn btn-secondary btn-sm';
    btnPDF.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF';
    btnPDF.onclick = () => EX.exportPDF(tableSelector, filename, title, customHeaders);
    wrap.appendChild(btnPDF);

    const btnPrint = document.createElement('button');
    btnPrint.className = 'btn btn-secondary btn-sm';
    btnPrint.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
    btnPrint.title = 'Yazdır / Print / Afdrukken';
    btnPrint.onclick = () => EX.printTable(tableSelector);
    wrap.appendChild(btnPrint);

    cont.appendChild(wrap);
  };

  /* ── Auto-init via data-export attribute ── */
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('[data-export-table]').forEach(el => {
      const tableId = el.dataset.exportTable;
      const filename = el.dataset.exportFilename || 'buildpro_export';
      const title = el.dataset.exportTitle || '';
      EX.buildButtons({ container: el, tableSelector: '#' + tableId, filename, title });
    });
  });
})();
