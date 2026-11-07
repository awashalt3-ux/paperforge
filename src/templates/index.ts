import type {
  PaperDocument,
  PaperElement,
  PaperPage,
  ShapeElement,
  TableElement,
  TextElement,
} from "@/types/document";
import { createDocumentId, createElementId, createPageId } from "@/utils/id";
import { defaultShape, defaultTable, defaultText } from "@/utils/elementDefaults";

const A4 = { width: 595.28, height: 841.89 };
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };

export interface TemplateDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  accent: string;
  tags: string[];
  build: () => { pages: PaperPage[]; title: string };
}

const INK = "#16201e";
const MUTED = "#67716e";
const LINE = "#dfe4e2";
const GREEN = "#265249";
const GREEN_LIGHT = "#dcebe6";
const SAND = "#f4f1ea";
const GOLD = "#b7883c";

function page(
  width = A4.width,
  height = A4.height,
  background = "#ffffff",
): PaperPage {
  return {
    id: createPageId(),
    width,
    height,
    background,
    elements: [],
  };
}

function text(
  prefix: string,
  overrides: Partial<TextElement> & Pick<TextElement, "x" | "y" | "text">,
): TextElement {
  const base = defaultText({
    id: createElementId(),
    role: overrides.role ?? "body",
    ...overrides,
    x: overrides.x,
    y: overrides.y,
  });
  // Templates use explicit heights; estimate a safe value unless provided.
  if (overrides.height === undefined) {
    const size = base.fontSize;
    const width = base.width;
    const approxCharWidth = size * 0.54 + Math.max(0, base.letterSpacing) * 0.6;
    const charsPerLine = Math.max(8, Math.floor((width - base.padding * 2) / approxCharWidth));
    const manualLines = base.text.split("\n");
    const lines = manualLines.reduce(
      (count, line) => count + Math.max(1, Math.ceil(line.length / charsPerLine)),
      0,
    );
    base.height = Math.max(size, lines * size * base.lineHeight + base.padding * 2);
  }
  base.name = `${prefix} text`;
  return base;
}

function rect(
  prefix: string,
  overrides: Partial<ShapeElement> & Pick<ShapeElement, "x" | "y" | "width" | "height">,
): ShapeElement {
  const base = defaultShape({
    id: createElementId(),
    shape: "rectangle",
    ...overrides,
  });
  base.name = `${prefix} shape`;
  return base;
}

function line(
  prefix: string,
  x: number,
  y: number,
  width: number,
  color = LINE,
  thickness = 0.8,
): ShapeElement {
  return rect(prefix, {
    x,
    y,
    width,
    height: thickness,
    shape: "line",
    fill: color,
    stroke: color,
    strokeWidth: thickness,
  });
}

function table(
  prefix: string,
  overrides: Partial<TableElement> & Pick<TableElement, "x" | "y" | "rows">,
): TableElement {
  const base = defaultTable({
    id: createElementId(),
    width: 500,
    height: 160,
    ...overrides,
  });
  base.name = `${prefix} table`;
  return base;
}

function addFooter(
  elements: PaperElement[],
  prefix: string,
  pageLabel: string,
  width = A4.width,
  height = A4.height,
  accent = GREEN,
) {
  elements.push(line(`${prefix}-footer`, 48, height - 66, width - 96, LINE, 0.6));
  elements.push(
    text(`${prefix}-footer-left`, {
      x: 48,
      y: height - 52,
      width: width - 140,
      text: "PAPERFORGE / DOCUMENT STUDIO",
      fontSize: 6.5,
      fontWeight: 600,
      letterSpacing: 1.4,
      color: MUTED,
    }),
  );
  elements.push(
    text(`${prefix}-footer-right`, {
      x: width - 150,
      y: height - 52,
      width: 102,
      text: pageLabel,
      fontSize: 6.5,
      fontWeight: 500,
      align: "right",
      color: accent,
    }),
  );
}

function invoice(): { pages: PaperPage[]; title: string } {
  const p = page();
  const e = p.elements;
  e.push(rect("invoice-accent", { x: 0, y: 0, width: A4.width, height: 7, fill: GREEN, cornerRadius: 0 }));
  e.push(
    text("invoice-logo", {
      x: 48,
      y: 44,
      width: 250,
      text: "NORTH & CO.",
      fontSize: 12.5,
      fontWeight: 700,
      letterSpacing: 2.4,
      color: INK,
    }),
    text("invoice-logo-sub", {
      x: 48,
      y: 62,
      width: 250,
      text: "STUDIO / DESIGN & STRATEGY",
      fontSize: 6.5,
      fontWeight: 600,
      letterSpacing: 1.1,
      color: MUTED,
    }),
    text("invoice-title", {
      x: 300,
      y: 41,
      width: 247,
      text: "INVOICE",
      fontSize: 34,
      fontWeight: 700,
      letterSpacing: -1.2,
      align: "right",
      color: INK,
    }),
    text("invoice-number", {
      x: 300,
      y: 84,
      width: 247,
      text: "No. INV-2026-014",
      fontSize: 8.5,
      fontWeight: 500,
      align: "right",
      color: MUTED,
    }),
  );
  e.push(line("invoice-rule", 48, 116, 499, INK, 1));

  e.push(
    text("invoice-bill-label", {
      x: 48,
      y: 142,
      width: 200,
      text: "BILLED TO",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: MUTED,
    }),
    text("invoice-client", {
      x: 48,
      y: 161,
      width: 230,
      text: "Atelier Lumen",
      fontSize: 13,
      fontWeight: 600,
      color: INK,
    }),
    text("invoice-client-address", {
      x: 48,
      y: 182,
      width: 235,
      text: "14 Rue des Arts\n75011 Paris, France\nbonjour@atelierlumen.fr",
      fontSize: 8.5,
      lineHeight: 1.65,
      color: MUTED,
    }),
    text("invoice-meta-label", {
      x: 370,
      y: 142,
      width: 177,
      text: "ISSUED",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      align: "right",
      color: MUTED,
    }),
    text("invoice-date", {
      x: 370,
      y: 161,
      width: 177,
      text: "12 March 2026",
      fontSize: 9,
      fontWeight: 500,
      align: "right",
      color: INK,
    }),
    text("invoice-due-label", {
      x: 370,
      y: 184,
      width: 177,
      text: "DUE",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      align: "right",
      color: MUTED,
    }),
    text("invoice-due", {
      x: 370,
      y: 203,
      width: 177,
      text: "11 April 2026",
      fontSize: 9,
      fontWeight: 500,
      align: "right",
      color: INK,
    }),
  );

  e.push(
    text("invoice-project-label", {
      x: 48,
      y: 266,
      width: 200,
      text: "PROJECT",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: MUTED,
    }),
    text("invoice-project", {
      x: 48,
      y: 283,
      width: 350,
      text: "Brand identity system & digital art direction",
      fontSize: 10,
      fontWeight: 500,
      color: INK,
    }),
  );

  e.push(
    table("invoice-table", {
      x: 48,
      y: 322,
      width: 499,
      height: 188,
      rows: [
        ["DESCRIPTION", "QTY", "RATE", "AMOUNT"],
        ["Discovery & strategy workshop", "1", "€1,800", "€1,800"],
        ["Visual identity direction", "12", "€150", "€1,800"],
        ["Brand guidelines & assets", "1", "€2,400", "€2,400"],
        ["", "", "", ""],
      ],
      fontSize: 8.5,
      headerBackground: GREEN,
      headerColor: "#ffffff",
      borderColor: LINE,
      cellPadding: 10,
      columnWeights: [3.1, 0.7, 1, 1.2],
    }),
  );

  e.push(
    text("invoice-subtotal-label", {
      x: 360,
      y: 546,
      width: 100,
      text: "Subtotal",
      fontSize: 8.5,
      color: MUTED,
      align: "right",
    }),
    text("invoice-subtotal", {
      x: 465,
      y: 546,
      width: 82,
      text: "€6,000",
      fontSize: 8.5,
      fontWeight: 500,
      align: "right",
      color: INK,
    }),
    text("invoice-tax-label", {
      x: 360,
      y: 566,
      width: 100,
      text: "VAT / 20%",
      fontSize: 8.5,
      color: MUTED,
      align: "right",
    }),
    text("invoice-tax", {
      x: 465,
      y: 566,
      width: 82,
      text: "€1,200",
      fontSize: 8.5,
      fontWeight: 500,
      align: "right",
      color: INK,
    }),
  );
  e.push(line("invoice-total-rule", 360, 590, 187, INK, 0.8));
  e.push(
    text("invoice-total-label", {
      x: 360,
      y: 604,
      width: 100,
      text: "TOTAL DUE",
      fontSize: 7,
      fontWeight: 700,
      letterSpacing: 1.4,
      align: "right",
      color: MUTED,
    }),
    text("invoice-total", {
      x: 440,
      y: 599,
      width: 107,
      text: "€7,200",
      fontSize: 20,
      fontWeight: 700,
      align: "right",
      color: INK,
    }),
  );

  e.push(
    rect("invoice-note-bg", { x: 48, y: 666, width: 499, height: 78, fill: SAND, cornerRadius: 4 }),
    text("invoice-notes-label", {
      x: 64,
      y: 680,
      width: 200,
      text: "PAYMENT DETAILS",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.6,
      color: GREEN,
    }),
    text("invoice-notes", {
      x: 64,
      y: 697,
      width: 430,
      text: "Bank transfer · North & Co. Studio\nIBAN FR76 3000 6000 0112 3456 7890 189 · BIC BNPAFRPP",
      fontSize: 8,
      lineHeight: 1.6,
      color: MUTED,
    }),
    text("invoice-thanks", {
      x: 48,
      y: 765,
      width: 400,
      text: "Thank you for working with us.",
      fontSize: 9,
      fontWeight: 500,
      color: INK,
    }),
  );
  addFooter(e, "invoice", "PAGE 01 / 01");
  return { pages: [p], title: "Invoice" };
}

function quotation(): { pages: PaperPage[]; title: string } {
  const p = page();
  const e = p.elements;
  e.push(rect("quote-panel", { x: 0, y: 0, width: 196, height: A4.height, fill: GREEN, cornerRadius: 0 }));
  e.push(
    text("quote-logo", {
      x: 36,
      y: 48,
      width: 140,
      text: "FORM\nSTUDIO",
      fontSize: 18,
      fontWeight: 700,
      lineHeight: 1.08,
      letterSpacing: 1.8,
      color: "#ffffff",
    }),
    text("quote-studio", {
      x: 36,
      y: 108,
      width: 130,
      text: "Architecture & interior design\nLyon, France",
      fontSize: 7.5,
      lineHeight: 1.6,
      color: "#b9d3ca",
    }),
    text("quote-foot-label", {
      x: 36,
      y: 704,
      width: 130,
      text: "PREPARED FOR",
      fontSize: 6,
      fontWeight: 700,
      letterSpacing: 1.4,
      color: "#8fb6a9",
    }),
    text("quote-foot-client", {
      x: 36,
      y: 720,
      width: 136,
      text: "Maison Verger\n12 Quai Saint-Vincent\n69001 Lyon",
      fontSize: 8,
      lineHeight: 1.65,
      color: "#ffffff",
    }),
    text("quote-foot-number", {
      x: 36,
      y: 774,
      width: 136,
      text: "QUOTE 2026-032",
      fontSize: 6.5,
      fontWeight: 600,
      letterSpacing: 1.2,
      color: "#8fb6a9",
    }),
  );
  e.push(
    text("quote-kicker", {
      x: 232,
      y: 56,
      width: 310,
      text: "PROFESSIONAL QUOTATION",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.8,
      color: GREEN,
    }),
    text("quote-title", {
      x: 232,
      y: 78,
      width: 315,
      text: "A considered space\nfor everyday living.",
      fontSize: 30,
      fontWeight: 700,
      lineHeight: 1.12,
      letterSpacing: -0.9,
      color: INK,
    }),
    text("quote-intro", {
      x: 232,
      y: 167,
      width: 315,
      text: "Thank you for inviting Form Studio to shape the renovation of Maison Verger. This quotation outlines our scope, approach, and investment.",
      fontSize: 9,
      lineHeight: 1.7,
      color: MUTED,
    }),
  );
  e.push(line("quote-rule", 232, 223, 315, LINE, 0.8));
  e.push(
    text("quote-scope", {
      x: 232,
      y: 242,
      width: 315,
      text: "SCOPE OF WORK",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.8,
      color: GREEN,
    }),
  );
  e.push(
    table("quote-table", {
      x: 232,
      y: 262,
      width: 315,
      height: 170,
      rows: [
        ["SERVICE", "DETAIL", "FEE"],
        ["Spatial concept", "Survey, brief & concept", "€3,600"],
        ["Design development", "Plans, elevations & materials", "€5,400"],
        ["Site coordination", "8 site visits & contractor liaison", "€2,400"],
        ["", "", ""],
      ],
      fontSize: 8,
      headerBackground: "transparent",
      headerColor: GREEN,
      borderColor: LINE,
      cellPadding: 8,
      columnWeights: [1.35, 2.4, 0.8],
      borderWidth: 0.6,
    }),
  );
  e.push(
    text("quote-total-label", {
      x: 232,
      y: 456,
      width: 180,
      text: "TOTAL EXCL. VAT",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.5,
      color: MUTED,
    }),
    text("quote-total", {
      x: 414,
      y: 449,
      width: 133,
      text: "€11,400",
      fontSize: 21,
      fontWeight: 700,
      align: "right",
      color: INK,
    }),
  );
  e.push(line("quote-rule2", 232, 488, 315, INK, 1));
  e.push(
    text("quote-timeline-label", {
      x: 232,
      y: 512,
      width: 100,
      text: "TIMELINE",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.6,
      color: GREEN,
    }),
    text("quote-timeline", {
      x: 232,
      y: 530,
      width: 145,
      text: "14–18 weeks\nfrom signing",
      fontSize: 9,
      fontWeight: 500,
      lineHeight: 1.5,
      color: INK,
    }),
    text("quote-valid-label", {
      x: 392,
      y: 512,
      width: 100,
      text: "VALID UNTIL",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.6,
      color: GREEN,
    }),
    text("quote-valid", {
      x: 392,
      y: 530,
      width: 155,
      text: "30 April 2026",
      fontSize: 9,
      fontWeight: 500,
      color: INK,
    }),
  );
  e.push(
    rect("quote-terms-bg", { x: 232, y: 591, width: 315, height: 114, fill: SAND, cornerRadius: 4 }),
    text("quote-terms-title", {
      x: 248,
      y: 605,
      width: 270,
      text: "TERMS & CONDITIONS",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.6,
      color: GREEN,
    }),
    text("quote-terms", {
      x: 248,
      y: 623,
      width: 280,
      text: "A 40% deposit confirms the engagement. Remaining fees are invoiced at concept approval and project handover. Expenses and specialist consultants are quoted separately.",
      fontSize: 7.5,
      lineHeight: 1.65,
      color: MUTED,
    }),
  );
  addFooter(e, "quote", "QUOTATION / 01", A4.width, A4.height, GREEN);
  return { pages: [p], title: "Professional quotation" };
}

function resume(): { pages: PaperPage[]; title: string } {
  const p = page();
  const e = p.elements;
  e.push(rect("resume-sidebar", { x: 0, y: 0, width: 194, height: A4.height, fill: "#eef3f0", cornerRadius: 0 }));
  e.push(
    text("resume-name", {
      x: 238,
      y: 60,
      width: 310,
      text: "Elena\nMoreau",
      fontSize: 38,
      fontWeight: 700,
      lineHeight: 1.02,
      letterSpacing: -1.4,
      color: INK,
    }),
    text("resume-role", {
      x: 238,
      y: 150,
      width: 310,
      text: "Product designer & systems thinker",
      fontSize: 11,
      fontWeight: 500,
      color: GREEN,
    }),
    text("resume-summary", {
      x: 238,
      y: 184,
      width: 308,
      text: "I design digital products that make complex systems feel clear, calm, and human. Ten years of experience across fintech, health, and civic technology.",
      fontSize: 9,
      lineHeight: 1.7,
      color: MUTED,
    }),
  );
  e.push(
    text("resume-contact-label", {
      x: 36,
      y: 56,
      width: 120,
      text: "CONTACT",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: GREEN,
    }),
    text("resume-contact", {
      x: 36,
      y: 74,
      width: 130,
      text: "elena@moreau.design\n+33 6 12 34 56 78\nParis, France\nmoreau.design",
      fontSize: 7.8,
      lineHeight: 1.85,
      color: MUTED,
    }),
    text("resume-skills-label", {
      x: 36,
      y: 186,
      width: 120,
      text: "EXPERTISE",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: GREEN,
    }),
    text("resume-skills", {
      x: 36,
      y: 204,
      width: 130,
      text: "Product strategy\nDesign systems\nInteraction design\nService design\nResearch & testing\nTeam leadership",
      fontSize: 7.8,
      lineHeight: 1.9,
      color: MUTED,
    }),
    text("resume-tools-label", {
      x: 36,
      y: 360,
      width: 120,
      text: "TOOLS",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: GREEN,
    }),
    text("resume-tools", {
      x: 36,
      y: 378,
      width: 130,
      text: "Figma · FigJam\nFramer · ProtoPie\nMaze · Dovetail\nLinear · Notion",
      fontSize: 7.8,
      lineHeight: 1.9,
      color: MUTED,
    }),
    text("resume-education-label", {
      x: 36,
      y: 496,
      width: 120,
      text: "EDUCATION",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: GREEN,
    }),
    text("resume-education", {
      x: 36,
      y: 514,
      width: 132,
      text: "MA Interaction Design\nRoyal College of Art\n2012–2014",
      fontSize: 7.8,
      lineHeight: 1.8,
      color: MUTED,
    }),
    text("resume-language-label", {
      x: 36,
      y: 602,
      width: 120,
      text: "LANGUAGES",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: GREEN,
    }),
    text("resume-language", {
      x: 36,
      y: 620,
      width: 130,
      text: "French — native\nEnglish — fluent\nItalian — conversational",
      fontSize: 7.8,
      lineHeight: 1.8,
      color: MUTED,
    }),
  );
  e.push(line("resume-rule", 238, 224, 310, LINE, 0.8));
  e.push(
    text("resume-experience-label", {
      x: 238,
      y: 246,
      width: 300,
      text: "EXPERIENCE",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.8,
      color: GREEN,
    }),
    text("resume-job1-period", {
      x: 238,
      y: 270,
      width: 80,
      text: "2022 — NOW",
      fontSize: 6.8,
      fontWeight: 600,
      letterSpacing: 0.6,
      color: MUTED,
    }),
    text("resume-job1", {
      x: 330,
      y: 269,
      width: 216,
      text: "Lead Product Designer\nNorthwind Financial",
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 1.4,
      color: INK,
    }),
    text("resume-job1-desc", {
      x: 330,
      y: 305,
      width: 216,
      text: "Leading the design of a new business banking platform. Built a multi-brand design system used by 24 product teams.",
      fontSize: 8,
      lineHeight: 1.65,
      color: MUTED,
    }),
    text("resume-job2-period", {
      x: 238,
      y: 379,
      width: 80,
      text: "2018 — 2022",
      fontSize: 6.8,
      fontWeight: 600,
      letterSpacing: 0.6,
      color: MUTED,
    }),
    text("resume-job2", {
      x: 330,
      y: 378,
      width: 216,
      text: "Senior Product Designer\nAster Health",
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 1.4,
      color: INK,
    }),
    text("resume-job2-desc", {
      x: 330,
      y: 414,
      width: 216,
      text: "Designed patient-facing care journeys and clinician tooling. Research-led redesign reduced onboarding time by 38%.",
      fontSize: 8,
      lineHeight: 1.65,
      color: MUTED,
    }),
    text("resume-job3-period", {
      x: 238,
      y: 488,
      width: 80,
      text: "2014 — 2018",
      fontSize: 6.8,
      fontWeight: 600,
      letterSpacing: 0.6,
      color: MUTED,
    }),
    text("resume-job3", {
      x: 330,
      y: 487,
      width: 216,
      text: "Product Designer\nCivic Works",
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 1.4,
      color: INK,
    }),
    text("resume-job3-desc", {
      x: 330,
      y: 523,
      width: 216,
      text: "Shipped accessible digital services for local government, including a public consultation platform used across 12 cities.",
      fontSize: 8,
      lineHeight: 1.65,
      color: MUTED,
    }),
  );
  e.push(line("resume-rule2", 238, 620, 310, LINE, 0.8));
  e.push(
    text("resume-selected-label", {
      x: 238,
      y: 640,
      width: 300,
      text: "SELECTED RECOGNITION",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.8,
      color: GREEN,
    }),
    text("resume-selected", {
      x: 238,
      y: 660,
      width: 310,
      text: "D&AD Wood Pencil, Digital Design — 2024\nFast Company Innovation by Design, Finalist — 2021",
      fontSize: 8,
      lineHeight: 1.75,
      color: MUTED,
    }),
  );
  addFooter(e, "resume", "ELENA MOREAU / CV");
  return { pages: [p], title: "Resume / CV" };
}

function businessLetter(): { pages: PaperPage[]; title: string } {
  const p = page();
  const e = p.elements;
  e.push(
    text("letter-logo", {
      x: 56,
      y: 52,
      width: 220,
      text: "MERIDIAN",
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 3,
      color: INK,
    }),
    text("letter-logo-sub", {
      x: 56,
      y: 70,
      width: 220,
      text: "ADVISORY / PARIS · LONDON · MILAN",
      fontSize: 6,
      fontWeight: 600,
      letterSpacing: 1.4,
      color: MUTED,
    }),
    text("letter-address", {
      x: 360,
      y: 52,
      width: 179,
      text: "72 Boulevard Haussmann\n75008 Paris, France",
      fontSize: 7.5,
      lineHeight: 1.6,
      align: "right",
      color: MUTED,
    }),
  );
  e.push(line("letter-rule", 56, 104, 483, INK, 1));
  e.push(
    text("letter-date", {
      x: 56,
      y: 140,
      width: 200,
      text: "18 March 2026",
      fontSize: 8,
      fontWeight: 500,
      color: MUTED,
    }),
    text("letter-recipient", {
      x: 56,
      y: 206,
      width: 250,
      text: "Ms. Camille Bernard\nDirectrice Générale\nMaison Verger\n12 Quai Saint-Vincent\n69001 Lyon",
      fontSize: 9,
      lineHeight: 1.65,
      color: INK,
    }),
    text("letter-subject", {
      x: 56,
      y: 326,
      width: 480,
      text: "Re: Strategic advisory engagement — Q2 2026",
      fontSize: 10,
      fontWeight: 600,
      color: INK,
    }),
    text("letter-salutation", {
      x: 56,
      y: 366,
      width: 480,
      text: "Dear Ms. Bernard,",
      fontSize: 10,
      color: INK,
    }),
    text("letter-body1", {
      x: 56,
      y: 396,
      width: 483,
      text: "Thank you for the thoughtful conversation last week. We are delighted to confirm Meridian's engagement with Maison Verger for the next phase of your growth strategy.",
      fontSize: 9.5,
      lineHeight: 1.72,
      color: "#3f4a47",
    }),
    text("letter-body2", {
      x: 56,
      y: 464,
      width: 483,
      text: "Our work will focus on three connected priorities: clarifying the positioning of the Verger collection, designing a resilient go-to-market model for new European markets, and building the internal capability to sustain both. We propose a twelve-week program beginning on 7 April 2026.",
      fontSize: 9.5,
      lineHeight: 1.72,
      color: "#3f4a47",
    }),
    text("letter-body3", {
      x: 56,
      y: 570,
      width: 483,
      text: "The enclosed proposal sets out scope, milestones, and fees. We would be pleased to walk through it together on a call this week. Please do not hesitate to reach out with any questions.",
      fontSize: 9.5,
      lineHeight: 1.72,
      color: "#3f4a47",
    }),
    text("letter-closing", {
      x: 56,
      y: 662,
      width: 480,
      text: "With warm regards,",
      fontSize: 9.5,
      color: INK,
    }),
  );
  e.push(line("letter-sign-line", 56, 744, 172, INK, 0.8));
  e.push(
    text("letter-sign-name", {
      x: 56,
      y: 758,
      width: 250,
      text: "Adrien Laurent",
      fontSize: 10,
      fontWeight: 600,
      color: INK,
    }),
    text("letter-sign-role", {
      x: 56,
      y: 774,
      width: 250,
      text: "Managing Partner, Meridian Advisory",
      fontSize: 8,
      color: MUTED,
    }),
    text("letter-enclosure", {
      x: 360,
      y: 758,
      width: 179,
      text: "Enclosure: Proposal\ncc: Strategy Committee",
      fontSize: 7,
      lineHeight: 1.6,
      align: "right",
      color: MUTED,
    }),
  );
  addFooter(e, "letter", "MERIDIAN / 01");
  return { pages: [p], title: "Business letter" };
}

function proposal(): { pages: PaperPage[]; title: string } {
  const cover = page(A4.width, A4.height, "#f2f0e9");
  cover.elements.push(
    rect("proposal-mark", { x: 48, y: 48, width: 44, height: 44, fill: GREEN, cornerRadius: 22 }),
    text("proposal-mark-letter", {
      x: 48,
      y: 61,
      width: 44,
      align: "center",
      text: "V",
      fontSize: 15,
      fontWeight: 700,
      color: "#ffffff",
    }),
    text("proposal-kicker", {
      x: 48,
      y: 168,
      width: 430,
      text: "PROJECT PROPOSAL / 2026",
      fontSize: 7,
      fontWeight: 700,
      letterSpacing: 2.2,
      color: GREEN,
    }),
    text("proposal-title", {
      x: 48,
      y: 198,
      width: 500,
      text: "A new chapter\nfor slow living.",
      fontSize: 54,
      fontWeight: 700,
      lineHeight: 1.02,
      letterSpacing: -2.2,
      color: INK,
    }),
    text("proposal-subtitle", {
      x: 48,
      y: 352,
      width: 380,
      text: "Brand strategy and digital experience for Maison Verger's next decade.",
      fontSize: 13,
      lineHeight: 1.55,
      color: "#4f5a56",
    }),
    rect("proposal-cover-line", { x: 48, y: 476, width: 500, height: 1, fill: "#a9b0ac", cornerRadius: 0 }),
    text("proposal-prepared-label", {
      x: 48,
      y: 498,
      width: 130,
      text: "PREPARED FOR",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: MUTED,
    }),
    text("proposal-prepared", {
      x: 48,
      y: 516,
      width: 190,
      text: "Maison Verger\nCamille Bernard, CEO",
      fontSize: 9.5,
      lineHeight: 1.6,
      color: INK,
    }),
    text("proposal-by-label", {
      x: 332,
      y: 498,
      width: 130,
      text: "PREPARED BY",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: MUTED,
    }),
    text("proposal-by", {
      x: 332,
      y: 516,
      width: 190,
      text: "Verdant Studio\nElena Park, Partner",
      fontSize: 9.5,
      lineHeight: 1.6,
      color: INK,
    }),
    text("proposal-date", {
      x: 48,
      y: 754,
      width: 250,
      text: "18 MARCH 2026",
      fontSize: 7,
      fontWeight: 600,
      letterSpacing: 1.3,
      color: MUTED,
    }),
    text("proposal-confidential", {
      x: 332,
      y: 754,
      width: 216,
      align: "right",
      text: "CONFIDENTIAL",
      fontSize: 7,
      fontWeight: 600,
      letterSpacing: 1.3,
      color: GREEN,
    }),
  );

  const content = page();
  const e = content.elements;
  e.push(
    text("proposal-page-kicker", {
      x: 56,
      y: 52,
      width: 350,
      text: "VERDANT STUDIO / PROPOSAL",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.8,
      color: GREEN,
    }),
    text("proposal-page-title", {
      x: 56,
      y: 92,
      width: 410,
      text: "An intentional approach.",
      fontSize: 32,
      fontWeight: 700,
      letterSpacing: -1,
      color: INK,
    }),
    text("proposal-intro", {
      x: 56,
      y: 148,
      width: 480,
      text: "We believe Maison Verger is ready to move from a beautiful collection to a coherent world. Our work together will articulate that world, then give it a digital home that feels as considered as the objects themselves.",
      fontSize: 10,
      lineHeight: 1.8,
      color: "#4f5a56",
    }),
  );
  e.push(line("proposal-rule", 56, 228, 483, LINE, 0.8));
  const phases = [
    ["01", "Discovery", "Interviews, category audit, and a shared definition of success.", "Weeks 1–2"],
    ["02", "Strategy", "Positioning, narrative, and a brand platform built to last.", "Weeks 3–5"],
    ["03", "Expression", "Visual language, art direction, and digital design system.", "Weeks 6–9"],
    ["04", "Delivery", "A living experience, documentation, and team handover.", "Weeks 10–12"],
  ];
  phases.forEach(([number, name, description, weeks], index) => {
    const y = 256 + index * 108;
    e.push(
      text(`proposal-phase-${index}-num`, {
        x: 56,
        y,
        width: 44,
        text: number,
        fontSize: 8,
        fontWeight: 600,
        color: GREEN,
      }),
      text(`proposal-phase-${index}-name`, {
        x: 106,
        y,
        width: 180,
        text: name,
        fontSize: 13,
        fontWeight: 600,
        color: INK,
      }),
      text(`proposal-phase-${index}-desc`, {
        x: 106,
        y: y + 22,
        width: 300,
        text: description,
        fontSize: 8.5,
        lineHeight: 1.6,
        color: MUTED,
      }),
      text(`proposal-phase-${index}-weeks`, {
        x: 430,
        y,
        width: 108,
        align: "right",
        text: weeks,
        fontSize: 7.5,
        fontWeight: 500,
        color: MUTED,
      }),
    );
    if (index < phases.length - 1) {
      e.push(line(`proposal-phase-rule-${index}`, 56, y + 82, 483, LINE, 0.6));
    }
  });
  e.push(
    rect("proposal-investment-bg", { x: 56, y: 710, width: 483, height: 76, fill: "#eef3f0", cornerRadius: 4 }),
    text("proposal-investment-label", {
      x: 72,
      y: 724,
      width: 170,
      text: "PROJECT INVESTMENT",
      fontSize: 6.5,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: GREEN,
    }),
    text("proposal-investment", {
      x: 72,
      y: 742,
      width: 240,
      text: "€32,000 excluding production",
      fontSize: 12,
      fontWeight: 600,
      color: INK,
    }),
    text("proposal-investment-note", {
      x: 330,
      y: 744,
      width: 193,
      align: "right",
      text: "Payment in three phases",
      fontSize: 8,
      color: MUTED,
    }),
  );
  addFooter(e, "proposal", "VERDANT / 02");
  return { pages: [cover, content], title: "Project proposal" };
}

function meetingReport(): { pages: PaperPage[]; title: string } {
  const p = page();
  const e = p.elements;
  e.push(
    text("meeting-kicker", {
      x: 48,
      y: 48,
      width: 350,
      text: "MEETING REPORT / PRODUCT",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.9,
      color: GREEN,
    }),
    text("meeting-title", {
      x: 48,
      y: 76,
      width: 499,
      text: "Q2 product review & priorities",
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: -0.8,
      color: INK,
    }),
    text("meeting-date", {
      x: 48,
      y: 121,
      width: 250,
      text: "Thursday, 12 March 2026 · 09:30–11:00 CET",
      fontSize: 8.5,
      color: MUTED,
    }),
  );
  e.push(line("meeting-rule", 48, 150, 499, INK, 1));
  e.push(
    rect("meeting-meta-bg", { x: 48, y: 172, width: 499, height: 82, fill: "#f4f6f4", cornerRadius: 4 }),
    text("meeting-meta-1-label", {
      x: 66,
      y: 188,
      width: 120,
      text: "LOCATION",
      fontSize: 6.3,
      fontWeight: 700,
      letterSpacing: 1.5,
      color: MUTED,
    }),
    text("meeting-meta-1", {
      x: 66,
      y: 204,
      width: 130,
      text: "Studio B / hybrid",
      fontSize: 8.5,
      fontWeight: 500,
      color: INK,
    }),
    text("meeting-meta-2-label", {
      x: 220,
      y: 188,
      width: 120,
      text: "CHAIR",
      fontSize: 6.3,
      fontWeight: 700,
      letterSpacing: 1.5,
      color: MUTED,
    }),
    text("meeting-meta-2", {
      x: 220,
      y: 204,
      width: 130,
      text: "Léa Fontaine",
      fontSize: 8.5,
      fontWeight: 500,
      color: INK,
    }),
    text("meeting-meta-3-label", {
      x: 374,
      y: 188,
      width: 120,
      text: "ATTENDEES",
      fontSize: 6.3,
      fontWeight: 700,
      letterSpacing: 1.5,
      color: MUTED,
    }),
    text("meeting-meta-3", {
      x: 374,
      y: 204,
      width: 160,
      text: "L. Fontaine, M. Diallo,\nS. Weber, J. Park",
      fontSize: 8.5,
      fontWeight: 500,
      lineHeight: 1.45,
      color: INK,
    }),
  );
  e.push(
    text("meeting-summary-label", {
      x: 48,
      y: 286,
      width: 300,
      text: "EXECUTIVE SUMMARY",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: GREEN,
    }),
    text("meeting-summary", {
      x: 48,
      y: 306,
      width: 499,
      text: "The team aligned on a narrower Q2 scope: stabilise onboarding, ship the reporting refresh, and defer the collaboration beta to Q3. Engineering capacity is the primary constraint; design and research will sequence around two release trains.",
      fontSize: 9.5,
      lineHeight: 1.75,
      color: "#3f4a47",
    }),
    text("meeting-decisions-label", {
      x: 48,
      y: 406,
      width: 300,
      text: "DECISIONS",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: GREEN,
    }),
  );
  const decisions = [
    "Onboarding redesign moves to the 2 April release train.",
    "Reporting refresh remains in Q2; scope frozen at 12 March.",
    "Collaboration beta deferred to 15 July, pending security review.",
    "Research budget reallocated to onboarding usability testing.",
  ];
  decisions.forEach((decision, index) => {
    const y = 426 + index * 28;
    e.push(
      rect(`meeting-decision-dot-${index}`, {
        x: 50,
        y: y + 3,
        width: 5,
        height: 5,
        shape: "ellipse",
        fill: GREEN,
        cornerRadius: 0,
      }),
      text(`meeting-decision-${index}`, {
        x: 66,
        y,
        width: 470,
        text: decision,
        fontSize: 9,
        color: INK,
      }),
    );
  });
  e.push(
    text("meeting-actions-label", {
      x: 48,
      y: 566,
      width: 300,
      text: "ACTION ITEMS",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.7,
      color: GREEN,
    }),
    table("meeting-actions", {
      x: 48,
      y: 586,
      width: 499,
      height: 150,
      rows: [
        ["ACTION", "OWNER", "DUE"],
        ["Freeze reporting scope and circulate spec", "M. Diallo", "19 Mar"],
        ["Recruit 8 onboarding test participants", "J. Park", "26 Mar"],
        ["Re-estimate collaboration beta", "S. Weber", "31 Mar"],
        ["", "", ""],
      ],
      fontSize: 8.2,
      headerBackground: "#eef3f0",
      headerColor: GREEN,
      borderColor: LINE,
      cellPadding: 9,
      columnWeights: [3.4, 1.1, 0.7],
    }),
  );
  addFooter(e, "meeting", "PRODUCT REVIEW / 01");
  return { pages: [p], title: "Meeting report" };
}

function certificate(): { pages: PaperPage[]; title: string } {
  const p = page(A4_LANDSCAPE.width, A4_LANDSCAPE.height, "#fbfaf6");
  const e = p.elements;
  e.push(
    rect("certificate-border", {
      x: 26,
      y: 26,
      width: A4_LANDSCAPE.width - 52,
      height: A4_LANDSCAPE.height - 52,
      fill: "transparent",
      stroke: GREEN,
      strokeWidth: 1.2,
      cornerRadius: 0,
    }),
    rect("certificate-border-inner", {
      x: 34,
      y: 34,
      width: A4_LANDSCAPE.width - 68,
      height: A4_LANDSCAPE.height - 68,
      fill: "transparent",
      stroke: "#c8b281",
      strokeWidth: 0.5,
      cornerRadius: 0,
    }),
    rect("certificate-crest", {
      x: 391,
      y: 76,
      width: 60,
      height: 60,
      shape: "ellipse",
      fill: GREEN,
      cornerRadius: 0,
    }),
    text("certificate-crest-letter", {
      x: 391,
      y: 94,
      width: 60,
      align: "center",
      text: "A",
      fontSize: 22,
      fontWeight: 700,
      color: "#ffffff",
    }),
    text("certificate-kicker", {
      x: 200,
      y: 164,
      width: 442,
      align: "center",
      text: "THE ACADEMY OF APPLIED DESIGN",
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: 3,
      color: GREEN,
    }),
    text("certificate-title", {
      x: 150,
      y: 194,
      width: 542,
      align: "center",
      text: "Certificate of Achievement",
      fontSize: 40,
      fontWeight: 600,
      letterSpacing: -0.8,
      color: INK,
    }),
    text("certificate-presented", {
      x: 200,
      y: 256,
      width: 442,
      align: "center",
      text: "This certificate is proudly presented to",
      fontSize: 9.5,
      color: MUTED,
    }),
    text("certificate-name", {
      x: 140,
      y: 284,
      width: 562,
      align: "center",
      text: "Amelia Hart",
      fontSize: 38,
      fontWeight: 600,
      fontFamily: "Times New Roman",
      color: INK,
    }),
    text("certificate-body", {
      x: 210,
      y: 344,
      width: 422,
      align: "center",
      text: "for outstanding completion of the Advanced Service Design Programme, demonstrating exceptional craft, rigour, and care for the people at the heart of the work.",
      fontSize: 9.5,
      lineHeight: 1.7,
      color: "#4f5a56",
    }),
    text("certificate-date-label", {
      x: 120,
      y: 442,
      width: 170,
      text: "ISSUED · 14 JUNE 2026",
      fontSize: 6.5,
      fontWeight: 600,
      letterSpacing: 1.4,
      color: MUTED,
    }),
  );
  e.push(line("certificate-sign-1", 120, 430, 160, INK, 0.7));
  e.push(
    text("certificate-sign-1-name", {
      x: 120,
      y: 444,
      width: 170,
      text: "Prof. Daniel Kim",
      fontSize: 8.5,
      fontWeight: 600,
      color: INK,
    }),
    text("certificate-sign-1-role", {
      x: 120,
      y: 457,
      width: 170,
      text: "Programme Director",
      fontSize: 7,
      color: MUTED,
    }),
  );
  e.push(line("certificate-sign-2", 562, 430, 160, INK, 0.7));
  e.push(
    text("certificate-sign-2-name", {
      x: 562,
      y: 444,
      width: 170,
      text: "Mara Sørensen",
      fontSize: 8.5,
      fontWeight: 600,
      color: INK,
    }),
    text("certificate-sign-2-role", {
      x: 562,
      y: 457,
      width: 170,
      text: "Dean of the Academy",
      fontSize: 7,
      color: MUTED,
    }),
    text("certificate-seal", {
      x: 503,
      y: 162,
      width: 98,
      text: "VERIFIED\n2026",
      fontSize: 7,
      fontWeight: 700,
      letterSpacing: 1.5,
      align: "center",
      lineHeight: 1.5,
      color: GOLD,
    }),
  );
  return { pages: [p], title: "Certificate" };
}

function contract(): { pages: PaperPage[]; title: string } {
  const p1 = page();
  const e1 = p1.elements;
  e1.push(
    text("contract-title", {
      x: 56,
      y: 56,
      width: 483,
      text: "CONSULTING SERVICES AGREEMENT",
      fontSize: 19,
      fontWeight: 700,
      letterSpacing: 0.4,
      color: INK,
    }),
    text("contract-subtitle", {
      x: 56,
      y: 84,
      width: 483,
      text: "This Consulting Services Agreement (the “Agreement”) is entered into as of 18 March 2026.",
      fontSize: 8.5,
      lineHeight: 1.6,
      color: MUTED,
    }),
  );
  e1.push(line("contract-rule", 56, 124, 483, INK, 1));
  e1.push(
    text("contract-parties-label", {
      x: 56,
      y: 148,
      width: 200,
      text: "PARTIES",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.6,
      color: GREEN,
    }),
    text("contract-party-a", {
      x: 56,
      y: 168,
      width: 220,
      text: "MERIDIAN ADVISORY SAS\n72 Boulevard Haussmann\n75008 Paris, France\nrepresented by Adrien Laurent",
      fontSize: 8.3,
      lineHeight: 1.65,
      color: INK,
    }),
    text("contract-party-b", {
      x: 310,
      y: 168,
      width: 229,
      text: "MAISON VERGER SAS\n12 Quai Saint-Vincent\n69001 Lyon, France\nrepresented by Camille Bernard",
      fontSize: 8.3,
      lineHeight: 1.65,
      color: INK,
    }),
  );
  const clauses = [
    [
      "1. Services",
      "The Consultant will provide strategic advisory services for the Company's Q2 2026 growth programme, as described in Exhibit A. The Consultant will report to the Company's Chief Executive Officer and will devote such time and attention as is reasonably required to perform the services diligently.",
    ],
    [
      "2. Compensation",
      "The Company will pay the Consultant a fixed fee of €24,000, invoiced in three equal instalments upon signature, delivery of the interim report, and presentation of final recommendations. Invoices are payable within thirty (30) days of receipt.",
    ],
    [
      "3. Expenses",
      "Reasonable travel and third-party research expenses incurred with the Company's prior written approval will be reimbursed at cost. The Consultant will provide appropriate documentation for all expenses.",
    ],
    [
      "4. Confidentiality",
      "Each party will keep confidential all non-public information concerning the other party received during the engagement and will use such information solely for the purposes of this Agreement. This obligation survives termination for a period of three (3) years.",
    ],
    [
      "5. Intellectual property",
      "All deliverables created specifically for the Company under this Agreement will become the property of the Company upon full payment. The Consultant retains ownership of its pre-existing tools, methodologies, and know-how.",
    ],
  ];
  let y = 232;
  clauses.forEach(([title, body]) => {
    e1.push(
      text(`contract-clause-${title}`, {
        x: 56,
        y,
        width: 483,
        text: title,
        fontSize: 9,
        fontWeight: 700,
        color: INK,
      }),
      text(`contract-clause-body-${title}`, {
        x: 56,
        y: y + 18,
        width: 483,
        text: body,
        fontSize: 8,
        lineHeight: 1.65,
        color: "#49534f",
      }),
    );
    y += 88;
  });
  addFooter(e1, "contract", "MERIDIAN / AGREEMENT · PAGE 1");

  const p2 = page();
  const e2 = p2.elements;
  e2.push(
    text("contract-page2-header", {
      x: 56,
      y: 56,
      width: 483,
      text: "CONSULTING SERVICES AGREEMENT",
      fontSize: 7,
      fontWeight: 700,
      letterSpacing: 1.4,
      color: GREEN,
    }),
    line("contract-page2-rule", 56, 76, 483, LINE, 0.8),
  );
  const remainingClauses = [
    [
      "6. Term & termination",
      "This Agreement begins on 18 March 2026 and continues until 30 June 2026 unless terminated earlier. Either party may terminate for convenience with fourteen (14) days' written notice. Fees for work performed to the date of termination remain payable.",
    ],
    [
      "7. Independent contractor",
      "The Consultant is an independent contractor and not an employee of the Company. Nothing in this Agreement creates a partnership, joint venture, or agency relationship between the parties.",
    ],
    [
      "8. Limitation of liability",
      "The Consultant's aggregate liability under this Agreement is limited to the fees paid under this Agreement. Neither party will be liable for indirect, incidental, or consequential damages.",
    ],
    [
      "9. Governing law",
      "This Agreement is governed by the laws of France. The parties submit to the exclusive jurisdiction of the courts of Paris in relation to any dispute arising out of or in connection with this Agreement.",
    ],
    [
      "10. Entire agreement",
      "This Agreement, together with its Exhibits, constitutes the entire agreement between the parties and supersedes all prior discussions and understandings, whether written or oral.",
    ],
  ];
  let y2 = 106;
  remainingClauses.forEach(([title, body]) => {
    e2.push(
      text(`contract2-clause-${title}`, {
        x: 56,
        y: y2,
        width: 483,
        text: title,
        fontSize: 9,
        fontWeight: 700,
        color: INK,
      }),
      text(`contract2-clause-body-${title}`, {
        x: 56,
        y: y2 + 18,
        width: 483,
        text: body,
        fontSize: 8,
        lineHeight: 1.65,
        color: "#49534f",
      }),
    );
    y2 += 85;
  });
  e2.push(
    text("contract-sign-label", {
      x: 56,
      y: 580,
      width: 480,
      text: "SIGNATURES",
      fontSize: 6.8,
      fontWeight: 700,
      letterSpacing: 1.6,
      color: GREEN,
    }),
    text("contract-sign-a-label", {
      x: 56,
      y: 608,
      width: 210,
      text: "FOR MERIDIAN ADVISORY",
      fontSize: 6.5,
      fontWeight: 600,
      letterSpacing: 1.2,
      color: MUTED,
    }),
    text("contract-sign-b-label", {
      x: 330,
      y: 608,
      width: 210,
      text: "FOR MAISON VERGER",
      fontSize: 6.5,
      fontWeight: 600,
      letterSpacing: 1.2,
      color: MUTED,
    }),
  );
  e2.push(line("contract-sign-a-line", 56, 682, 209, INK, 0.7));
  e2.push(line("contract-sign-b-line", 330, 682, 209, INK, 0.7));
  e2.push(
    text("contract-sign-a-name", {
      x: 56,
      y: 696,
      width: 210,
      text: "Adrien Laurent\nManaging Partner",
      fontSize: 8,
      lineHeight: 1.5,
      color: INK,
    }),
    text("contract-sign-b-name", {
      x: 330,
      y: 696,
      width: 210,
      text: "Camille Bernard\nChief Executive Officer",
      fontSize: 8,
      lineHeight: 1.5,
      color: INK,
    }),
  );
  addFooter(e2, "contract2", "MERIDIAN / AGREEMENT · PAGE 2");
  return { pages: [p1, p2], title: "Simple contract" };
}

const builders: TemplateDefinition[] = [
  {
    id: "invoice",
    title: "Invoice",
    description: "A precise, editorial invoice with line items and payment details.",
    category: "Finance",
    accent: "#265249",
    tags: ["Business", "Finance"],
    build: invoice,
  },
  {
    id: "quotation",
    title: "Professional quotation",
    description: "A confident project quote with scope, fees, and terms.",
    category: "Business",
    accent: "#397e6e",
    tags: ["Sales", "Proposal"],
    build: quotation,
  },
  {
    id: "resume",
    title: "Resume / CV",
    description: "A structured two-column CV that makes experience easy to scan.",
    category: "Career",
    accent: "#2b6559",
    tags: ["Career", "Personal"],
    build: resume,
  },
  {
    id: "letter",
    title: "Business letter",
    description: "A formal letterhead with considered typography and spacing.",
    category: "Business",
    accent: "#3f4a47",
    tags: ["Correspondence"],
    build: businessLetter,
  },
  {
    id: "proposal",
    title: "Project proposal",
    description: "A two-page cover and approach for client pitches.",
    category: "Business",
    accent: "#4f5a56",
    tags: ["Proposal", "Client"],
    build: proposal,
  },
  {
    id: "meeting-report",
    title: "Meeting report",
    description: "Decisions, action items, and a crisp executive summary.",
    category: "Teams",
    accent: "#397e6e",
    tags: ["Meeting", "Teams"],
    build: meetingReport,
  },
  {
    id: "certificate",
    title: "Certificate",
    description: "A landscape certificate with classic framing and signature lines.",
    category: "Events",
    accent: "#b7883c",
    tags: ["Award", "Landscape"],
    build: certificate,
  },
  {
    id: "contract",
    title: "Simple contract",
    description: "A clean two-page services agreement ready for signatures.",
    category: "Legal",
    accent: "#265249",
    tags: ["Legal", "Agreement"],
    build: contract,
  },
];

export const TEMPLATE_DEFINITIONS = builders;

const previewCache = new Map<string, PaperPage>();

export function getTemplatePreviewPage(templateId: string): PaperPage | null {
  const cached = previewCache.get(templateId);
  if (cached) return cached;
  const definition = TEMPLATE_DEFINITIONS.find((template) => template.id === templateId);
  if (!definition) return null;
  const { pages } = definition.build();
  const first = pages[0];
  previewCache.set(templateId, first);
  return first;
}

export function instantiateTemplate(templateId: string, title?: string): PaperDocument | null {
  const definition = TEMPLATE_DEFINITIONS.find((template) => template.id === templateId);
  if (!definition) return null;
  const { pages, title: fallbackTitle } = definition.build();
  const now = Date.now();
  const documentTitle = title?.trim() || fallbackTitle;
  return {
    id: createDocumentId(),
    title: documentTitle,
    pages,
    createdAt: now,
    updatedAt: now,
    templateId,
    metadata: {
      title: documentTitle,
      author: "",
      subject: "",
      keywords: definition.tags,
      creator: "Paperforge",
    },
  };
}
