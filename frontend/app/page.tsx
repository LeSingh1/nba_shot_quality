// Server Component (no "use client") — reads the inline JSON data tree at build
// time and passes it down as typed props to the client subtree.
// Per the frontend design doc: no client-side fetch, no runtime data wait.

import { getAppData } from "@/lib/data";
import { PageShell } from "@/components/PageShell";

export default function Page() {
  const data = getAppData();
  return <PageShell data={data} />;
}
