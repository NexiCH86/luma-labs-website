/*
 * Fortschritt und naechste Schritte der Startseiten-Roadmap live aus
 * Linear (NEX-132). Serverseitig mit LINEAR_API_KEY (nur Lesen),
 * stuendlich neu geladen. Ohne Schluessel oder bei Fehlern bleibt die
 * von Hand gepflegte Roadmap stehen.
 */

/*
 * Roadmap-Abschnitt -> Linear-Projekte bzw. -Meilensteine (UUIDs).
 */
/*
 * countProgress: false, wenn das Linear-Projekt nur grosse Epics enthaelt.
 * Dann kommen nur die naechsten Schritte aus Linear, der Fortschritt bleibt
 * von Hand gepflegt.
 */
const SOURCES: Record<string, { projects?: string[]; milestones?: string[]; countProgress?: false }> = {
  "roadmap-platform": { projects: ["1d760d64-bf8e-4bf2-875c-4a70bc07380a"] }, // 31 Website & Portal
  "roadmap-control": { projects: ["903061ea-d269-4647-9ebe-57e3aaec4383"], countProgress: false }, // 30 Control Center & OS
  "roadmap-air": { milestones: ["b4c6c0eb-a394-4798-85f5-ec7010c50295"] }, // 29 RADAR · AIR
  "roadmap-sat": { milestones: ["a3ce2d4e-82a7-450e-8b07-ba2b1ca92cfc"] }, // 29 RADAR · SAT
  "roadmap-sky": { milestones: ["e2f26c83-87c5-4457-a726-4b6b7fd5e117"] }, // 29 RADAR · SKY
  "roadmap-engineering": {
    projects: [
      "06e46518-6e0f-4197-8656-7d42ad77694f", // 28 LuMa Air
      "1f9efe59-25c4-47e2-8207-bb76ce69fcd9", // 25 LuMa h-x
      "b63b2d61-e9f8-4fa7-8931-c4b9790093ba", // 26 Coordinate – BIM Core
      "e811572b-8f7c-463a-b29c-542d41b11719", // 27 Coordinate – Coordination
    ],
  },
  "roadmap-knowledge": {
    projects: [
      "bcb38d2e-d702-44ab-8acf-5d574fe3cbe6", // 37 Documentation
      "a318ffd4-1eab-4b75-b7ed-40c0f41de8ce", // 34 Learning
      "6252943f-088c-4b10-8f6f-0af6bd145697", // 13 Monitoring & Operations
      "161edb99-1453-47e4-8c67-dd15f1370084", // 12 Storage & Backup
    ],
  },
};

type Issue = {
  title: string;
  priority: number;
  state: { type: string };
};

export type LinearProgress = {
  total: number;
  done: number;
  /** null, wenn der Abschnitt seinen Fortschritt nicht aus Linear zaehlt */
  progress: number | null;
  next: string[];
};

const ISSUE_FIELDS = "issues(first: 250) { nodes { title priority state { type } } }";

// Dringend (1) zuerst, "keine Prioritaet" (0) zuletzt.
const priorityRank = (priority: number) => (priority === 0 ? 5 : priority);

export async function loadLinearProgress(): Promise<Record<string, LinearProgress> | null> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    return null;
  }

  const fields: string[] = [];
  const aliasToSection: Record<string, string> = {};

  Object.entries(SOURCES).forEach(([section, source]) => {
    source.projects?.forEach((id) => {
      const alias = `s${fields.length}`;
      fields.push(`${alias}: project(id: "${id}") { ${ISSUE_FIELDS} }`);
      aliasToSection[alias] = section;
    });
    source.milestones?.forEach((id) => {
      const alias = `s${fields.length}`;
      fields.push(`${alias}: projectMilestone(id: "${id}") { ${ISSUE_FIELDS} }`);
      aliasToSection[alias] = section;
    });
  });

  try {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query: `{ ${fields.join("\n")} }` }),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`Linear ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: Record<string, { issues: { nodes: Issue[] } } | null>;
      errors?: { message: string }[];
    };

    if (!payload.data) {
      throw new Error(payload.errors?.[0]?.message ?? "No data");
    }

    const issuesBySection: Record<string, Issue[]> = {};

    for (const [alias, result] of Object.entries(payload.data)) {
      const section = aliasToSection[alias];
      if (section && result) {
        (issuesBySection[section] ??= []).push(...result.issues.nodes);
      }
    }

    const progress: Record<string, LinearProgress> = {};

    for (const [section, issues] of Object.entries(issuesBySection)) {
      const relevant = issues.filter((issue) => issue.state.type !== "canceled");

      // Ohne Aufgaben in Linear bleibt der von Hand gepflegte Stand.
      if (!relevant.length) {
        continue;
      }

      const done = relevant.filter((issue) => issue.state.type === "completed").length;
      const open = relevant
        .filter((issue) => issue.state.type !== "completed")
        // Begonnene Aufgaben zuerst, dann nach Prioritaet.
        .sort((a, b) =>
          Number(b.state.type === "started") - Number(a.state.type === "started") ||
          priorityRank(a.priority) - priorityRank(b.priority)
        );

      progress[section] = {
        total: relevant.length,
        done,
        progress:
          SOURCES[section].countProgress === false ? null : Math.round((done / relevant.length) * 100),
        next: open.slice(0, 4).map((issue) => issue.title),
      };
    }

    return progress;
  } catch (error) {
    console.error("Linear roadmap unavailable:", error);
    return null;
  }
}
