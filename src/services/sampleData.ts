import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Creates a synthetic 4-page sample PDF representing an Annual Report
 * containing text, multi-column tables, continued tables, and charts.
 */
export async function createSampleAnnualReportPdf(): Promise<{ file: File; bytes: Uint8Array }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Cover & Summary
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  page1.drawText('TAP DOAN DA QUOC GIA VIETNAM (VINACORP)', {
    x: 50,
    y: 770,
    size: 16,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });
  page1.drawText('BAO CAO THUONG NIEN 2025 - PHAT TRIEN BEN VUNG', {
    x: 50,
    y: 740,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.39, 0.92),
  });
  page1.drawText('THONG DIEP TU CHU TICH HOI DONG QUAN TRI', {
    x: 50,
    y: 690,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  const msg1 =
    'Nam 2025 danh dau mot cot moc ruc ro trong hanh trinh 20 nam phat trien cua Tap doan.\n' +
    'Vuot qua cac bien dong cua thi truong toan cau, doanh thu hop nhat dat dinh moi.\n' +
    'Chung toi tiep tuc mo rong he sinh thai so hoa va chuyen doi nang luong xanh.\n' +
    'Cam on quy co dong va doi ngu hon 15,000 can bo cong nhan vien.';
  page1.drawText(msg1, {
    x: 50,
    y: 660,
    size: 10,
    font,
    lineHeight: 16,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Table summary on Page 1
  page1.drawText('CHI TIEU TAI CHINH CHINH (DVT: TY DONG)', {
    x: 50,
    y: 570,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  const tableData1 = [
    'Chi tieu                       | 2023   | 2024   | 2025   | Tang truong',
    '----------------------------------------------------------------------',
    'Tong doanh thu hop nhat         | 42,500 | 51,200 | 64,800 | +26.5%',
    'Loi nhuan truoc thue            | 6,100  | 7,850  | 10,200 | +29.9%',
    'Loi nhuan sau thue              | 4,880  | 6,280  | 8,160  | +30.0%',
    'Tong tai san                    | 85,000 | 98,600 | 125,000| +26.8%',
  ];
  page1.drawText(tableData1.join('\n'), {
    x: 50,
    y: 540,
    size: 9,
    font,
    lineHeight: 15,
    color: rgb(0.15, 0.15, 0.15),
  });

  // Page 2: Continued Table Part 1
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawText('BAO CAO HOAT DONG SAN XUAT KINH DOANH CHI TIET', {
    x: 50,
    y: 770,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page2.drawText('BANG PHAN TICH DOANH THU THEO KHOI NGANH (PHAN 1)', {
    x: 50,
    y: 730,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.39, 0.92),
  });
  const tablePart1 = [
    'STT | Khoi nganh               | Doanh thu (Ty) | Ty trong | Loi nhuan bien',
    '--------------------------------------------------------------------------',
    '1   | Cong nghe & Chuyen doi so| 28,500         | 44.0%    | 22.5%',
    '2   | Nang luong tai tao       | 18,200         | 28.1%    | 18.2%',
    '3   | Ha tang logistic         | 9,800          | 15.1%    | 14.0%',
    '4   | Thuong mai dich vu       | 5,300          | 8.2%     | 11.8%',
  ];
  page2.drawText(tablePart1.join('\n'), {
    x: 50,
    y: 700,
    size: 9,
    font,
    lineHeight: 16,
    color: rgb(0.15, 0.15, 0.15),
  });

  // Page 3: Continued Table Part 2
  const page3 = pdfDoc.addPage([595.28, 841.89]);
  page3.drawText('BANG PHAN TICH DOANH THU THEO KHOI NGANH (TIEP THEO PHAN 2)', {
    x: 50,
    y: 770,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.39, 0.92),
  });
  const tablePart2 = [
    'STT | Khoi nganh               | Doanh thu (Ty) | Ty trong | Loi nhuan bien',
    '--------------------------------------------------------------------------',
    '5   | Y te & Duoc pham         | 2,100          | 3.2%     | 19.5%',
    '6   | Bat dong san khu cong ngh| 900            | 1.4%     | 32.0%',
    '    | TONG CONG                | 64,800         | 100.0%   | 20.8%',
  ];
  page3.drawText(tablePart2.join('\n'), {
    x: 50,
    y: 730,
    size: 9,
    font,
    lineHeight: 16,
    color: rgb(0.15, 0.15, 0.15),
  });

  // Page 4: Charts and Structure
  const page4 = pdfDoc.addPage([595.28, 841.89]);
  page4.drawText('BIEU DO TANG TRUONG THI PHAN VA CO CAU TO CHUC', {
    x: 50,
    y: 770,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page4.drawText('Bieu do: Thi phan linh vuc Chuyen doi so Viet Nam qua cac nam (2021-2025)', {
    x: 50,
    y: 735,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Draw chart frame
  page4.drawRectangle({
    x: 50,
    y: 520,
    width: 495,
    height: 190,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1.0),
  });
  page4.drawText('(Bieu do cot hien thi ty le thi phan: 2021: 18%, 2022: 24%, 2023: 31%, 2024: 38%, 2025: 45%)', {
    x: 70,
    y: 610,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.5),
  });

  page4.drawText('SO DO BO MAY DIEU HANH TAP DOAN', {
    x: 50,
    y: 480,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  const orgChart = [
    '- Dai hoi dong Co dong',
    '  ├── Hoi dong Quan tri (Chu tich: TS. Nguyen Van An)',
    '  │    ├── Ban Kiem soat',
    '  │    └── Uy ban Chien luoc & ESG',
    '  └── Ban Tong Giam doc (Tong Giam doc: ThS. Tran Thi Mai)',
    '       ├── Khoi Cong nghe',
    '       ├── Khoi Nang luong',
    '       └── Khoi Tai chinh Ke toan',
  ];
  page4.drawText(orgChart.join('\n'), {
    x: 50,
    y: 440,
    size: 9,
    font,
    lineHeight: 16,
    color: rgb(0.15, 0.15, 0.15),
  });

  const pdfBytes = await pdfDoc.save();
  const file = new File([pdfBytes.buffer as ArrayBuffer], 'Bao_Cao_Thuong_Nien_VinaCorp_2025_Sample.pdf', {
    type: 'application/pdf',
  });

  return { file, bytes: pdfBytes };
}
