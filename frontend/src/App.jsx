import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, XCircle, Send, ChevronDown, ChevronUp,
  BookOpen, ShieldCheck, ArrowRight, TrendingUp, Sparkles, UserCheck
} from "lucide-react";
import Papa from "papaparse";
import RandomLetterSwap from "./RandomLetterSwap";
import UserCursor from "./UserCursor";
import Snowfall from "./Snowfall";

// Design system — "The Underwriting Ledger"
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

  .cursor-none-zone, .cursor-none-zone * { cursor: none !important; }

  @media (prefers-reduced-motion: reduce) {
    .blob-a, .blob-b, .rise, .pop, .animate-title { animation: none !important; }
  }
`;

// Backend endpoints — swap for real URLs or wire up VITE_* env vars
const API_BASE = "http://localhost:8000";
const PREDICT_API = `${API_BASE}/predict`;
const ASK_API = `${API_BASE}/ask`;
const DICE_API = `${API_BASE}/api/dice`;
const EXPLAIN_API = `${API_BASE}/explain`;

// Amounts in INR (₹), loan amount capped at 8 Lakhs
const FIELD_META = [
  { key: "person_age", label: "Age", type: "number", min: 18, max: 100 },
  { key: "person_gender", label: "Gender", type: "select", options: ["male", "female"] },
  { key: "person_education", label: "Education", type: "select", options: ["High School", "Associate", "Bachelor", "Master", "Doctorate"] },
  { key: "person_income", label: "Annual income (₹)", type: "number", min: 0 }, // no max — unbounded
  { key: "person_emp_exp", label: "Employment experience (yrs)", type: "number", min: 0, max: 60 },
  { key: "person_home_ownership", label: "Home ownership", type: "select", options: ["RENT", "OWN", "MORTGAGE", "OTHER"] },
  { key: "loan_amnt", label: "Loan amount (₹)", type: "number", min: 5000, max: 800000 },
  { key: "loan_intent", label: "Loan purpose", type: "select", options: ["EDUCATION", "MEDICAL", "PERSONAL", "VENTURE", "HOMEIMPROVEMENT", "DEBTCONSOLIDATION"] },
  { key: "loan_int_rate", label: "Interest rate (%)", type: "number", min: 1, max: 35, step: 0.1 },
  // loan_percent_income omitted — auto-derived and read-only (see useEffect below)
  { key: "cb_person_cred_hist_length", label: "Credit history length (yrs)", type: "number", min: 0, max: 50 },
  { key: "credit_score", label: "Credit score", type: "number", min: 300, max: 850 },
  { key: "previous_loan_defaults_on_file", label: "Prior default on file", type: "select", options: ["No", "Yes"] },
];

const FEATURE_LABELS = {
  credit_score: "Credit score",
  loan_percent_income: "Loan / income ratio",
  person_income: "Annual income",
  cb_person_default_on_file: "Prior default on file",
  previous_loan_defaults_on_file: "Prior default on file",
  cb_person_cred_hist_length: "Credit history length",
  loan_int_rate: "Interest rate",
  person_emp_length: "Employment length",
  person_emp_exp: "Employment experience",
  person_age: "Age",
  person_gender: "Gender",
  person_education: "Education",
  loan_amnt: "Loan amount",
  person_home_ownership: "Home ownership",
  loan_intent: "Loan purpose",
};

const INITIAL_FALLBACK_DATA = {
  person_age: 29, person_gender: "female", person_education: "Bachelor",
  person_income: 350000, person_home_ownership: "RENT",
  person_emp_exp: 3, loan_intent: "EDUCATION", loan_amnt: 80000,
  loan_int_rate: 11.5, loan_percent_income: 0.23, previous_loan_defaults_on_file: "No",
  cb_person_cred_hist_length: 4, credit_score: 645
};

// Confidence: how far the probability sits from 50/50 (not the same as risk)
function confidenceFromProbability(risk_probability) {
  const distanceFromMid = Math.abs(0.5 - risk_probability);
  return distanceFromMid > 0.25 ? "high" : distanceFromMid > 0.1 ? "medium" : "low";
}

// Risk level, independent of confidence
function riskLevelFromProbability(risk_probability) {
  return risk_probability < 0.33 ? "low" : risk_probability < 0.66 ? "medium" : "high";
}

function runMockAssessment(a) {
  if (!a || Object.keys(a).length === 0) return null;
  const contributions = [
    { feature: "credit_score", impact: ((a.credit_score - 620) / 230) * 0.34, value: a.credit_score },
    { feature: "loan_percent_income", impact: -(a.loan_percent_income - 0.25) * 0.9, value: a.loan_percent_income },
    { feature: "person_income", impact: (Math.min(a.person_income, 500000) / 500000 - 0.4) * 0.22, value: a.person_income },
    { feature: "previous_loan_defaults_on_file", impact: a.previous_loan_defaults_on_file === "Yes" ? -0.22 : 0.05, value: a.previous_loan_defaults_on_file },
    { feature: "cb_person_cred_hist_length", impact: (Math.min(a.cb_person_cred_hist_length, 15) / 15) * 0.13 - 0.03, value: a.cb_person_cred_hist_length },
    { feature: "loan_int_rate", impact: -((a.loan_int_rate - 10) / 15) * 0.12, value: a.loan_int_rate },
    { feature: "person_emp_exp", impact: (Math.min(a.person_emp_exp, 10) / 10) * 0.09 - 0.02, value: a.person_emp_exp },
  ];
  const score = contributions.reduce((sum, c) => sum + c.impact, 0);
  const riskProbability = 1 / (1 + Math.exp(score * 4));
  const verdict = riskProbability < 0.45 ? "APPROVED" : "REJECTED";
  const confidence = confidenceFromProbability(riskProbability);
  const risk_level = riskLevelFromProbability(riskProbability);

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
    prediction: { verdict, risk_probability: Number(riskProbability.toFixed(2)), confidence, risk_level },
    shap_values,
    explanation: { summary, top_factors: shap_values.slice(0, 3).map((s) => s.feature) },
  };
}

function mockAnswerFollowup(question, result) {
  if (!result) return "System parsing active. Please select an applicant row execution profile first.";
  const q = question.toLowerCase();
  const hit = result.shap_values.find((s) => q.includes(s.feature.split("_")[0]) || q.includes(FEATURE_LABELS[s.feature].toLowerCase().split(" ")[0]));
  if (hit) {
    const dir = hit.direction === "positive" ? "toward approval" : "toward decline";
    return `${FEATURE_LABELS[hit.feature]} contributed ${Math.abs(hit.impact).toFixed(2)} ${dir}, based on a value of ${hit.value}. That places it ${result.shap_values.indexOf(hit) === 0 ? "as the single largest factor" : `#${result.shap_values.indexOf(hit) + 1} by size`} in this decision.`;
  }
  const top = result.shap_values[0];
  return `I don't have a specific factor matching that in this decision. The largest driver here was ${FEATURE_LABELS[top.feature].toLowerCase()}, contributing ${top.impact >= 0 ? "+" : ""}${top.impact.toFixed(2)} toward the outcome.`;
}

// Converts the backend's raw response shape into the shape the UI expects
// Client-side safety net in case the LLM explanation defaults to "$"
function toINR(text) {
  if (!text) return text;
  return text.replace(/\$\s?([\d,]+(\.\d+)?)/g, "₹$1");
}

function normalizeBackendResponse(raw, explanationText) {
  const verdict = raw.approval_label.toUpperCase();
  // `probability` is always probability of approval; risk is its complement
  const risk_probability = Number((1 - raw.probability).toFixed(2));

  const shap_values = [
    ...raw.positive_factors.map((f) => ({ feature: f.feature, value: f.feature_value, impact: Math.abs(f.impact), direction: "positive" })),
    ...raw.negative_factors.map((f) => ({ feature: f.feature, value: f.feature_value, impact: -Math.abs(f.impact), direction: "negative" })),
  ]
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 6);

  const top = shap_values.slice(0, 2).map((s) => FEATURE_LABELS[s.feature] || s.feature);
  const fallbackSummary = verdict === "APPROVED"
    ? `Approved, driven mainly by ${(top[0] || "").toLowerCase()} and ${(top[1] || "").toLowerCase()}.`
    : `Declined, driven mainly by ${(top[0] || "").toLowerCase()} and ${(top[1] || "").toLowerCase()}.`;

  return {
    prediction: {
      verdict,
      risk_probability,
      confidence: confidenceFromProbability(risk_probability),
      risk_level: raw.risk_level || riskLevelFromProbability(risk_probability),
    },
    shap_values,
    explanation: {
      summary: explanationText && explanationText.trim() ? toINR(explanationText) : fallbackSummary,
      top_factors: shap_values.slice(0, 3).map((s) => s.feature),
    },
  };
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
  if (!shapValues) return null;
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
                    <span className="font-body text-[11px] font-semibold text-black whitespace-nowrap">{s.impact.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-start h-full">
                {isPos && (
                  <div
                    className="h-full bg-emerald-700 rounded-r flex items-center justify-end pr-2 transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  >
                    <span className="font-body text-[11px] font-semibold text-black whitespace-nowrap">+{s.impact.toFixed(2)}</span>
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
  const [applicants, setApplicants] = useState([]);
  const [applicant, setApplicant] = useState(INITIAL_FALLBACK_DATA);
  const [selectedSample, setSelectedSample] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [result, setResult] = useState(() => runMockAssessment(INITIAL_FALLBACK_DATA));
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");

  // DiCE counterfactual state
  const [diceScenarios, setDiceScenarios] = useState([]);
  const [generatingDice, setGeneratingDice] = useState(false);
  const [diceStatus, setDiceStatus] = useState("idle"); // idle | empty | errored | failed_request

  const chatEndRef = useRef(null);
  const animatedRisk = useCountUp(result ? result.prediction.risk_probability * 100 : 0);

  useEffect(() => {
    if (messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Recompute loan/income ratio whenever income or loan amount changes
  useEffect(() => {
    const income = Number(applicant.person_income) || 0;
    const loan = Number(applicant.loan_amnt) || 0;
    const ratio = income > 0 ? Number((loan / income).toFixed(4)) : 0;
    if (applicant.loan_percent_income !== ratio) {
      setApplicant((prev) => ({ ...prev, loan_percent_income: ratio }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant.person_income, applicant.loan_amnt]);

  // Load demo applicants from CSV, clamping values over 8 Lakhs
  useEffect(() => {
    Papa.parse("/demo.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) return;

        const parsedRows = results.data.map((row, index) => {
          const incomeVal = Math.min(800000, row.person_income ?? 300000);
          const loanVal = Math.min(800000, row.loan_amnt ?? 50000);
          const calculatedRatio = incomeVal > 0 ? parseFloat((loanVal / incomeVal).toFixed(2)) : 0;

          return {
            label: `Applicant ${index + 1}`,
            data: {
              person_age: row.person_age ?? 30,
              person_gender: row.person_gender || "female",
              person_education: row.person_education || "Bachelor",
              person_income: incomeVal,
              person_home_ownership: row.person_home_ownership || "RENT",
              person_emp_exp: row.person_emp_exp ?? row.person_emp_length ?? 2,
              loan_intent: row.loan_intent || "PERSONAL",
              loan_amnt: loanVal,
              loan_int_rate: row.loan_int_rate ?? row.loan_int_r ?? 12.0,
              loan_percent_income: row.loan_percent_income ?? row.loan_perce ?? calculatedRatio,
              previous_loan_defaults_on_file: row.previous_loan_defaults_on_file || row.cb_person || "No",
              cb_person_cred_hist_length: row.cb_person_cred_hist_length ?? 4,
              credit_score: row.credit_sco ?? row.credit_score ?? 650,
            }
          };
        });

        setApplicants(parsedRows);
        setSelectedSample(0);
        setApplicant(parsedRows[0].data);
        runAssessment(parsedRows[0].data); // real /predict + /explain call, not the mock
      },
      error: (err) => {
        console.warn("CSV ingestion matrix warning context:", err);
      }
    });
  }, []);

  function handleDropdownChange(e) {
    const index = parseInt(e.target.value, 10);
    setSelectedSample(index);
    const data = applicants[index].data;
    setApplicant(data);
    setMessages([]);
    setDiceScenarios([]);
    runAssessment(data); // real /predict + /explain call, not the mock
  }

  function updateField(key, value, meta) {
    // Don't clamp mid-keystroke; clamp on blur instead (see clampField)
    setApplicant((prev) => ({ ...prev, [key]: value }));
    setSelectedSample("");
    setDiceScenarios([]);
  }

  function clampField(key, meta) {
    if (meta.type !== "number") return;
    setApplicant((prev) => {
      const raw = prev[key];
      if (raw === "" || raw === undefined || raw === null) return prev;
      const num = Number(raw);
      if (Number.isNaN(num)) return prev;
      const upper = meta.max != null ? meta.max : Infinity;
      const clamped = Math.min(upper, Math.max(meta.min, num));
      return { ...prev, [key]: clamped };
    });
  }

  async function runAssessment(applicantOverride) {
    const dataToSend = applicantOverride || applicant;
    setLoading(true);
    setMessages([]);
    setDiceScenarios([]);
    try {
      const predictRes = await fetch(PREDICT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      if (!predictRes.ok) throw new Error(`Predict error: ${predictRes.status}`);
      const rawPrediction = await predictRes.json();

      let explanationText = "";
      try {
        const explainRes = await fetch(EXPLAIN_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prediction: rawPrediction }),
        });
        if (explainRes.ok) {
          const explainData = await explainRes.json();
          explanationText = explainData.explanation || "";
        }
      } catch (explainErr) {
        console.warn("Explain call failed, falling back to auto-generated summary:", explainErr);
      }

      setResult(normalizeBackendResponse(rawPrediction, explanationText));
    } catch (err) {
      console.error("Prediction failed, using fallback mock:", err);
      setResult(runMockAssessment(dataToSend));
    } finally {
      setLoading(false);
    }
  }

  async function askQuestion(e) {
    e.preventDefault();
    if (!question.trim()) return;
    const q = question.trim();
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");

    try {
      const res = await fetch(ASK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          context: result,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setMessages((m) => [...m, { role: "agent", text: data.answer }]);
    } catch (err) {
      console.error("Follow-up failed, using fallback mock:", err);
      setMessages((m) => [...m, { role: "agent", text: mockAnswerFollowup(q, result) }]);
    }
  }

  async function triggerCounterfactualAnalysis() {
    setGeneratingDice(true);
    try {
      const res = await fetch(DICE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_applicant: applicant }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const scenarios = data.scenarios || [];
      setDiceScenarios(scenarios);
      if (scenarios.length > 0) {
        setDiceStatus("idle");
      } else if (data.errors > 0) {
        setDiceStatus("errored"); // candidates threw server-side
      } else {
        setDiceStatus("empty"); // ran fine, none flipped the verdict
      }
    } catch (err) {
      console.error("DiCE generation failed:", err);
      setDiceScenarios([]);
      setDiceStatus("failed_request");
    } finally {
      setGeneratingDice(false);
    }
  }

  const verdict = result ? result.prediction.verdict : "PENDING";
  const isApproved = verdict === "APPROVED";

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-50 font-body text-slate-900">
      <style>{FONT_IMPORT}</style>

      {/* Decorative ambient background assets */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="blob-a absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="blob-b absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <div 
        className="flex w-[200vw] h-screen items-stretch transition-transform duration-700 ease-in-out z-10 relative"
        style={{ transform: viewMode === "landing" ? "translateX(0)" : "translateX(-100vw)" }}
      >
        
        {/* Landing portal page */}
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

              <p className="font-body text-sm md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-5 select-none rise" style={{ animationDelay: '100ms' }}>
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

              <div className="grid sm:grid-cols-2 gap-4 mt-6 text-left max-w-2xl w-full select-none rise" style={{ animationDelay: '300ms' }}>
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

        {/* Analytical dashboard page */}
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

            <div className="grid md:grid-cols-3 gap-6 items-start">

              {/* COLUMN 1 — APPLICANT */}
              <div className="glass rounded-2xl p-4 shadow-lg shadow-slate-200/50">
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck size={18} className="text-slate-700" />
                  <h2 className="font-display text-lg italic text-slate-800">Applicant</h2>
                </div>

                <div className="font-body text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Select From Ingested Matrix File
                </div>
                
                <div className="relative mb-4">
                  <select
                    value={selectedSample}
                    onChange={handleDropdownChange}
                    className="w-full font-body text-xs bg-white/80 border border-slate-200 rounded-xl px-3 py-3 pr-10 appearance-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100/50 shadow-sm transition-all cursor-pointer text-slate-700 font-medium"
                  >
                    {applicants.length === 0 ? (
                      <option value="" disabled>Awaiting matrix parser loading pass...</option>
                    ) : (
                      <>
                        <option value="" disabled>-- Select Candidate Core Row --</option>
                        {applicants.map((s, i) => (
                          <option key={i} value={i}>
                            {s.label}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <ChevronDown size={16} />
                  </div>
                </div>

                <button
                  onClick={() => setFormOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-body font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  {formOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {formOpen ? "Hide Structural Values" : "Modify Parameters Manually"}
                </button>

                {formOpen && (
                  <div className="mt-3 pt-3 border-t border-slate-200/70 space-y-3 pop">
                    {FIELD_META.map((f) => (
                      <div key={f.key} className="flex items-center justify-between gap-3">
                        <div className="flex flex-col w-1/2">
                          <label className="font-body text-xs text-slate-700">{f.label}</label>
                          {f.type === "number" && (
                            <span className="text-[10px] text-slate-400 font-body">
                              {f.max != null ? `Limit: ${f.min} - ${f.key === "loan_amnt" ? "8 Lakh" : f.max}` : `Min: ${f.min} · no upper limit`}
                            </span>
                          )}
                        </div>
                        {f.type === "select" ? (
                          <select
                            className="font-body text-sm bg-white/70 border border-slate-200 rounded px-2 py-1 w-1/2 focus:outline-none focus:border-indigo-400"
                            value={applicant[f.key] || ""}
                            onChange={(e) => updateField(f.key, e.target.value, f)}
                          >
                            {f.options.map((o) => (<option key={o} value={o}>{o}</option>))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            min={f.min}
                            max={f.max != null ? f.max : undefined}
                            step={f.step || 1}
                            className="font-body text-sm bg-white/70 border border-slate-200 rounded px-2 py-1 w-1/2 focus:outline-none focus:border-indigo-400 font-semibold text-slate-800"
                            value={applicant[f.key] ?? ""}
                            onChange={(e) => updateField(f.key, e.target.value, f)}
                            onBlur={() => clampField(f.key, f)}
                          />
                        )}
                      </div>
                    ))}

                    {/* Read-only, derived from loan amount / income */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col w-1/2">
                        <label className="font-body text-xs text-slate-700">Loan / income ratio</label>
                        <span className="text-[10px] text-slate-400 font-body">Auto-calculated</span>
                      </div>
                      <div className="font-body text-sm bg-slate-100 border border-slate-200 rounded px-2 py-1 w-1/2 text-slate-500">
                        {(applicant.loan_percent_income ?? 0).toFixed(2)}
                      </div>
                    </div>
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
                <div className="glass rounded-2xl p-5 pop shadow-lg shadow-slate-200/50" key={verdict + (result ? result.prediction.risk_probability : 0)}>
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
                      <div className="font-body text-xs text-slate-500 mt-1">
                        estimated risk · {result ? result.prediction.confidence : "low"} confidence
                      </div>
                    </div>
                  </div>
                  <p className="font-body text-sm text-slate-700 border-t border-slate-200/70 pt-3">
                    {result ? result.explanation.summary : "No matrix data loaded currently."}
                  </p>
                </div>

                <div className="glass rounded-2xl p-5 shadow-lg shadow-slate-200/50">
                  <h3 className="font-display text-base italic text-slate-800 mb-4">Reasons — what tipped the scale</h3>
                  <BalanceBeam shapValues={result ? result.shap_values : []} />
                </div>
              </div>

              {/* COLUMN 3 — TERMINAL LOGIC INTERFACE */}
              <div className="glass rounded-2xl p-5 shadow-lg flex flex-col border border-indigo-100/40 bg-white/80 min-h-[420px]">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 relative">
                      <Sparkles size={16} className="text-white relative z-10" />
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

                <div className="flex-1 space-y-2 mb-3 overflow-y-auto" style={{ maxHeight: "420px" }}>
                  {messages.map((m, i) => (
                    <div key={i} className={`rise text-sm px-3 py-2 rounded-xl max-w-[92%] font-body ${
                      m.role === "user"
                        ? "bg-white text-slate-800 ml-auto border border-slate-200/70 shadow-sm"
                        : "text-[13px] bg-slate-900 text-slate-50 leading-relaxed shadow-md border border-slate-800"
                    }`}>
                      {m.role === "agent" && <span className="text-indigo-400 font-semibold">AI Ledger &gt; </span>}
                      {m.text}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={askQuestion} className="flex gap-2 mt-2">
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

                {/* DICE COUNTERFACTUAL PANEL — lives inside column 3, below the chat */}
                {verdict === "REJECTED" && (
                  <div className="mt-4 pt-4 border-t border-slate-200/70 rise">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-indigo-600" />
                        <h3 className="font-display text-sm italic text-slate-800">DiCE Counterfactual Paths</h3>
                      </div>
                      <button
                        onClick={triggerCounterfactualAnalysis}
                        disabled={generatingDice}
                        className="text-[10px] font-body bg-indigo-600 text-white px-2 py-1 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {generatingDice ? "Optimizing..." : "Generate Alternatives"}
                      </button>
                    </div>

                    <p className="font-body text-[11px] text-slate-500 mb-3 leading-relaxed">
                      Minimal attribute shifts that would pivot this verdict to an Approval.
                    </p>

                    {(diceScenarios.length > 0 || generatingDice) && (
                      <div className="flex items-center gap-1.5 mb-3 text-[10px] font-body text-slate-500">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 inline-block shrink-0" />
                        <span>Highlighted fields are the only ones changed from your original applicant — everything else stayed the same.</span>
                      </div>
                    )}

                    {generatingDice ? (
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 h-20" />
                        ))}
                      </div>
                    ) : diceScenarios.length > 0 ? (
                      <div className="space-y-2">
                        {diceScenarios.map((scenario, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-[11px] font-body pop">
                            <div className="font-semibold text-indigo-700 mb-1">Pathway #{idx + 1}</div>
                            <div className="space-y-0.5 text-slate-600">
                              {Object.keys(scenario).map((key) => {
                                const isChanged = scenario[key] !== applicant[key];
                                if (!FEATURE_LABELS[key]) return null;
                                return (
                                  <div key={key} className={`flex justify-between py-0.5 ${isChanged ? "bg-amber-50 font-medium text-amber-900 px-1 rounded" : ""}`}>
                                    <span>{FEATURE_LABELS[key]}:</span>
                                    <span>
                                      {(key === "person_income" || key === "loan_amnt")
                                        ? `₹${Number(scenario[key]).toLocaleString("en-IN")}`
                                        : scenario[key]}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center font-body text-[11px] text-slate-400 py-3 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        {diceStatus === "errored"
                          ? "Every candidate errored server-side — check the backend console for [dice] logs."
                          : diceStatus === "failed_request"
                          ? "Couldn't reach the DiCE endpoint — is the backend running?"
                          : diceStatus === "empty"
                          ? "No nudge in this set flipped the verdict to Approved."
                          : "Awaiting alternative optimization..."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}