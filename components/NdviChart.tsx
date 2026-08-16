"use client";

interface Point {
  annee: string;
  valeur: number | null;
  statut: string;
}

export function NdviChart({ points }: { points: Point[] }) {
  const valeurs = points.filter((p) => p.valeur !== null).map((p) => p.valeur as number);
  if (valeurs.length === 0) {
    return (
      <p className="font-body text-sm text-potentiel-insuffisant">
        Données insuffisantes pour tracer l'historique.
      </p>
    );
  }

  const largeur = 280;
  const hauteur = 90;
  const marge = 20;
  const min = Math.min(...valeurs) * 0.85;
  const max = Math.max(...valeurs) * 1.15;

  const xPas = (largeur - marge * 2) / (points.length - 1);
  const yPour = (v: number) =>
    hauteur - marge - ((v - min) / (max - min || 1)) * (hauteur - marge * 2);

  const pointsValides = points
    .map((p, i) => (p.valeur !== null ? { x: marge + i * xPas, y: yPour(p.valeur), ...p } : null))
    .filter(Boolean) as { x: number; y: number; annee: string; valeur: number }[];

  const chemin = pointsValides
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="w-full">
        <path d={chemin} fill="none" stroke="#4C7A3D" strokeWidth="2" />
        {pointsValides.map((p) => (
          <circle key={p.annee} cx={p.x} cy={p.y} r="3" fill="#4C7A3D" />
        ))}
        {points.map((p, i) => {
          const x = marge + i * xPas;
          const indisponible = p.valeur === null;
          return (
            <g key={p.annee}>
              {indisponible && (
                <circle cx={x} cy={hauteur - marge} r="3" fill="none" stroke="#9C948A" strokeDasharray="1.5" />
              )}
              <text
                x={x}
                y={hauteur - 2}
                textAnchor="middle"
                fontSize="8"
                fontFamily="var(--font-mono)"
                fill="#6B6155"
              >
                {p.annee}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="telemetry mt-1">NDVI · COPERNICUS SENTINEL-2 SR HARMONIZED · 10 M</p>
    </div>
  );
}
