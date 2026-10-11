import "@fontsource/noto-sans-sinhala/400.css";
import "@fontsource/noto-sans-tamil/400.css";
import {Document,HeadingLevel,Packer,Paragraph,Table,TableCell,TableRow,TextRun,WidthType} from 'docx';
import {jsPDF} from 'jspdf';
import {reportSections,reportTitles,summarizeAttendance,type AttendanceRecord,type ReportType} from '../../shared/reports';
export type DetailedAttendanceRecord=AttendanceRecord;
type Format='pdf'|'docx';
const MIMES:Record<Format,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
export async function saveReport(blob:Blob,filename:string,format:Format):Promise<void>{
  if(!blob.size)throw new Error('Generated report is empty.');
  const native=window.MaestroAndroid;
  if(typeof native?.saveReportFile==='function'){
    if(blob.size>12*1024*1024)throw new Error('Report is too large for mobile export. Choose a shorter date range.');
    const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not prepare report for saving.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.readAsDataURL(blob)});
    if(!base64)throw new Error('Generated report is empty.');
    // Invoke as a method: Android bridge methods must retain their receiver.
    native.saveReportFile(filename,MIMES[format],base64);return;
  }
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function buildAttendanceFile(format:Format,start:string,end:string,rows:AttendanceRecord[],type:ReportType='attendance'):Promise<Blob>{
  if(!rows.length)throw new Error('Generate a report with attendance records before exporting.');
  const sections=reportSections(rows,type),totals=summarizeAttendance(rows).totals;
  const title=reportTitles[type],range='Date range: '+start+' to '+end;
  const summary=`Records: ${totals.total}   Present: ${totals.present}   Absent: ${totals.absent}   Attendance: ${totals.percentage.toFixed(1)}%`;
  const denominator='Percentages use submitted student records; unrecorded days are excluded.';
  if(format==='docx'){
    const cell=(value:string,bold=false)=>new TableCell({children:[new Paragraph({children:[new TextRun({text:value,bold,font:'Nirmala UI',size:20})]})]});
    const children:(Paragraph|Table)[]=[new Paragraph({text:title,heading:HeadingLevel.HEADING_1}),new Paragraph(range),new Paragraph(summary),new Paragraph(denominator)];
    for(const section of sections){children.push(new Paragraph({text:section.title,heading:HeadingLevel.HEADING_2,keepNext:true}),new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({tableHeader:true,children:section.headers.map(h=>cell(h,true))}),...section.rows.map(row=>new TableRow({children:row.map(v=>cell(v))}))]}),new Paragraph(''))}
    return Packer.toBlob(new Document({styles:{default:{document:{run:{font:'Nirmala UI'}}}},sections:[{children}]}));
  }
  // Canvas uses the browser's Unicode shaping and fallback fonts, including Sinhala/Tamil.
  // Raster pages preserve complex scripts without jsPDF's Latin-only built-in fonts.
  await Promise.all([document.fonts.load('23px "Noto Sans Sinhala"',"සිංහල"),document.fonts.load('23px "Noto Sans Tamil"',"தமிழ்")]);
  await document.fonts.ready;
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('PDF rendering is unavailable on this device.');
  const margin=65,right=canvas.width-margin,bottom=canvas.height-75,lineHeight=32;let y=margin,page=0;
  const font=(bold=false,size=23)=>{ctx.font=`${bold?'600':'400'} ${size}px "Nirmala UI", "Noto Sans Sinhala", "Noto Sans Tamil", sans-serif`;ctx.textBaseline='top';ctx.fillStyle='#182c21'};
  const wrap=(value:string,width:number)=>{
    const result:string[]=[];let line='';
    // Split by grapheme rather than UTF-16 code units, preserving combining marks.
    const segments=new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value);
    for(const {segment} of segments){if(line&&ctx.measureText(line+segment).width>width){result.push(line);line=segment}else line+=segment}result.push(line);return result;
  };
  const begin=()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);y=margin;font(true,27);ctx.fillText(title,margin,y);y+=42;font(false,20);ctx.fillText(range,margin,y);y+=34};
  const flush=()=>{font(false,17);ctx.fillText('Maestro · Page '+(page+1),margin,canvas.height-45);if(page++)pdf.addPage();pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,210,297,undefined,'FAST')};
  const paragraph=(value:string,bold=false)=>{font(bold);for(const line of wrap(value,right-margin)){if(y+lineHeight>bottom){flush();begin();font(bold)}ctx.fillText(line,margin,y);y+=lineHeight}y+=12};
  begin();paragraph(summary);paragraph(denominator);
  for(const section of sections){
    if(y+130>bottom){flush();begin()}
    paragraph(section.title,true);
    const weights=section.headers.length===3?[.21,.59,.20]:[.18,.30,.13,.12,.12,.15];
    const widths=weights.map(w=>(right-margin)*w);
    const drawRow=(values:string[],header=false,offset=0,limit=Infinity)=>{
      font(header,21);const cells=values.map((v,i)=>wrap(v,widths[i]-20));const count=Math.min(limit,Math.max(...cells.map(c=>c.length))-offset);const height=count*lineHeight+18;
      let x=margin;if(header){ctx.fillStyle='#eaf3ee';ctx.fillRect(x,y,right-margin,height)}font(header,21);
      cells.forEach((lines,i)=>{lines.slice(offset,offset+count).forEach((line,j)=>ctx.fillText(line,x+10,y+9+j*lineHeight));ctx.strokeStyle='#d6e4db';ctx.strokeRect(x,y,widths[i],height);x+=widths[i]});y+=height;return Math.max(...cells.map(c=>c.length));
    };
    const header=()=>drawRow(section.headers,true);header();
    for(const row of section.rows){
      font(false,21);const lines=Math.max(...row.map((v,i)=>wrap(v,widths[i]-20).length));
      if(y+lines*lineHeight+18>bottom){flush();begin();paragraph(section.title+' (continued)',true);header()}
      let offset=0;
      while(offset<lines){const capacity=Math.max(1,Math.floor((bottom-y-18)/lineHeight));drawRow(row,false,offset,capacity);offset+=capacity;if(offset<lines){flush();begin();paragraph(section.title+' (continued)',true);header()}}
    }
    y+=24;
    // Allow the WebView to remain responsive on larger reports.
    await new Promise<void>(resolve=>window.setTimeout(resolve,0));
  }
  flush();pdf.setProperties({title,subject:range});return pdf.output('blob');
}
export async function exportDetailedAttendance(format:Format,start:string,end:string,rows:AttendanceRecord[],type:ReportType='attendance'){
  await saveReport(await buildAttendanceFile(format,start,end,rows,type),`maestro-${type}-${start}-to-${end}.${format}`,format);
}
