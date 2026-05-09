/* exporter.js — v4: Fixed print colors + person in calendar */

const Exporter = (() => {

  const SHIFT_META = {
    night:     { label:'Noćna',          icon:'🌙', color:'#3b82f6', text:'#bfdbfe', bg:'#1e3a5f' },
    morning:   { label:'Jutarnja',        icon:'🌅', color:'#f59e0b', text:'#fde68a', bg:'#451a03' },
    afternoon: { label:'Poslijepodnevna', icon:'☀',  color:'#06b6d4', text:'#a5f3fc', bg:'#0c4a6e' },
    evening:   { label:'Večernja',        icon:'★',  color:'#8b5cf6', text:'#ddd6fe', bg:'#2e1065' },
    custom:    { label:'Prilagođena',     icon:'◆',  color:'#10b981', text:'#a7f3d0', bg:'#064e3b' }
  };
  const SM = t => SHIFT_META[t] || SHIFT_META.custom;

  const DAY_HR   = ['Nedjelja','Ponedjeljak','Utorak','Srijeda','Četvrtak','Petak','Subota'];
  const MONTH_HR = ['Januar','Februar','Mart','April','Maj','Juni',
                    'Juli','August','Septembar','Oktobar','Novembar','Decembar'];

  function pad(n) { return String(n).padStart(2,'0'); }

  // ── Excel Export ─────────────────────────────────────────────────
  function exportExcel(shifts, person, opts = {}) {
    const wb  = XLSX.utils.book_new();
    const psh = shifts.filter(s=>s.person===person).sort((a,b)=>a.date.localeCompare(b.date));

    // Sheet 1: All shifts
    const rows = [];
    rows.push([`RASPORED SMJENA — ${person}`]);
    rows.push([`Generisano: ${new Date().toLocaleDateString('hr-HR')}`]);
    rows.push([]);
    const totalH = psh.reduce((s,x)=>s+(x.hours||0),0).toFixed(1);
    rows.push(['Ukupno smjena:', psh.length, '', 'Ukupno sati:', totalH+'h', '', 'Osoba:', person]);
    rows.push([]);
    rows.push(['#','Datum','Dan','Početak','Kraj','Tip Smjene','Sati','Napomena']);
    psh.forEach((s,i) => {
      const d = new Date(s.date+'T00:00:00');
      rows.push([i+1, s.date, DAY_HR[d.getDay()], s.startTime, s.endTime,
                 SM(s.shiftType).label, s.hours, s.note||'']);
    });
    if (opts.stats && psh.length) {
      rows.push([]);
      rows.push(['STATISTIKE']);
      const byType = {};
      psh.forEach(s=>{ byType[s.shiftType]=(byType[s.shiftType]||0)+1; });
      Object.entries(byType).forEach(([t,c]) => rows.push([SM(t).label, c+' smjena', (c/psh.length*100).toFixed(0)+'%']));
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:4},{wch:12},{wch:14},{wch:10},{wch:10},{wch:20},{wch:7},{wch:22}];
    XLSX.utils.book_append_sheet(wb, ws, `Smjene ${person}`.slice(0,31));

    // Sheet 2: Monthly summary
    if (opts.allMonths) {
      const months = {};
      psh.forEach(s=>{ const k=s.date.slice(0,7); (months[k]=months[k]||[]).push(s); });
      const mRows = [];
      mRows.push([`MJESECNI PREGLED — ${person}`]);
      mRows.push([]);
      mRows.push(['Mjesec','Smjena','Nocnih','Jutarnjih','Poslijepodnevnih','Vecernjih','Sati']);
      Object.entries(months).sort().forEach(([key,ms])=>{
        const [y,m]=key.split('-');
        mRows.push([`${MONTH_HR[parseInt(m)-1]} ${y}`, ms.length,
          ms.filter(s=>s.shiftType==='night').length,
          ms.filter(s=>s.shiftType==='morning').length,
          ms.filter(s=>s.shiftType==='afternoon').length,
          ms.filter(s=>s.shiftType==='evening').length,
          ms.reduce((s,x)=>s+(x.hours||0),0).toFixed(1)]);
      });
      mRows.push(['UKUPNO', psh.length,
        psh.filter(s=>s.shiftType==='night').length,
        psh.filter(s=>s.shiftType==='morning').length,
        psh.filter(s=>s.shiftType==='afternoon').length,
        psh.filter(s=>s.shiftType==='evening').length,
        psh.reduce((s,x)=>s+(x.hours||0),0).toFixed(1)]);
      const ws2 = XLSX.utils.aoa_to_sheet(mRows);
      ws2['!cols'] = [{wch:20},{wch:10},{wch:10},{wch:12},{wch:18},{wch:12},{wch:10}];
      XLSX.utils.book_append_sheet(wb, ws2, 'Mjesecni Pregled');
    }

    return XLSX.write(wb, { type:'base64', bookType:'xlsx' });
  }

  // ── PDF / Print HTML ─────────────────────────────────────────────
  function buildPrintHTML(shifts, person, year, month, avatarDataUrl) {
    const psh      = shifts.filter(s=>s.person===person);
    const monthStr = `${year}-${pad(month+1)}`;
    const monthly  = psh.filter(s=>s.date.startsWith(monthStr));
    const allMonths= [...new Set(psh.map(s=>s.date.slice(0,7)))].sort();
    const today    = new Date().toISOString().slice(0,10);

    // Stats
    const totalShifts = monthly.length;
    const totalHours  = monthly.reduce((s,x)=>s+(x.hours||0),0).toFixed(1);
    const byType = {};
    monthly.forEach(s=>{ byType[s.shiftType]=(byType[s.shiftType]||0)+1; });

    // Avatar HTML
    const ini = person.split(/\s+/).map(w=>w[0]).join('').slice(0,2);
    const avatarEl = avatarDataUrl
      ? `<img src="${avatarDataUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2.5px solid #06b6d4;display:block">`
      : `<div style="width:52px;height:52px;border-radius:50%;background:#0e2a4a;border:2.5px solid #06b6d4;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#06b6d4">${ini}</div>`;

    // Stat cards
    const statCards = [
      { icon:'📅', val: totalShifts, lbl:'Smjena u mjes.' },
      { icon:'⏱', val: totalHours+'h', lbl:'Sati rada' },
      ...Object.entries(byType).map(([t,c])=>({ icon: SM(t).icon, val: c, lbl: SM(t).label, color: SM(t).color }))
    ].map(s=>`
      <div style="background:#0f1729;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;flex:1;min-width:80px;text-align:center">
        <div style="font-size:18px;margin-bottom:2px">${s.icon}</div>
        <div style="font-size:20px;font-weight:800;color:${s.color||'#06b6d4'}">${s.val}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#475569;margin-top:3px">${s.lbl}</div>
      </div>`).join('');

    // Calendar
    const firstDow = (new Date(year,month,1).getDay()+6)%7;
    const lastDate = new Date(year,month+1,0).getDate();
    const shiftMap = {};
    monthly.forEach(s=>{ (shiftMap[s.date]=shiftMap[s.date]||[]).push(s); });

    let calRows = '<tr>';
    for (let i=0; i<firstDow; i++) {
      calRows += `<td style="background:#0a0f1a;border:1px solid #0d1520;min-height:60px;padding:5px;vertical-align:top"></td>`;
    }
    for (let d=1; d<=lastDate; d++) {
      const ds  = `${year}-${pad(month+1)}-${pad(d)}`;
      const dsh = shiftMap[ds]||[];
      const isToday = ds===today;
      const dow = new Date(ds+'T00:00:00').getDay();
      const isWeekend = dow===0||dow===6;
      const bg = dsh.length ? '#0d1e35' : isWeekend ? '#0b1220' : '#0f1729';
      const outline = isToday ? 'box-shadow:inset 0 0 0 2px #06b6d4;' : '';

      let inner = `<div style="font-size:11px;font-weight:${dsh.length?'700':'400'};color:${dsh.length?'#94a3b8':'#334155'};margin-bottom:5px">${d}${isToday?'<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#06b6d4;margin-left:4px;vertical-align:middle"></span>':''}</div>`;

      dsh.forEach(s=>{
        const m=SM(s.shiftType);
        // Person avatar/initials mini
        const miniAv = avatarDataUrl
          ? `<img src="${avatarDataUrl}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;border:1.5px solid ${m.color};flex-shrink:0">`
          : `<div style="width:20px;height:20px;border-radius:50%;background:${m.bg};border:1.5px solid ${m.color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:${m.text};flex-shrink:0">${ini}</div>`;

        inner += `
          <div style="background:${m.bg};border-left:3px solid ${m.color};border-radius:5px;padding:5px 7px;margin-bottom:3px;display:flex;align-items:center;gap:6px">
            ${miniAv}
            <div style="min-width:0">
              <div style="font-size:11px;font-weight:700;color:${m.text};white-space:nowrap">${person}</div>
              <div style="font-size:10px;color:#94a3b8;font-weight:600">${s.startTime}–${s.endTime}</div>
              <div style="font-size:9px;color:${m.color};font-weight:600">${m.label} · ${s.hours}h</div>
            </div>
          </div>`;
      });

      calRows += `<td style="background:${bg};${outline}border:1px solid #141e30;padding:6px;vertical-align:top;min-height:80px;width:14.28%">${inner}</td>`;
      if ((firstDow+d)%7===0 && d<lastDate) calRows += '</tr><tr>';
    }
    // fill last row
    const filled = (firstDow+lastDate)%7;
    if (filled>0) {
      for (let i=filled; i<7; i++) {
        calRows += `<td style="background:#0a0f1a;border:1px solid #0d1520;min-height:60px;padding:5px"></td>`;
      }
    }
    calRows += '</tr>';

    // Shift list rows — explicit inline styles so print never loses them
    let shiftListHTML = '';
    if (monthly.length > 0) {
      const rowsHTML = monthly.map((s,i)=>{
        const d   = new Date(s.date+'T00:00:00');
        const m   = SM(s.shiftType);
        const bg  = i%2===0 ? '#0f1729' : '#0c1524';
        return `<tr>
          <td style="padding:7px 10px;color:#64748b;font-size:11px;background:${bg};border-bottom:1px solid #141e30">${s.date}</td>
          <td style="padding:7px 10px;color:#94a3b8;font-weight:600;background:${bg};border-bottom:1px solid #141e30">${DAY_HR[d.getDay()]}</td>
          <td style="padding:7px 10px;color:#e2e8f0;font-weight:700;background:${bg};border-bottom:1px solid #141e30">${s.startTime}</td>
          <td style="padding:7px 10px;color:#e2e8f0;font-weight:700;background:${bg};border-bottom:1px solid #141e30">${s.endTime}</td>
          <td style="padding:7px 10px;background:${bg};border-bottom:1px solid #141e30">
            <span style="background:${m.bg};border:1px solid ${m.color};color:${m.text};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;display:inline-block">${m.icon} ${m.label}</span>
          </td>
          <td style="padding:7px 10px;color:#06b6d4;font-weight:700;background:${bg};border-bottom:1px solid #141e30">${s.hours}h</td>
        </tr>`;
      }).join('');

      shiftListHTML = `
        <div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin:24px 0 10px;display:flex;align-items:center;gap:8px">
          <span style="display:inline-block;width:3px;height:14px;background:#06b6d4;border-radius:2px"></span>
          Popis Smjena
        </div>
        <table style="width:100%;border-collapse:collapse;background:#0f1729;border-radius:10px;overflow:hidden;border:1px solid #1e3a5f">
          <thead>
            <tr style="background:#0a1628">
              <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#475569;border-bottom:2px solid #1e3a5f">Datum</th>
              <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#475569;border-bottom:2px solid #1e3a5f">Dan</th>
              <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#475569;border-bottom:2px solid #1e3a5f">Poccetak</th>
              <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#475569;border-bottom:2px solid #1e3a5f">Kraj</th>
              <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#475569;border-bottom:2px solid #1e3a5f">Tip Smjene</th>
              <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#475569;border-bottom:2px solid #1e3a5f">Sati</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>`;
    }

    // Monthly summary
    let monthlySummaryHTML = '';
    if (allMonths.length > 1) {
      const sumRows = allMonths.map((mo,i)=>{
        const ms=psh.filter(s=>s.date.startsWith(mo));
        const [y,mn]=mo.split('-');
        const bg = i%2===0 ? '#0f1729' : '#0c1524';
        const hrs=ms.reduce((s,x)=>s+(x.hours||0),0).toFixed(1);
        return `<tr>
          <td style="padding:8px 12px;font-weight:600;color:#94a3b8;background:${bg};border-bottom:1px solid #141e30">${MONTH_HR[parseInt(mn)-1]} ${y}</td>
          <td style="padding:8px 12px;color:#e2e8f0;font-weight:600;background:${bg};border-bottom:1px solid #141e30">${ms.length}</td>
          <td style="padding:8px 12px;color:#93c5fd;background:${bg};border-bottom:1px solid #141e30">${ms.filter(s=>s.shiftType==='night').length||'—'}</td>
          <td style="padding:8px 12px;color:#fde68a;background:${bg};border-bottom:1px solid #141e30">${ms.filter(s=>s.shiftType==='morning').length||'—'}</td>
          <td style="padding:8px 12px;color:#a5f3fc;background:${bg};border-bottom:1px solid #141e30">${ms.filter(s=>s.shiftType==='afternoon').length||'—'}</td>
          <td style="padding:8px 12px;color:#ddd6fe;background:${bg};border-bottom:1px solid #141e30">${ms.filter(s=>s.shiftType==='evening').length||'—'}</td>
          <td style="padding:8px 12px;color:#06b6d4;font-weight:700;background:${bg};border-bottom:1px solid #141e30">${hrs}h</td>
        </tr>`;
      }).join('');

      monthlySummaryHTML = `
        <div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin:24px 0 10px;display:flex;align-items:center;gap:8px">
          <span style="display:inline-block;width:3px;height:14px;background:#06b6d4;border-radius:2px"></span>
          Pregled po Mjesecima
        </div>
        <table style="width:100%;border-collapse:collapse;background:#0f1729;border-radius:10px;overflow:hidden;border:1px solid #1e3a5f">
          <thead>
            <tr style="background:#0a1628">
              <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#475569;border-bottom:2px solid #1e3a5f;text-transform:uppercase">Mj.</th>
              <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#475569;border-bottom:2px solid #1e3a5f;text-transform:uppercase">Ukupno</th>
              <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#3b82f6;border-bottom:2px solid #1e3a5f">🌙 Nocna</th>
              <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#f59e0b;border-bottom:2px solid #1e3a5f">🌅 Jutarnja</th>
              <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#06b6d4;border-bottom:2px solid #1e3a5f">☀ Poslijepodnevna</th>
              <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#8b5cf6;border-bottom:2px solid #1e3a5f">★ Vecernja</th>
              <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#475569;border-bottom:2px solid #1e3a5f;text-transform:uppercase">Sati</th>
            </tr>
          </thead>
          <tbody>${sumRows}</tbody>
        </table>`;
    }

    // Legend
    const legendHTML = Object.entries(SHIFT_META).map(([,m])=>
      `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#94a3b8">
        <div style="width:10px;height:10px;border-radius:2px;background:${m.color}"></div>
        ${m.icon} ${m.label}
      </div>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="hr"><head>
<meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4 portrait;margin:12mm}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#080d1a;color:#e2e8f0;
       padding:16px;font-size:12px;
       -webkit-print-color-adjust:exact;print-color-adjust:exact}
  @media print{
    body{background:#080d1a !important;padding:0}
    *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .no-break{page-break-inside:avoid}
    .page-break{page-break-before:always}
  }
</style>
</head><body>

<!-- HEADER -->
<div style="display:flex;align-items:center;justify-content:space-between;
     margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid #06b6d4">
  <div style="display:flex;align-items:center;gap:14px">
    ${avatarEl}
    <div>
      <div style="font-size:20px;font-weight:800;color:#06b6d4;letter-spacing:-.02em">
        Raspored Smjena — ${person}
      </div>
      <div style="font-size:13px;color:#475569;margin-top:3px">
        ${MONTH_HR[month]} ${year} &nbsp;·&nbsp; Generisano: ${new Date().toLocaleDateString('hr-HR',{day:'2-digit',month:'2-digit',year:'numeric'})}
      </div>
    </div>
  </div>
  <div style="text-align:right;font-size:11px;color:#334155;line-height:1.5">
    <strong style="display:block;font-size:13px;color:#475569">Raspored Smjena</strong>
    by AcoRonaldo
  </div>
</div>

<!-- STATS -->
<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">${statCards}</div>

<!-- CALENDAR TITLE -->
<div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;
     letter-spacing:.08em;margin-bottom:7px;display:flex;align-items:center;gap:8px">
  <span style="display:inline-block;width:3px;height:12px;background:#06b6d4;border-radius:2px"></span>
  Kalendar — ${MONTH_HR[month]} ${year}
</div>

<!-- CALENDAR -->
<div style="background:#0f1729;border:1px solid #1e3a5f;border-radius:10px;
     overflow:hidden;margin-bottom:8px">
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#0a1628">
        ${['PON','UTO','SRI','CET','PET','SUB','NED'].map(d=>
          `<th style="padding:9px 8px;font-size:10px;font-weight:700;text-transform:uppercase;
                 letter-spacing:.08em;color:#475569;border-bottom:1px solid #1e3a5f;
                 text-align:center">${d}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${calRows}</tbody>
  </table>
</div>

<!-- LEGEND -->
<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px;font-size:11px">${legendHTML}</div>

${shiftListHTML}
${monthlySummaryHTML}

<!-- FOOTER -->
<div style="margin-top:24px;padding-top:12px;border-top:1px solid #1e293b;
     display:flex;justify-content:space-between;font-size:10px;color:#334155">
  <span>Raspored Smjena by AcoRonaldo &nbsp;·&nbsp; ${person}</span>
  <span>${MONTH_HR[month]} ${year}</span>
</div>

</body></html>`;
  }

  return {
    exportExcel,
    buildPrintHTML,
    SHIFT_LABELS: Object.fromEntries(Object.entries(SHIFT_META).map(([k,v])=>[k,v.label]))
  };
})();
