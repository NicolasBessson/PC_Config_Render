"use client";

import { Suspense, useMemo } from "react";
import { BuildActions } from "@/components/BuildActions";
import { BudgetBreakdown, CompatPanel, ComponentList, FpsByResolution, PerfPanel, PowerPanel, PriceTotal } from "@/components/BuildPanels";
import { Card, CardTitle, DemoNotice, LinkButton, PageShell, StatusBadge } from "@/components/ui";
import { useViewState } from "@/components/useViewState";
import { LightingPicker, StylePicker, Viewer } from "@/components/viewer/Viewer";
import { resolveBuild } from "@/lib/build";
import { checkBuild } from "@/lib/compat";

function Config() {
  const { state, update, setStyle, query } = useViewState();
  const build = useMemo(() => resolveBuild(state.ids), [state.ids]);
  const report = useMemo(() => checkBuild(build), [build]);
  const empty = Object.keys(state.ids).length === 0;

  if (empty) {
    return (
      <PageShell title="Fiche de configuration">
        <Card>
          <p className="text-sm text-muted">Aucune configuration à afficher. Créez-en une avec le questionnaire ou le configurateur manuel.</p>
          <div className="mt-4 flex gap-2">
            <LinkButton href="/assiste" variant="primary">Configuration assistée</LinkButton>
            <LinkButton href="/manuel">Configuration manuelle</LinkButton>
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Fiche de configuration"
      intro="Visualisez la configuration, changez son style et son éclairage, puis vérifiez chaque point."
      actions={
        <>
          <LinkButton href={`/manuel?${query}`}>Modifier les composants</LinkButton>
          <LinkButton href={`/comparer?a=${encodeURIComponent(query)}`}>Comparer</LinkButton>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0 space-y-4 lg:sticky lg:top-18 lg:self-start">
          <Viewer build={build} style={state.style} lighting={state.lighting} className="aspect-[4/3] w-full lg:aspect-auto lg:h-[62vh]" />
          <Card>
            <CardTitle>Style</CardTitle>
            <StylePicker value={state.style} onChange={setStyle} compact />
            <div className="mt-4">
              <CardTitle>Éclairage</CardTitle>
              <LightingPicker value={state.lighting} onChange={(lighting) => update({ lighting })} />
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardTitle aside={<StatusBadge status={report.status} />}>Composants</CardTitle>
            <ComponentList build={build} />
            <div className="mt-3 border-t border-line pt-3">
              <PriceTotal build={build} />
            </div>
            <div className="mt-4">
              <BuildActions query={query} build={build} />
            </div>
          </Card>
          <CompatPanel report={report} />
          <PerfPanel build={build} resolution={state.resolution} targetFps={state.targetFps} onResolution={(resolution) => update({ resolution })} />
          <FpsByResolution build={build} targetFps={state.targetFps} />
          <BudgetBreakdown build={build} />
          <PowerPanel build={build} />
          <DemoNotice />
        </div>
      </div>
    </PageShell>
  );
}

export default function ConfigPage() {
  return (
    <Suspense>
      <Config />
    </Suspense>
  );
}
