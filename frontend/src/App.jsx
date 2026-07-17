import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, XCircle, Send, ChevronDown, ChevronUp,
  BookOpen, ShieldCheck, ArrowRight, TrendingUp, Sparkles
} from "lucide-react";
import RandomLetterSwap from "./RandomLetterSwap";
import UserCursor from "./UserCursor";
import Snowfall from "./Snowfall";

/* ============================================================
   DESIGN SYSTEM — "The Underwriting Ledger"
   ------------------------------------------------------------
   Palette: Paper white, ink slate-900, brand indigo-700, 
   emerald-700 (positive) / rose-600 (negative).
   Type: Newsreader italic (display) · IBM Plex Sans (body & data).
   ============================================================ */

const FONT_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,500;0,600;1,500;1,600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

  .font-display { font-family: 'Newsreader', serif; }
  .font-body { font-family: 'IBM Plex Sans', sans-serif; }
  .font-percentage { font-family: 'Newsreader', serif; font-style: italic; font-weight: 600; }

  @keyframes driftA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.05); } }
  @keyframes driftB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-25px,25px) scale(1.08); } }
  @keyframes riseIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
  
  @keyframes typeTrack {
    0% { opacity: 0; letter-spacing: -0.05em; filter: blur(4px); }
    100% { opacity: 1; letter-spacing: -0.01em; filter: blur(0); }
  }

  /* Core Interactive AI System Ring Pulse Animation */
  @keyframes insightPulse {
    0%, 100% { 
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.25);
    }
    50% { 
      box-shadow: 0 20px 30px -5px rgba(99, 102, 241, 0.12), 0 10px 14px -6px rgba(99, 102, 241, 0.08), 0 0 14px 2px rgba(99, 102, 241, 0.22);
      border-color: rgba(99, 102, 241, 0.5);
    }
  }

  /* Micro Signal Ping Indicator */
  @keyframes signalRadar {
    0% { transform: scale(0.95); opacity: 1; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  .blob-a { animation: driftA 14s ease-in-out infinite; }
  .blob-b { animation: driftB 17s ease-in-out infinite; }
  .rise { animation: riseIn 0.5s ease both; }
  .pop { animation: popIn 0.35s ease both; }
  .animate-title { animation: typeTrack 0.85s cubic-bezier(0.16, 1, 0.3, 1) both; }

  .glass {
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.8);
  }
  .glass-soft {
    background: rgba(255,255,255,0.55);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .radar-ring {
    animation: signalRadar 2s infinite cubic-bezier(0.16, 1, 0.3, 1);
  }

  .cursor-none-zone, .cursor-none-zone * { cursor: none !important; }

  @media (prefers-reduced-motion: reduce) {
    .blob-a, .blob-b, .rise, .pop, .animate-title, .ai-interactive-glow, .radar-ring { animation: none !important; }
  }
`;

const SAMPLE_APPLICANTS = [
  {
    label: "Applicant #1042",
    tag: "Clear approve",
    data: {
      person_age: 34, person_income: 82000, person_home_ownership: "MORTGAGE",
      person_emp_length: 8, loan_intent: "HOMEIMPROVEMENT", loan_amnt: 15000,
      loan_int_rate: 9.2, loan_percent_income: 0.11, cb_person_default_on_file: "N",
      cb_person_cred_hist_length: 12, credit_score: 745,
    },
  },
  {
    label: "Applicant #2871",
    tag: "Clear reject",
    data: {
      person_age: 23, person_income: 28000, person_home_ownership: "RENT",
      person_emp_length: 1, loan_intent: "PERSONAL", loan_amnt: 18000,
      loan_int_rate: 16.8, loan_percent_income: 0.52, cb_person_default_on_file: "Y",
      cb_person_cred_hist_length: 2, credit_score: 560,
    },
  },
  {
    label: "Applicant #1930",
    tag: "Borderline",
    data: {
      person_age: 29, person_income: 51000, person_home_ownership: "RENT",
      person_emp_length: 3, loan_intent: "EDUCATION", loan_amnt: 12000,
      loan_int_rate: 11.5, loan_percent_income: 0.24, cb_person_default_on_file: "N",
      cb_person_cred_hist_length: 4, credit_score: 645,
    },
  },
];

const EMPTY_APPLICANT = SAMPLE_APPLICANTS[2].data;

const FIELD_META = [
  { key: "person_age", label: "Age", type: "number" },
  { key: "person_income", label: "Annual income ($)", type: "number" },
  { key: "person_home_ownership", label: "Home ownership", type: "select", options: ["RENT", "OWN", "MORTGAGE", "OTHER"] },
  { key: "person_emp_length", label: "Employment length (yrs)", type: "number" },
  { key: "loan_intent", label: "Loan purpose", type: "select", options: ["EDUCATION", "MEDICAL", "PERSONAL", "VENTURE", "HOMEIMPROVEMENT", "DEBTCONSOLIDATION"] },
  { key: "loan_amnt", label: "Loan amount ($)", type: "number" },
  { key: "loan_int_rate", label: "Interest rate (%)", type: "number" },
  { key: "loan_percent_income", label: "Loan / income ratio", type: "number", step: 0.01 },
  { key: "cb_person_default_on_file", label: "Prior default on file", type: "select", options: ["N", "Y"] },
  { key: "cb_person_cred_hist_length", label: "Credit history length (yrs)", type: "number" },
  { key: "credit_score", label: "Credit score", type: "number" },
];

const FEATURE_LABELS = {
  credit_score: "Credit score",
  loan_percent_income: "Loan / income ratio",
  person_income: "Annual income",
  cb_person_default_on_file: "Prior default on file",
  cb_person_cred_hist_length: "Credit history length",
  loan_int_rate: "Interest rate",
  person_emp_length: "Employment length",
  person_age: "Age",
  loan_amnt: "Loan amount",
  person_home_ownership: "Home ownership",
  loan_intent: "Loan purpose",
};

function runMockAssessment(a) {
  const contributions = [
    { feature: "credit_score", impact: ((a.credit_score - 620) / 230) * 0.34, value: a.credit_score },
    { feature: "loan_percent_income", impact: -(a.loan_percent_income - 0.25) * 0.9, value: a.loan_percent_income },
    { feature: "person_income", impact: (Math.min(a.person_income, 100000) / 100000 - 0.4) * 0.22, value: a.person_income },
    { feature: "cb_person_default_on_file", impact: a.cb_person_default_on_file === "Y" ? -0.22 : 0.05, value: a.cb_person_default_on_file },
    { feature: "cb_person_cred_hist_length", impact: (Math.min(a.cb_person_cred_hist_length, 15) / 15) * 0.13 - 0.03, value: a.cb_person_cred_hist_length },
    { feature: "loan_int_rate", impact: -((a.loan_int_rate - 10) / 15) * 0.12, value: a.loan_int_rate },
    { feature: "person_emp_length", impact: (Math.min(a.person_emp_length, 10) / 10) * 0.09 - 0.02, value: a.person_emp_length },
  ];
  const score = contributions.reduce((sum, c) => sum + c.impact, 0);
  const riskProbability = 1 / (1 + Math.exp(score * 4));
  const verdict = riskProbability < 0.45 ? "APPROVED" : "REJECTED";
  const distanceFromMid = Math.abs(0.5 - riskProbability);
  const confidence = distanceFromMid > 0.25 ? "high" : distanceFromMid > 0.1 ? "medium" : "low";

  const shap_values = contributions
    .map((c) => ({
      feature: c.feature, value: c.value,
      impact: Number(c.impact.toFixed(3)),
      direction: c.impact >= 0 ? "positive" : "negative",
    }))
    .sort((x, y) => Math.abs(y.impact) - Math.abs(x.impact))
    .slice(0, 6);

  const top = shap_values.slice(0, 2).map((s) => FEATURE_LABELS[s.feature]);
  const summary = verdict === "APPROVED"
    ? `Approved, driven mainly by ${top[0].toLowerCase()} and ${top[1].toLowerCase()}.`
    : `Declined, driven mainly by ${top[0].toLowerCase()} and ${top[1].toLowerCase()}.`;

  return {
    prediction: { verdict, risk_probability: Number(riskProbability.toFixed(2)), confidence },
    shap_values,
    explanation: { summary, top_factors: shap_values.slice(0, 3).map((s) => s.feature) },
  };
}

function mockAnswerFollowup(question, result) {
  const q = question.toLowerCase();
  const hit = result.shap_values.find((s) => q.includes(s.feature.split("_")[0]) || q.includes(FEATURE_LABELS[s.feature].toLowerCase().split(" ")[0]));
  if (hit) {
    const dir = hit.direction === "positive" ? "toward approval" : "toward decline";
    return `${FEATURE_LABELS[hit.feature]} contributed ${Math.abs(hit.impact).toFixed(2)} ${dir}, based on a value of ${hit.value}. That places it ${result.shap_values.indexOf(hit) === 0 ? "as the single largest factor" : `#${result.shap_values.indexOf(hit) + 1} by size`} in this decision.`;
  }
  const top = result.shap_values[0];
  return `I don't have a specific factor matching that in this decision. The largest driver here was ${FEATURE_LABELS[top.feature].toLowerCase()}, contributing ${top.impact >= 0 ? "+" : ""}${top.impact.toFixed(2)} toward the outcome.`;
}

function useCountUp(target, duration = 650) {
  const [value, setValue] = useState(target);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const from = value;
    cancelAnimationFrame(raf.current);
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return value;
}

function BalanceBeam({ shapValues }) {
  const maxAbs = Math.max(...shapValues.map((s) => Math.abs(s.impact)), 0.01);
  return (
    <div className="space-y-3">
      {shapValues.map((s, i) => {
        const pct = (Math.abs(s.impact) / maxAbs) * 100;
        const isPos = s.direction === "positive";
        return (
          <div key={s.feature} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-body text-sm text-slate-700">{FEATURE_LABELS[s.feature] || s.feature}</span>
              <span className="font-body text-xs text-slate-400">
                value: {typeof s.value === "number" ? Math.round(s.value * 100) / 100 : s.value}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-0.5 items-center h-6">
              <div className="flex justify-end h-full">
                {!isPos && (
                  <div
                    className="h-full bg-rose-600 rounded-l flex items-center justify-start pl-2 transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  >
                    <span className="font-body text-[11px] font-semibold text-white whitespace-nowrap">{s.impact.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-start h-full">
                {isPos && (
                  <div
                    className="h-full bg-emerald-700 rounded-r flex items-center justify-end pr-2 transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  >
                    <span className="font-body text-[11px] font-semibold text-white whitespace-nowrap">+{s.impact.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex justify-center gap-6 pt-2 text-xs font-body text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-600 rounded-sm inline-block" /> weighs against</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-700 rounded-sm inline-block" /> weighs for</span>
      </div>
    </div>
  );
}

export default function FinancialAdvisorAgent() {
  const [viewMode, setViewMode] = useState("landing");
  const [applicant, setApplicant] = useState(EMPTY_APPLICANT);
  const [selectedSample, setSelectedSample] = useState(2);
  const [formOpen, setFormOpen] = useState(false);
  const [result, setResult] = useState(() => runMockAssessment(EMPTY_APPLICANT));
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");

  const chatEndRef = useRef(null);
  const animatedRisk = useCountUp(result.prediction.risk_probability * 100);

  useEffect(() => {
    if (messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function pickSample(i) {
    setSelectedSample(i);
    setApplicant(SAMPLE_APPLICANTS[i].data);
    setMessages([]);
  }

  function updateField(key, value) {
    setApplicant((prev) => ({ ...prev, [key]: value }));
    setSelectedSample(null);
  }

  function runAssessment() {
    setLoading(true);
    setMessages([]);
    setTimeout(() => {
      setResult(runMockAssessment(applicant));
      setLoading(false);
    }, 500);
  }

  function askQuestion(e) {
    e.preventDefault();
    if (!question.trim()) return;
    const q = question.trim();
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setTimeout(() => {
      setMessages((m) => [...m, { role: "agent", text: mockAnswerFollowup(q, result) }]);
    }, 400);
  }

  const verdict = result.prediction.verdict;
  const isApproved = verdict === "APPROVED";

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-50 font-body text-slate-900">
      <style>{FONT_IMPORT}</style>

      {/* Decorative ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="blob-a absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="blob-b absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      {/* Main Slide Track Wrapper */}
      <div 
        className="flex w-[200vw] h-screen items-stretch transition-transform duration-700 ease-in-out z-10 relative"
        style={{ transform: viewMode === "landing" ? "translateX(0)" : "translateX(-100vw)" }}
      >
        
        {/* ================= LANDING PORTAL PAGE ================= */}
        <div className="w-[100vw] h-screen shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <Snowfall
              count={90}
              speedMin={0.3}
              speedMax={1.1}
              wind={-0.2}
              windVariation={0.5}
              sizeMin={1}
              sizeMax={3}
              opacityMin={15}
              opacityMax={45}
              direction="down"
              color="#818cf8"
            />
          </div>

          <UserCursor
            size={30}
            color="#312e81"
            textColor="#eef2ff"
            offsetY={-2}
            style={{ width: "100%", height: "100%" }}
            classNames={{ root: "cursor-none-zone flex flex-col items-center justify-center px-6 py-6" }}
          >
            {/* Hero Segment */}
            <main className="relative max-w-4xl mx-auto text-center flex flex-col justify-center items-center">
              <div className="mb-4 animate-title select-none h-[clamp(3.5rem,9.5vw,6.2rem)]">
                <RandomLetterSwap
                  label="LoanShap"
                  mode="pingpong"
                  staggerDuration={0.035}
                  color="#0f172a"
                  font={{
                    fontFamily: "'Newsreader', serif",
                    fontStyle: "italic",
                    fontWeight: 600,
                    fontSize: "clamp(3rem,8.3vw,5.4rem)",
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                    textAlign: "center",
                  }}
                />
              </div>

              <p className="font-body text-sm md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-5 rise select-none" style={{ animationDelay: '100ms' }}>
                A rigorous credit underwriting matrix powered by tree attribution. We translate high-dimensional feature spaces into transparent ledger verification.
              </p>

              <div className="rise" style={{ animationDelay: '200ms' }}>
                <button
                  onClick={() => setViewMode("dashboard")}
                  className="group inline-flex items-center gap-2.5 bg-slate-900 text-white font-body text-sm md:text-base px-5 py-2.5 md:px-6 md:py-3.5 rounded-xl hover:bg-slate-800 shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 transition-all duration-350 transform active:scale-[0.98]"
                >
                  Initialize Assessment Ledger
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-6 text-left max-w-2xl w-full rise select-none" style={{ animationDelay: '300ms' }}>
                {/* Card A */}
                <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-4 md:p-5 shadow-xl shadow-slate-900/20">
                  <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-indigo-500/25 blur-2xl" />
                  <TrendingUp size={18} className="text-indigo-400 mb-2.5" />
                  <h3 className="font-display italic text-base md:text-lg text-white mb-1.5 leading-snug">
                    Additive Risk Attribution
                  </h3>
                  <p className="font-body text-[11px] md:text-xs text-slate-300 leading-relaxed">
                    Local explanation matrices calculate exact, unapproximated margin contributions for every financial variable.
                  </p>
                  <div className="mt-3 pt-3 border-t border-white/10 font-body text-[10px] uppercase tracking-widest text-indigo-300">
                    SHAP · TreeExplainer
                  </div>
                </div>

                {/* Card B */}
                <div className="relative rounded-2xl border border-slate-200 bg-white/70 p-4 md:p-5 shadow-sm">
                  <ShieldCheck size={18} className="text-emerald-700 mb-2.5" />
                  <h3 className="font-display italic text-base md:text-lg text-slate-900 mb-1.5 leading-snug">
                    Deterministic Verification
                  </h3>
                  <ul className="font-body text-[11px] md:text-xs text-slate-600 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-600 shrink-0" />
                      Hard analytical constraints on every inference
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-600 shrink-0" />
                      Text outputs mapped 1:1 to numerical weights
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-600 shrink-0" />
                      Zero approximation drift across repeat runs
                    </li>
                  </ul>
                </div>
              </div>
            </main>
          </UserCursor>
        </div>

        {/* ================= ANALYTICAL DASHBOARD PAGE ================= */}
        <div className="w-[100vw] h-screen overflow-y-auto px-6 py-10 shrink-0">
          <div className="relative max-w-7xl mx-auto">
            <header className="mb-6 pb-6 flex justify-between items-end border-b border-slate-200/60">
              <div>
                <h1 className="font-display text-3xl italic text-slate-900">LoanShap - Assessment Ledger</h1>
                <p className="font-body text-sm text-slate-500 mt-1">Every verdict here is weighed, not guessed — and every weight is shown.</p>
              </div>
              <button 
                onClick={() => setViewMode("landing")}
                className="font-body text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-600"
              >
                &lt; Return to Portal
              </button>
            </header>

            {/* THREE COLUMNS */}
            <div className="grid md:grid-cols-3 gap-6 items-start">

              {/* COLUMN 1 — APPLICANT */}
              <div className="glass rounded-2xl p-4 shadow-lg shadow-slate-200/50">
                <h2 className="font-display text-lg italic text-slate-800 mb-3">Applicant</h2>

                <div className="font-body text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">From dataset</div>
                <div className="flex flex-col gap-2 mb-4">
                  {SAMPLE_APPLICANTS.map((s, i) => (
                    <button
                      key={s.label}
                      onClick={() => pickSample(i)}
                      className={`text-left px-3 py-2 rounded-lg font-body text-sm transition-all duration-200 flex items-center justify-between ${
                        selectedSample === i
                          ? "bg-slate-900 text-white shadow-md"
                          : "bg-white/60 text-slate-700 hover:bg-white/90 border border-slate-200/70"
                      }`}
                    >
                      <span className="font-body text-xs font-medium">{s.label}</span>
                      <span className={`text-[10px] font-body font-medium ${selectedSample === i ? "text-slate-300" : "text-slate-400"}`}>{s.tag}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setFormOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-body text-slate-600 hover:text-slate-900"
                >
                  {formOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {formOpen ? "Hide" : "Enter manually"}
                </button>

                {formOpen && (
                  <div className="mt-3 pt-3 border-t border-slate-200/70 space-y-3 pop">
                    {FIELD_META.map((f) => (
                      <div key={f.key} className="flex items-center justify-between gap-3">
                        <label className="font-body text-xs text-slate-500 w-1/2">{f.label}</label>
                        {f.type === "select" ? (
                          <select
                            className="font-body text-sm bg-white/70 border border-slate-200 rounded px-2 py-1 w-1/2 focus:outline-none focus:border-indigo-400"
                            value={applicant[f.key]}
                            onChange={(e) => updateField(f.key, e.target.value)}
                          >
                            {f.options.map((o) => (<option key={o} value={o}>{o}</option>))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            step={f.step || 1}
                            className="font-body text-sm bg-white/70 border border-slate-200 rounded px-2 py-1 w-1/2 focus:outline-none focus:border-indigo-400"
                            value={applicant[f.key]}
                            onChange={(e) => updateField(f.key, Number(e.target.value))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={runAssessment}
                  disabled={loading}
                  className="w-full mt-4 bg-slate-900 text-white font-body text-sm py-2.5 rounded-lg hover:bg-slate-800 transition-all duration-200 disabled:opacity-50 shadow-md"
                >
                  {loading ? "Weighing factors..." : "Run assessment"}
                </button>
              </div>

              {/* COLUMN 2 — DECISION */}
              <div className="space-y-5">
                <div className="glass rounded-2xl p-5 pop shadow-lg shadow-slate-200/50" key={verdict + result.prediction.risk_probability}>
                  <div className="font-body text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Decision</div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-body text-sm font-medium ${
                      isApproved ? "bg-emerald-100/80 text-emerald-800" : "bg-rose-100/80 text-rose-800"
                    }`}>
                      {isApproved ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      {verdict}
                    </div>
                    <div className="text-right">
                      <div className="font-percentage text-3xl text-slate-900 leading-none">{animatedRisk.toFixed(0)}%</div>
                      <div className="font-body text-xs text-slate-500 mt-1">estimated risk · {result.prediction.confidence} confidence</div>
                    </div>
                  </div>
                  <p className="font-body text-sm text-slate-700 border-t border-slate-200/70 pt-3">{result.explanation.summary}</p>
                </div>

                <div className="glass rounded-2xl p-5 shadow-lg shadow-slate-200/50">
                  <h3 className="font-display text-base italic text-slate-800 mb-4">Reasons — what tipped the scale</h3>
                  <BalanceBeam shapValues={result.shap_values} />
                </div>
              </div>

              {/* COLUMN 3 — TERMINAL LOGIC INTERFACE (MODIFIED FOR AI INTERACTIVE GLOW) */}
              <div className="glass rounded-2xl p-5 shadow-lg flex flex-col ai-interactive-glow border border-indigo-100/40 bg-white/80" style={{ minHeight: "420px" }}>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70">
                  <div className="flex items-center gap-3">
                    {/* Animated Pulsing Icon Ring Anchor */}
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 relative">
                      <div className="absolute inset-0 rounded-full bg-indigo-500 radar-ring" />
                      <Sparkles size={16} className="text-white relative z-10 animate-pulse" />
                    </div>
                    <div>
                      <div className="font-display text-base italic text-slate-900 leading-tight flex items-center gap-1.5">
                        Ledger Insights 
                      </div>
                      <div className="font-body text-[10px] text-slate-400 font-semibold tracking-wide uppercase">Attribution Verification</div>
                    </div>
                  </div>
                </div>

                <p className="font-body text-xs text-slate-500 mb-3 leading-relaxed">
                  Every query response generated below is completely mapped to the factual SHAP distribution values for this specific applicant instance.
                </p>

                <div className="flex-1 space-y-2 mb-3 overflow-y-auto" style={{ maxHeight: "250px" }}>
                  {messages.length === 0 && (
                    <p className="font-body text-xs text-indigo-900 bg-indigo-50/40 rounded-lg p-3 border border-indigo-100/50 leading-relaxed transition-all hover:bg-indigo-50/70">
                      System conversational node is online. Query any attribution factor — e.g. <span className="italic underline decoration-indigo-300 cursor-help">"why did income matter less than credit score?"</span>
                    </p>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`rise text-sm px-3 py-2 rounded-xl max-w-[92%] font-body ${
                      m.role === "user"
                        ? "bg-white text-slate-800 ml-auto border border-slate-200/70 shadow-sm"
                        : "text-[13px] bg-slate-900 text-slate-50 leading-relaxed shadow-md border border-slate-800"
                    }`}>
                      {m.role === "agent" && <span className="text-indigo-400 font-semibold">System &gt; </span>}
                      {m.text}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={askQuestion} className="flex gap-2 mt-auto">
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Query system matrix..."
                    className="flex-1 font-body text-sm bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 focus:outline-none transition-all shadow-inner focus:ring-2 focus:ring-indigo-100"
                  />
                  <button type="submit" className="bg-indigo-600 text-white px-3 rounded-lg hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-200 active:scale-95 flex items-center justify-center">
                    <Send size={15} />
                  </button>
                </form>
              </div>
            </div>

            <div className="text-center font-body text-[11px] font-medium text-slate-400 pt-8">
              XGBoost classifier · SHAP TreeExplainer Matrix Layer
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}