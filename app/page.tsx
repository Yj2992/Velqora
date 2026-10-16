import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ScanFace,
  ChartNoAxesCombined,
  FlaskConical,
  ShieldCheck,
  Sparkles,
  Plus,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
function SkinArtwork() {
  return (
    <div className="skin-artwork" aria-hidden="true">
      <div className="art-orbit orbit-one" />
      <div className="art-orbit orbit-two" />
      <svg className="face-art" viewBox="0 0 400 500" fill="none">
        <defs>
          <linearGradient
            id="face"
            x1="90"
            y1="50"
            x2="330"
            y2="440"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#E1C2B3" />
            <stop offset=".6" stopColor="#C79E93" />
            <stop offset="1" stopColor="#AB7F80" />
          </linearGradient>
          <radialGradient id="glow">
            <stop stopColor="#F7E7DD" stopOpacity=".7" />
            <stop offset="1" stopColor="#E4C3B3" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path
          d="M195 50C100 40 69 120 79 221C85 289 105 336 151 368L143 406C121 432 82 432 48 470H352C318 432 279 432 257 406L249 368C295 336 315 289 321 221C331 120 300 40 205 50"
          fill="url(#face)"
        />
        <ellipse cx="175" cy="180" rx="115" ry="145" fill="url(#glow)" />
        <path
          d="M113 207C131 196 154 198 167 207M234 207C247 198 270 196 288 207"
          stroke="#875F65"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M199 205L184 265C188 277 207 280 219 265"
          stroke="#A47878"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M166 304C183 296 201 298 217 301C227 304 232 304 237 303C221 320 184 321 166 304Z"
          fill="#A57678"
        />
        <path
          d="M91 173C102 101 127 66 198 68C271 62 297 108 311 173"
          stroke="#BC958B"
          strokeWidth="2"
        />
        <g stroke="#FAF8F5" strokeOpacity=".7" strokeWidth=".7">
          <ellipse cx="200" cy="232" rx="101" ry="129" />
          <path d="M103 200L167 160L234 160L296 200L275 274L233 339L168 339L125 274Z" />
          <path d="M167 160L125 274L233 339L234 160L275 274L168 339L167 160ZM103 200L296 200M125 274L275 274" />
        </g>
        <g fill="#FAF8F5">
          {[
            [103, 200],
            [167, 160],
            [234, 160],
            [296, 200],
            [125, 274],
            [275, 274],
            [168, 339],
            [233, 339],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="3" />
          ))}
        </g>
      </svg>
      <div className="art-label label-one">
        <span className="label-icon">
          <ScanFace size={20} />
        </span>
        <div>
          <small>GET TO KNOW YOUR SKIN</small>
          <strong>A personal perspective</strong>
        </div>
      </div>
      <div className="art-label label-two">
        <span className="label-icon sage-bg">
          <ChartNoAxesCombined size={20} />
        </span>
        <div>
          <small>OBSERVE WHAT CHANGES</small>
          <strong>One scan at a time</strong>
        </div>
      </div>
      <div className="art-caption">
        <i />
        Cosmetic skin analysis · YouCam Skin AI
      </div>
    </div>
  );
}
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav>
          <a href="#how-it-works">How it works</a>
          <a href="#features">The experience</a>
          <a href="#privacy">Your privacy</a>
        </nav>
        <div>
          <Link href="/login" className="login-link">
            Log in
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">
              Get started <ArrowUpRight size={15} />
            </Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <i />
              YOUR SKIN. YOUR STORY. YOUR PROGRESS.
            </span>
            <h1>
              See beyond
              <br />
              your skin.
              <br />
              <em>
                Track what
                <br />
                truly works.
              </em>
            </h1>
            <p>
              Less guesswork. A little more understanding.
              <br />
              Analyze your skin, observe your routine, and discover your story
              in the changes over time.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/signup">
                  Start your skin journey <ArrowUpRight size={18} />
                </Link>
              </Button>
              {process.env.NEXT_PUBLIC_DEMO_ENABLED !== "false" && (
                <Link className="text-link" href="/demo">
                  Explore the demo <ArrowRight size={17} />
                </Link>
              )}
            </div>
            <span className="hero-trust">
              <ShieldCheck size={15} />
              Private by design <span>·</span> Powered by YouCam Skin AI
            </span>
          </div>
          <SkinArtwork />
          <div className="hero-bottom">
            <span>SKINCARE, WITH A LITTLE MORE PERSPECTIVE.</span>
            <a href="#how-it-works">Keep exploring ↓</a>
          </div>
        </section>
        <section className="steps-section" id="how-it-works">
          <div className="section-intro">
            <span className="eyebrow">
              THOUGHTFUL TECHNOLOGY. SIMPLE RITUALS.
            </span>
            <h2>
              Get curious.
              <br />
              Get a clearer picture.
            </h2>
            <p>
              Your skin changes. Your routine evolves.
              <br />
              DermaLens helps you see the story in between.
            </p>
          </div>
          <div className="steps-grid">
            {[
              {
                n: "01",
                Icon: ScanFace,
                title: "A moment for your skin.",
                text: "Upload a clear photograph. Explore 15 cosmetic skin indicators through YouCam Skin AI.",
              },
              {
                n: "02",
                Icon: ChartNoAxesCombined,
                title: "Make room for perspective.",
                text: "Keep a history of your scans. Compare measurements and observe visible changes over time.",
              },
              {
                n: "03",
                Icon: FlaskConical,
                title: "Let your routine tell its story.",
                text: "Record what you use. Follow one measurement and explore changes alongside your routine.",
              },
            ].map(({ n, Icon, title, text }) => (
              <article key={n}>
                <div className="step-top">
                  <span>{n}</span>
                  <Icon size={27} strokeWidth={1.3} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="features" className="feature-section">
          <div className="feature-copy">
            <span className="eyebrow">YOUR PERSONAL SKIN INTELLIGENCE</span>
            <h2>
              A little data.
              <br />A deeper understanding.
            </h2>
            <p>
              One thoughtful space for your scans, your routine, and the
              questions that come with them.
            </p>
            <div className="feature-list">
              <div>
                <Plus />
                <p>
                  <strong>Your measurements, together.</strong>
                  <span>
                    From texture to radiance, a closer look at your skin.
                  </span>
                </p>
              </div>
              <div>
                <Plus />
                <p>
                  <strong>A timeline worth following.</strong>
                  <span>Clear comparisons, without invented trends.</span>
                </p>
              </div>
              <div>
                <Plus />
                <p>
                  <strong>Context for your curiosity.</strong>
                  <span>Grounded explanations based on your stored data.</span>
                </p>
              </div>
            </div>
            <Button asChild variant="secondary">
              <Link href="/demo">
                Take a look inside <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="dashboard-preview">
            <div className="preview-head">
              <Logo />
              <span className="pill neutral">Synthetic preview</span>
            </div>
            <span className="eyebrow">YOUR SKIN, IN PERSPECTIVE.</span>
            <div className="preview-score">
              <span>
                Overall skin score
                <strong>
                  70.8<small>/100</small>
                </strong>
              </span>
              <div className="preview-mini">
                <span>Skin type</span>
                <strong>Combination</strong>
                <small>Whole face</small>
              </div>
            </div>
            <div className="preview-chart">
              <span>Six moments. One story.</span>
              <svg
                viewBox="0 0 400 130"
                role="img"
                aria-label="Illustrative synthetic score history"
              >
                <path
                  d="M0 30H400M0 70H400M0 110H400"
                  stroke="#EAE5E8"
                  strokeDasharray="3 5"
                />
                <path
                  d="M5 105C35 105 49 83 80 82S135 94 160 87S214 40 240 45S282 38 320 35S367 17 395 12"
                  stroke="#70556A"
                  strokeWidth="3"
                  fill="none"
                />
              </svg>
              <small>Sample data for illustration. Not real analysis.</small>
            </div>
            <div className="preview-insight">
              <Sparkles size={21} />
              <span>
                Small observations.
                <br />
                <strong>A clearer picture over time.</strong>
              </span>
            </div>
          </div>
        </section>
        <section className="privacy-section" id="privacy">
          <div className="privacy-emblem">
            <ShieldCheck size={42} strokeWidth={1} />
          </div>
          <span className="eyebrow">PERSONAL. BY DESIGN.</span>
          <h2>
            Your skin story
            <br />
            belongs to you.
          </h2>
          <p>
            Your photographs are stored privately and sent to YouCam only with
            your consent. You control your saved scans and measurements.
            External AI sharing is optional. Delete your DermaLens data whenever
            you choose.
          </p>
          <Link href="/privacy" className="text-link">
            Understand your privacy <ArrowUpRight size={17} />
          </Link>
        </section>
        <section className="final-cta">
          <span className="eyebrow">BEGIN WITH CURIOSITY.</span>
          <h2>
            Stop guessing.
            <br />
            <em>Start tracking.</em>
          </h2>
          <p>Get to know your skin, one thoughtful scan at a time.</p>
          <Button asChild>
            <Link href="/signup">
              Your story starts here <ArrowUpRight size={18} />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <p>See Beyond Your Skin. Track What Truly Works.</p>
        <div>
          <Link href="/login">Log in</Link>
          <Link href="/signup">Get started</Link>
          <a href="#privacy">Privacy</a>
        </div>
        <small>
          © {new Date().getFullYear()} DermaLens. Cosmetic self-tracking, not
          medical diagnosis.
        </small>
      </footer>
    </div>
  );
}
