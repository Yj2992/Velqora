"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { demoData } from "@/lib/demo";
import type { AppData, Experiment, Insight, Scan } from "@/lib/types";
import { referenceGuidance } from "@/lib/ai/guidance";
const empty: AppData = {
  scans: [],
  experiments: [],
  insights: [],
  profile: { display_name: "" },
  consent: false,
  llmConsent: false,
};
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers:
      init.body instanceof FormData
        ? init.headers
        : { "Content-Type": "application/json", ...init.headers },
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error("The server could not complete this request.");
  }
  if (!r.ok)
    throw new Error(
      data.error?.message || "Something went wrong. Please try again.",
    );
  return data;
}
type Context = {
  data: AppData;
  demo: boolean;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  createExperiment: (
    input: Omit<Experiment, "id" | "status" | "ended_at" | "created_at">,
  ) => Promise<string>;
  logUsage: (id: string, date: string, notes: string) => Promise<void>;
  setStatus: (id: string, status: Experiment["status"]) => Promise<void>;
  ask: (q: string, scanIds?: string[]) => Promise<void>;
  deleteScan: (id: string) => Promise<void>;
  saveProfile: (name: string, llm: boolean) => Promise<void>;
  clearData: () => Promise<void>;
  addDemoScan: () => string;
};
const Context = createContext<Context | null>(null);
export function AppProvider({
  children,
  demo,
}: {
  children: React.ReactNode;
  demo: boolean;
}) {
  const [data, setData] = useState<AppData>(empty),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const save = useCallback(
    (next: AppData) => {
      setData(next);
      if (demo) localStorage.setItem("dermalens-demo-v1", JSON.stringify(next));
    },
    [demo],
  );
  const refresh = useCallback(async () => {
    setError("");
    try {
      if (demo) {
        const saved = localStorage.getItem("dermalens-demo-v1");
        try {
          setData(saved ? JSON.parse(saved) : demoData());
        } catch {
          setData(demoData());
        }
      } else setData(await api<AppData>("/api/account"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function createExperiment(
    input: Omit<Experiment, "id" | "status" | "ended_at" | "created_at">,
  ) {
    if (demo) {
      const id = crypto.randomUUID();
      save({
        ...data,
        experiments: [
          {
            ...input,
            id,
            status: "active",
            ended_at: null,
            created_at: new Date().toISOString(),
            product_usage_logs: [],
          },
          ...data.experiments,
        ],
      });
      return id;
    }
    const e = await api<Experiment>("/api/experiments", {
      method: "POST",
      body: JSON.stringify(input),
    });
    await refresh();
    return e.id;
  }
  async function logUsage(id: string, date: string, notes: string) {
    if (demo) {
      save({
        ...data,
        experiments: data.experiments.map((e) =>
          e.id === id
            ? {
                ...e,
                product_usage_logs: [
                  ...(e.product_usage_logs || []).filter(
                    (l) => l.usage_date !== date,
                  ),
                  { id: crypto.randomUUID(), usage_date: date, notes },
                ],
              }
            : e,
        ),
      });
      return;
    }
    await api("/api/experiments/" + id + "/logs", {
      method: "POST",
      body: JSON.stringify({ usage_date: date, notes }),
    });
    await refresh();
  }
  async function setStatus(id: string, status: Experiment["status"]) {
    if (demo) {
      save({
        ...data,
        experiments: data.experiments.map((e) =>
          e.id === id
            ? {
                ...e,
                status,
                ended_at:
                  status === "completed"
                    ? new Date().toISOString().slice(0, 10)
                    : null,
              }
            : e,
        ),
      });
      return;
    }
    await api("/api/experiments/" + id, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await refresh();
  }
  async function ask(q: string, scanIds?: string[]) {
    if (demo) {
      save({
        ...data,
        insights: [
          ...data.insights,
          {
            id: crypto.randomUUID(),
            question: q,
            response: referenceGuidance(q,
              scanIds
                ? data.scans.filter((s) => scanIds.includes(s.id))
                : data.scans,
            ),
            source: "deterministic",
            created_at: new Date().toISOString(),
          },
        ],
      });
      return;
    }
    const i = await api<Insight>("/api/insights", {
      method: "POST",
      body: JSON.stringify({ question: q, scan_ids: scanIds }),
    });
    setData((d) => ({ ...d, insights: [...d.insights, i] }));
  }
  async function deleteScan(id: string) {
    if (demo) {
      save({
        ...data,
        scans: data.scans.filter((s) => s.id !== id),
        experiments: data.experiments.map((e) =>
          e.baseline_scan_id === id ? { ...e, baseline_scan_id: "" } : e,
        ),
      });
      return;
    }
    await api("/api/scans/" + id, { method: "DELETE" });
    await refresh();
  }
  async function saveProfile(name: string, llm: boolean) {
    if (demo) {
      save({ ...data, profile: { display_name: name }, llmConsent: llm });
      return;
    }
    await api("/api/account", {
      method: "PATCH",
      body: JSON.stringify({ display_name: name, llm_consent: llm }),
    });
    await refresh();
  }
  async function clearData() {
    if (demo) {
      save(empty);
      return;
    }
    await api("/api/account/data", { method: "DELETE" });
    await refresh();
  }
  function addDemoScan() {
    const scan: Scan = {
      ...demoData().scans.at(-1)!,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    save({ ...data, scans: [...data.scans, scan] });
    return scan.id;
  }
  return (
    <Context.Provider
      value={{
        data,
        demo,
        loading,
        error,
        refresh,
        createExperiment,
        logUsage,
        setStatus,
        ask,
        deleteScan,
        saveProfile,
        clearData,
        addDemoScan,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const c = useContext(Context);
  if (!c) throw new Error("App context missing");
  return c;
}
