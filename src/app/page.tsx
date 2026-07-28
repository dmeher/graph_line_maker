import Link from "next/link";
import {
  ArrowRight,
  Check,
  Command,
  Crop,
  Download,
  FileImage,
  Grid3X3,
  Layers3,
  Maximize2,
  MousePointer2,
  MoveUpRight,
  Palette,
  PanelRight,
  PenTool,
  Printer,
  Ruler,
  ScanLine,
  Sparkles,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";

const processSteps = [
  {
    index: "01",
    icon: FileImage,
    title: "Prepare",
    text: "Import a source, isolate the artwork, and set the crop across one or many files.",
  },
  {
    index: "02",
    icon: PenTool,
    title: "Compose",
    text: "Arrange layers, refine lines, recolor regions, and shape the graph cell by cell.",
  },
  {
    index: "03",
    icon: Printer,
    title: "Produce",
    text: "Export a sharp digital chart or tile it precisely across physical pages.",
  },
] as const;

const featureCards = [
  {
    icon: Layers3,
    label: "Layer-aware",
    title: "Keep the working parts separate.",
    text: "Sources, clipart, shapes, cell paint, groups, locks, and visibility remain editable.",
    modifier: "wide",
  },
  {
    icon: ScanLine,
    label: "Source intelligence",
    title: "Clean line art faster.",
    text: "Detect artwork, remove backgrounds, trace vectors, erase, or lasso without touching the original.",
    modifier: "tall",
  },
  {
    icon: Palette,
    label: "Color system",
    title: "Plan with real counts.",
    text: "Lock colors, override individual regions, and track the cells each color occupies.",
    modifier: "palette",
  },
  {
    icon: Ruler,
    label: "Physical accuracy",
    title: "One cell. One centimeter.",
    text: "Set page, grid, numbering, margin, and print options from the same document.",
    modifier: "measure",
  },
] as const;

const pixelMotif = [
  "00000000000000",
  "00001100000000",
  "00012210000000",
  "00122221000000",
  "01223322100000",
  "12230032210000",
  "01223322100000",
  "00122221000000",
  "00012210000000",
  "00001100000000",
] as const;

function ProductCanvas() {
  return (
    <figure className="atelier-demo" aria-labelledby="atelier-demo-caption">
      <div className="atelier-demo__commandbar">
        <div className="atelier-demo__window-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="atelier-demo__file">
          <strong>Floral border</strong>
          <span><Check size={11} aria-hidden="true" /> Saved</span>
        </div>
        <div className="atelier-demo__command-actions" aria-hidden="true">
          <button type="button" tabIndex={-1} disabled><ZoomOut size={14} /></button>
          <span>86%</span>
          <button type="button" tabIndex={-1} disabled><ZoomIn size={14} /></button>
          <i />
          <button type="button" tabIndex={-1} disabled><Download size={14} /></button>
        </div>
      </div>

      <div className="atelier-demo__workspace">
        <div className="atelier-demo__rail" aria-hidden="true">
          <span className="is-active"><MousePointer2 size={16} /></span>
          <span><Crop size={16} /></span>
          <span><PenTool size={16} /></span>
          <span><WandSparkles size={16} /></span>
          <span><Palette size={16} /></span>
        </div>

        <div className="atelier-demo__layers" aria-hidden="true">
          <div className="atelier-demo__panel-title">
            <strong>Layers</strong>
            <span>4</span>
          </div>
          <div className="atelier-demo__layer is-selected">
            <i className="atelier-demo__thumbnail atelier-demo__thumbnail--art" />
            <span><strong>Floral outline</strong><small>Source image</small></span>
          </div>
          <div className="atelier-demo__layer">
            <i className="atelier-demo__thumbnail atelier-demo__thumbnail--cells" />
            <span><strong>Blue fill</strong><small>Cell paint</small></span>
          </div>
          <div className="atelier-demo__layer">
            <i className="atelier-demo__thumbnail atelier-demo__thumbnail--shape" />
            <span><strong>Frame</strong><small>Shape</small></span>
          </div>
        </div>

        <div className="atelier-demo__stage">
          <div className="atelier-demo__ruler atelier-demo__ruler--horizontal" aria-hidden="true">
            <span>0</span><span>5</span><span>10</span><span>15</span><span>20</span>
          </div>
          <div className="atelier-demo__artboard">
            <div className="atelier-demo__pixels" aria-hidden="true">
              {pixelMotif.flatMap((row, rowIndex) =>
                [...row].map((cell, columnIndex) => (
                  <span
                    key={`${rowIndex}-${columnIndex}`}
                    className={`atelier-demo__pixel atelier-demo__pixel--${cell}`}
                  />
                )),
              )}
            </div>
            <span className="atelier-demo__selection" aria-hidden="true">
              <i /><i /><i /><i />
            </span>
          </div>
          <div className="atelier-demo__floating-tools" aria-hidden="true">
            <span><Maximize2 size={13} /> Fit</span>
            <i />
            <span><Grid3X3 size={13} /> Grid</span>
          </div>
        </div>

        <div className="atelier-demo__inspector" aria-hidden="true">
          <div className="atelier-demo__panel-title">
            <strong>Selection</strong>
            <PanelRight size={14} />
          </div>
          <div className="atelier-demo__property">
            <span>Position</span>
            <div><strong>X&nbsp; 4.0</strong><strong>Y&nbsp; 7.5</strong></div>
          </div>
          <div className="atelier-demo__property">
            <span>Size</span>
            <div><strong>W&nbsp; 12</strong><strong>H&nbsp; 9</strong></div>
          </div>
          <div className="atelier-demo__property">
            <span>Region color</span>
            <div className="atelier-demo__palette">
              <i /><i /><i /><i /><i />
            </div>
          </div>
        </div>
      </div>

      <figcaption id="atelier-demo-caption">
        A full production workspace that keeps the canvas in command.
      </figcaption>
    </figure>
  );
}

export default function Home() {
  return (
    <main className="atelier-landing">
      <header className="atelier-nav">
        <div className="atelier-container atelier-nav__inner">
          <Link href="/" aria-label="Graph Pixel Maker home" className="atelier-nav__brand">
            <BrandMark />
          </Link>
          <nav className="atelier-nav__links" aria-label="Primary navigation">
            <a href="#process">Process</a>
            <a href="#studio">Studio</a>
            <a href="#output">Output</a>
          </nav>
          <Link href="/login" className="atelier-nav__access">
            Open workspace
            <MoveUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="atelier-hero">
        <div className="atelier-container atelier-hero__grid">
          <div className="atelier-hero__copy">
            <p className="atelier-kicker">
              <span><Sparkles size={13} aria-hidden="true" /></span>
              A precision studio for graph-based craft
            </p>
            <h1>
              From artwork to
              <span>make-ready graph.</span>
            </h1>
            <p className="atelier-hero__lede">
              Prepare line art, compose it on a measured grid, and produce accurate charts in one focused workspace.
            </p>
            <div className="atelier-hero__actions">
              <Link href="/login" className="atelier-button atelier-button--primary">
                Start with email
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a href="#studio" className="atelier-button atelier-button--quiet">
                Explore the studio
              </a>
            </div>
            <dl className="atelier-hero__proof">
              <div><dt>20 × 125</dt><dd>maximum graph</dd></div>
              <div><dt>1 cm</dt><dd>physical cell scale</dd></div>
              <div><dt>4</dt><dd>export paths</dd></div>
            </dl>
          </div>

          <div className="atelier-hero__product" id="studio">
            <span className="atelier-hero__orbit atelier-hero__orbit--one" aria-hidden="true">Precise</span>
            <span className="atelier-hero__orbit atelier-hero__orbit--two" aria-hidden="true">Editable</span>
            <ProductCanvas />
          </div>
        </div>
      </section>

      <div className="atelier-format-bar" aria-label="Supported formats">
        <div className="atelier-container atelier-format-bar__inner">
          <span>Import</span>
          <ul>
            <li>PNG</li><li>JPG</li><li>WEBP</li><li>SVG</li><li>PDF</li>
          </ul>
          <ArrowRight size={16} aria-hidden="true" />
          <span>Export</span>
          <ul>
            <li>PNG</li><li>PDF</li><li>Print</li><li>JSON</li>
          </ul>
        </div>
      </div>

      <section className="atelier-process" id="process">
        <div className="atelier-container">
          <header className="atelier-section-head">
            <div>
              <p className="atelier-kicker">One continuous workflow</p>
              <h2>A shorter distance between idea and chart.</h2>
            </div>
            <p>Each stage hands cleanly to the next, while every decision stays reversible.</p>
          </header>
          <ol className="atelier-process__steps">
            {processSteps.map(({ index, icon: Icon, title, text }) => (
              <li key={index} className="atelier-process-card">
                <div className="atelier-process-card__top">
                  <span>{index}</span>
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <i aria-hidden="true"><ArrowRight size={15} /></i>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="atelier-features">
        <div className="atelier-container atelier-features__layout">
          <div className="atelier-features__intro">
            <p className="atelier-kicker">Built like a real editor</p>
            <h2>Deep controls, arranged around the work.</h2>
            <p>
              The canvas stays central while contextual tools appear where they are useful—never as a wall of settings.
            </p>
            <Link href="/login">
              Enter the workspace <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="atelier-features__bento">
            {featureCards.map(({ icon: Icon, label, title, text, modifier }) => (
              <article key={title} className={`atelier-feature-card atelier-feature-card--${modifier}`}>
                <div className="atelier-feature-card__icon"><Icon size={21} aria-hidden="true" /></div>
                <p>{label}</p>
                <h3>{title}</h3>
                <span>{text}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="atelier-output" id="output">
        <div className="atelier-container atelier-output__grid">
          <div className="atelier-output__preview" aria-hidden="true">
            <div className="atelier-output__sheet atelier-output__sheet--rear" />
            <div className="atelier-output__sheet atelier-output__sheet--middle" />
            <div className="atelier-output__sheet atelier-output__sheet--front">
              <span>01 / 06</span>
              <div className="atelier-output__print-grid" />
              <strong>20 × 125 cm</strong>
            </div>
            <div className="atelier-output__badge"><Printer size={15} /> Print ready</div>
          </div>
          <div className="atelier-output__copy">
            <p className="atelier-kicker">Screen to material</p>
            <h2>Print at the scale you designed.</h2>
            <p>
              Crisp vector grid lines, page-aware tiling, physical margins, and portable project settings make the
              handoff dependable.
            </p>
            <ul>
              <li><Check size={15} aria-hidden="true" /> Tiled PDF and browser print</li>
              <li><Check size={15} aria-hidden="true" /> Paper size, margins, and orientation</li>
              <li><Check size={15} aria-hidden="true" /> PNG and JSON export</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="atelier-cta">
        <div className="atelier-container atelier-cta__inner">
          <div>
            <p className="atelier-kicker"><Command size={13} aria-hidden="true" /> Ready when you are</p>
            <h2>Give the next idea a precise place to land.</h2>
          </div>
          <Link href="/login" className="atelier-button atelier-button--light">
            Continue with email
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="atelier-footer">
        <div className="atelier-container atelier-footer__inner">
          <BrandMark />
          <p>Precision tools for graph-based craft.</p>
          <Link href="/login">Sign in <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      </footer>
    </main>
  );
}
