// Squelette de chargement générique affiché par les loading.tsx de route pendant
// l'hydratation initiale — évite l'écran blanc constaté sur les pages à données
// (dashboard, assistant, citations, intégrations) le temps que le JS s'exécute.
export default function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 h-7 w-48 rounded-lg bg-accent" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-hairline bg-accent/40" />
        ))}
      </div>
    </div>
  );
}
