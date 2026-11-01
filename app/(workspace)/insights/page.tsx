"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Sparkles, ArrowUp, ArrowUpRight, ScanFace, MessageSquare, History, Search, ShieldCheck, FlaskConical, ShoppingBag, TrendingUp, Copy, Check, BookOpen, ChevronRight } from "lucide-react";
import { skinReferences } from "@/lib/ai/guidance";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, date, score } from "@/components/shared";

const topics = [
  { label: "Understand my scans", icon: ScanFace, description: "Put your recorded changes in context.", questions: ["What changed since my last scan?", "Explain my skin texture trend without assuming a cause."] },
  { label: "Build a simple routine", icon: Sparkles, description: "Start with a few considered essentials.", questions: ["What should a simple acne-prone routine include?", "How can I care for dry skin?"] },
  { label: "Know your ingredients", icon: BookOpen, description: "Understand purpose, limits and suitability.", questions: ["What should I consider before adding a new skincare ingredient?", "Can topical skincare improve tear troughs?"] },
  { label: "Reflect on my routine", icon: FlaskConical, description: "Explore habits without assuming results.", questions: ["Summarize my skincare experiment.", "How can I track a routine change fairly?"] },
];

function Answer({ text }: { text: string }) {
  // Render plain text and a small Markdown subset without accepting HTML or model URLs.
  const inline = (value: string) => value.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
  return <div className="ia-answer-text">{text.split(/\n\s*\n/).map((block, i) => <div key={i}>{block.split("\n").map((line, j) => /^#{1,4}\s/.test(line) ? <h3 key={j}>{inline(line.replace(/^#{1,4}\s+/, ""))}</h3> : <p key={j}>{inline(line)}</p>)}</div>)}</div>;
}

export default function Insights() {
  const { data, ask, demo } = useApp();
  const [question, setQuestion] = useState(""), [pending, setPending] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [scanIds, setScanIds] = useState<string[] | undefined>();
  const [view, setView] = useState<"chat" | "history">("chat"), [topic, setTopic] = useState(0), [search, setSearch] = useState(""), [selected, setSelected] = useState<string | null>(null), [copied, setCopied] = useState("");
  const thread = useRef<HTMLDivElement>(null), composer = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("a") && q.get("b")) setScanIds([q.get("a")!, q.get("b")!]);
  }, []);
  useEffect(() => {
    if (view === "chat" && thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [data.insights.length, busy, selected, view]);
  const completed = data.scans.filter(s => s.status === "completed").sort((a,b) => a.created_at.localeCompare(b.created_at));
  const latest = completed.at(-1);
  const active = data.experiments.filter(e => e.status === "active");
  const answers = selected ? data.insights.filter(i => i.id === selected) : data.insights.slice(-6);
  const history = [...data.insights].reverse().filter(i => (i.question + " " + i.response).toLowerCase().includes(search.toLowerCase()));
  function prepare(q: string) { setQuestion(q); setView("chat"); setSelected(null); requestAnimationFrame(() => composer.current?.focus()); }
  async function send() {
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setError(""); setBusy(true); setPending(q); setSelected(null); setView("chat");
    try { await ask(q, scanIds); setQuestion(""); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); setPending(""); }
  }
  async function copy(id: string, response: string) {
    try { await navigator.clipboard.writeText(response); setCopied(id); }
    catch { setError("Copy is unavailable in this browser. You can select the answer text to copy it."); }
  }
  return <div className="insights-studio">
    <PageHeader eyebrow="YOUR SKIN, BETTER UNDERSTOOD" title="A little clarity. A thoughtful next step." description="A space to ask, understand and reflect. Explore everyday skincare with your recorded history close at hand." action={<Link href="/settings#ai-sharing" className="ia-privacy-link"><ShieldCheck size={16} /> AI sharing {data.llmConsent && !demo ? "on" : "off"}<ChevronRight size={15} /></Link>} />
    <div className="ia-status-strip"><span><i />{demo ? "Reference mode · synthetic demo" : data.llmConsent ? "External AI sharing enabled · provider availability may vary" : "Reference mode · external AI sharing off"}</span><span>Photos stay out of chat <ShieldCheck size={13}/></span></div>
    {scanIds && <div className="notice">Questions use the two scans selected in your comparison. <Link href="/progress/compare">Review comparison →</Link></div>}
    {!demo && !data.llmConsent && <div className="ia-consent-banner"><div><strong>Ready for a more personal explanation?</strong><p>Enable sharing to let the configured model use relevant measurements and routine notes. Until then, you can explore reference guidance.</p></div><Link href="/settings#ai-sharing" className="text-link">Manage AI sharing <ArrowUpRight size={16}/></Link></div>}
    <div className="ia-main-grid">
      <section className="ia-conversation card" aria-label="Skincare assistant">
        <header className="ia-chat-heading"><div className="ia-assistant-title"><span className="ia-avatar"><Sparkles size={20}/></span><div><h2>Your skincare companion</h2><p>General guidance. A little perspective.</p></div></div><div className="ia-view-tabs" role="tablist" aria-label="Insights views"><button role="tab" aria-selected={view === "chat"} onClick={() => setView("chat")}><MessageSquare size={15}/> Ask</button><button role="tab" aria-selected={view === "history"} onClick={() => setView("history")}><History size={15}/> History <span>{data.insights.length}</span></button></div></header>
        {view === "history" ? <div className="ia-history" role="tabpanel" aria-label="Saved insights"><label className="ia-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your saved questions" aria-label="Search saved insights"/></label><p className="subtle">Your saved questions and answers. Each answer uses the context available when you asked.</p><div className="ia-history-list">{history.length ? history.map(i=><button key={i.id} onClick={()=>{setSelected(i.id);setView("chat");}}><span className="ia-history-icon"><MessageSquare size={17}/></span><span><strong>{i.question}</strong><small>{date(i.created_at)} · {i.source === "llm" ? "AI explanation" : "Reference guidance"}</small></span><ChevronRight size={16}/></button>) : <div className="ia-empty"><History size={25}/><h3>{search ? "No questions found." : "Your insights will live here."}</h3><p>{search ? "Try another word or clear your search." : "Ask your first question to start a useful record."}</p></div>}</div></div> : <>
          <div className="ia-thread" ref={thread} role="tabpanel" aria-label="Questions and answers" aria-busy={busy} tabIndex={0}>
            <div className="ia-welcome"><span className="section-label">LET’S MAKE SENSE OF IT</span><h3>What’s on your mind today?</h3><p>Ask about a skin concern, a routine decision or a change in your scans. Share only what you’re comfortable sharing.</p></div>
            {selected && <button className="ia-back" onClick={()=>setSelected(null)}>← Return to recent answers</button>}
            {!selected && data.insights.length > 6 && <button className="ia-back" onClick={()=>setView("history")}>View all {data.insights.length} saved questions →</button>}
            {!answers.length && <div className="ia-empty-prompt"><Sparkles size={26}/><p>A good question is a good starting point.</p><small>Choose an idea below, or write your own.</small></div>}
            {answers.map(i=><article className="ia-message" key={i.id}><div className="ia-user-message">{i.question}</div><div className="ia-assistant-message"><span className="ia-avatar"><Sparkles size={16}/></span><div className="ia-answer-body"><div className="ia-answer-meta"><span>{i.source === "llm" ? "AI EXPLANATION" : "REFERENCE GUIDANCE · NO MODEL USED"}</span><time dateTime={i.created_at}>{date(i.created_at)}</time></div><Answer text={i.response}/><button className="ia-copy" onClick={()=>void copy(i.id,i.response)} aria-label={copied === i.id ? "Answer copied" : "Copy answer"}>{copied === i.id ? <Check size={13}/> : <Copy size={13}/>} {copied === i.id ? "Copied" : "Copy answer"}</button></div></div></article>)}
            {busy && <div className="ia-message"><div className="ia-user-message">{pending}</div><div className="ia-thinking" role="status"><span className="loader small-loader"/>Considering your question…</div></div>}
          </div>
          <div className="ia-composer-area">{error && <div className="error" role="alert">{error}</div>}<form onSubmit={e=>{e.preventDefault();void send();}}><textarea ref={composer} value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing){e.preventDefault();void send();}}} placeholder="Tell me what you’d like to understand…" aria-label="Ask a skincare question" minLength={3} maxLength={1000} rows={2} required/><div className="ia-composer-bottom"><span>{question.length}/1000 · Shift + Enter for a new line</span><Button disabled={busy || question.trim().length < 3} aria-label="Send question">Send <ArrowUp size={16}/></Button></div></form><p>{demo ? "Demo answers use references and synthetic data; no AI model is called." : "AI can make mistakes. This is cosmetic guidance, not diagnosis or treatment."}</p></div>
        </>}
      </section>
      <aside className="ia-sidebar">
        <section className="card ia-baseline"><div className="ia-section-heading"><span className="section-label">YOUR STARTING POINT</span><ScanFace size={20}/></div><h2>{latest ? "Your latest snapshot." : "Start with a little context."}</h2>{latest ? <><div className="ia-baseline-score"><strong>{score(latest.overall_score)}</strong><span>/ 100<br/>overall UI score</span></div><p>{date(latest.created_at)} · {demo ? "Synthetic sample" : latest.provider_version}</p><div className="ia-skin-types">{latest.skin_type_results.filter(t=>t.region === "whole").map((t,i)=><span key={i}>{t.skin_type} · whole face</span>)}</div><Link className="text-link" href={"/scan/"+latest.id}>View scan details <ArrowUpRight size={15}/></Link></> : <><p>A scan adds recorded measurements. You can still ask general skincare questions without one.</p><Link href="/scan" className="text-link">Create a baseline <ArrowUpRight size={15}/></Link></>}<div className="ia-context-stats"><div><strong>{completed.length}</strong><span>completed scans</span></div><div><strong>{active.length}</strong><span>active experiments</span></div></div><p className="subtle">{demo ? "These are synthetic examples, not a personal skin assessment." : scanIds ? "Two selected scans are used for comparison questions." : "When enabled, the model receives up to three recent scans and a bounded routine summary."} Photo conditions affect measurements.</p></section>
        <section className="card ia-routine"><span className="section-label">IN YOUR ROUTINE</span><h2>{active.length ? "Keep a considered record." : "Give your routine a story."}</h2>{active.slice(0,2).map(e=><Link key={e.id} href={"/experiments/"+e.id} className="ia-routine-item"><FlaskConical size={17}/><span><strong>{e.product_name || e.title}</strong><small>Tracking since {date(e.started_at)}</small></span><ChevronRight size={14}/></Link>)}{!active.length && <p>Record a product and your usage before reflecting on future scans.</p>}<Link className="text-link" href="/experiments">Open experiment lab <ArrowUpRight size={15}/></Link><p className="subtle">Routine associations do not prove a product caused a change.</p></section>
      </aside>
    </div>
    <section className="ia-explore" aria-labelledby="ia-explore-heading"><div className="ia-section-heading"><div><span className="section-label">A PLACE TO BEGIN</span><h2 id="ia-explore-heading">Good questions. More useful answers.</h2></div><p>Choose a topic, then make the question yours.</p></div><div className="ia-topic-tabs" role="tablist" aria-label="Question topics">{topics.map((t,i)=><button key={t.label} role="tab" aria-selected={topic === i} onClick={()=>setTopic(i)}><t.icon size={17}/>{t.label}</button>)}</div><div className="ia-question-grid" role="tabpanel" aria-label={topics[topic].label}>{topics[topic].questions.map((q,i)=><button key={q} disabled={busy} onClick={()=>prepare(q)}><span>0{i+1}</span><h3>{q}</h3><p>{topics[topic].description}</p><span className="ia-question-action">Ask this question <ArrowUpRight size={17}/></span></button>)}</div></section>
    <section className="ia-next-section"><div><span className="section-label">FROM UNDERSTANDING TO ACTION</span><h2>A thoughtful next step.</h2><p>Use what you learn to browse, record and reflect.</p></div><div className="ia-next-grid">{[{href:"/products",icon:ShoppingBag,title:"Consider your shelf",text:"Browse verified products with fixed-rule matches. No generated product claims."},{href:"/experiments",icon:FlaskConical,title:"Track what you use",text:"Keep a record of a product, your routine and how your skin feels."},{href:"/progress",icon:TrendingUp,title:"Look at the longer view",text:"Compare recorded scans with consistent capture conditions."}].map(a=><Link href={a.href} key={a.href}><a.icon size={21}/><h3>{a.title}</h3><p>{a.text}</p><ArrowUpRight size={17}/></Link>)}</div></section>
    <section className="ia-reference-section"><div><BookOpen size={22}/><h2>A little reading, from trusted sources.</h2><p>These references support general guidance; they are not a medical assessment of your skin.</p></div><div>{skinReferences.map(r=><a href={r.url} key={r.url} target="_blank" rel="noopener noreferrer">{r.title}<ArrowUpRight size={15}/></a>)}</div></section>
  </div>;
}
