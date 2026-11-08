// Demo only: a small sample PDF to try the print flow without a file of your own.
// Builds 4 A4 pages of plain notes with pdf-lib, fully offline (standard font,
// no network). Pure: no window access, so node checks can import it too.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const SAMPLE_PDF_NAME = 'sample-notes.pdf';
export const SAMPLE_PDF_PAGES = 4;

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const INK = rgb(0.07, 0.09, 0.15);
const SLATE = rgb(0.38, 0.42, 0.5);

interface NotesPage {
  heading: string;
  lines: string[];
}

const NOTES: NotesPage[] = [
  {
    heading: '1. Cost accounting basics',
    lines: [
      'Cost is what a business gives up to make something.',
      'Fixed costs stay the same as output changes.',
      'Variable costs rise and fall with output.',
      'Total cost = fixed cost + variable cost.',
      'Unit cost = total cost / units made.',
      '',
      'Example: rent is fixed, paper is variable.',
      'A print shop pays rent whether it prints or not.',
      'Each extra page adds paper and toner cost.',
    ],
  },
  {
    heading: '2. Break-even point',
    lines: [
      'Break-even is where income equals total cost.',
      'Contribution per unit = price - variable cost.',
      'Break-even units = fixed cost / contribution.',
      '',
      'Example: fixed cost 12,000 a month.',
      'Price 5 a page, variable cost 2 a page.',
      'Contribution is 3 a page.',
      'Break-even is 4,000 pages a month.',
    ],
  },
  {
    heading: '3. Budgets',
    lines: [
      'A budget is a plan written in numbers.',
      'A fixed budget is set for one level of output.',
      'A flexible budget changes with real output.',
      'Variance = actual result - budgeted result.',
      '',
      'Favourable: costs came in lower than planned.',
      'Adverse: costs came in higher than planned.',
      'Look at big variances first.',
    ],
  },
  {
    heading: '4. Revision checklist',
    lines: [
      'Define fixed and variable cost.',
      'Work out a unit cost from totals.',
      'Find a break-even point.',
      'Explain a flexible budget.',
      'Read a variance as favourable or adverse.',
      '',
      'Practise two past papers before the exam.',
      'Bring a calculator and a spare pen.',
    ],
  },
];

/** Builds the sample notes and returns them as a File named 'sample-notes.pdf'. */
export async function makeSamplePdf(): Promise<File> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Sample notes');
  pdf.setAuthor('Swoop demo');
  pdf.setSubject('Sample data for the Swoop demo');
  pdf.setProducer('Swoop demo');
  pdf.setCreator('Swoop demo');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  NOTES.forEach((notes, index) => {
    const page = pdf.addPage(A4);
    const [, height] = A4;
    let y = height - MARGIN;

    page.drawText('Sample notes for the Swoop demo', { x: MARGIN, y, size: 9, font: regular, color: SLATE });
    y -= 34;
    page.drawText(notes.heading, { x: MARGIN, y, size: 20, font: bold, color: INK });
    y -= 34;
    for (const line of notes.lines) {
      if (line) page.drawText(line, { x: MARGIN, y, size: 12, font: regular, color: INK });
      y -= 22;
    }

    page.drawText(`Page ${index + 1} of ${NOTES.length}`, { x: MARGIN, y: MARGIN - 20, size: 9, font: regular, color: SLATE });
  });

  const bytes = await pdf.save();
  return new File([new Uint8Array(bytes)], SAMPLE_PDF_NAME, { type: 'application/pdf' });
}
