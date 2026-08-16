import type { ScorePotentiel } from "@/lib/types";
import { CATEGORIE_COULEUR, CATEGORIE_LABEL, CATEGORIE_EMOJI } from "@/lib/zones";

const CONFIANCE_LABEL: Record<string, string> = {
  eleve: "Confiance élevée",
  moyen: "Confiance moyenne",
  faible: "Confiance faible",
  indetermine: "Confiance indéterminée",
};

export function ScoreBadge({ score, size = "large" }: { score: ScorePotentiel; size?: "large" | "small" }) {
  if (score.score === null || !score.categorie) {
    return (
      <div className="flex items-center gap-2 text-potentiel-insuffisant">
        <span className="text-lg">⚪</span>
        <span className="font-body text-sm">Données insuffisantes</span>
      </div>
    );
  }

  const couleur = CATEGORIE_COULEUR[score.categorie];
  const rayon = 26;
  const circonference = 2 * Math.PI * rayon;
  const progression = (score.score / 100) * circonference;

  if (size === "small") {
    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: couleur }}
        />
        <span className="font-mono text-sm font-semibold text-stone-900">{score.score}/100</span>
        <span className="font-body text-xs text-stone-800">
          {CATEGORIE_EMOJI[score.categorie]} {CATEGORIE_LABEL[score.categorie]}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
        <circle cx="32" cy="32" r={rayon} fill="none" stroke="#E1D3B4" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={rayon}
          fill="none"
          stroke={couleur}
          strokeWidth="6"
          strokeDasharray={`${progression} ${circonference}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text
          x="32"
          y="36"
          textAnchor="middle"
          className="font-mono"
          fontSize="16"
          fontWeight="600"
          fill="#241F1A"
        >
          {score.score}
        </text>
      </svg>
      <div>
        <div className="font-display text-lg font-semibold text-stone-900">
          {CATEGORIE_EMOJI[score.categorie]} {CATEGORIE_LABEL[score.categorie]}
        </div>
        <div className="font-body text-sm text-stone-800">{CONFIANCE_LABEL[score.niveau_confiance]}</div>
        <div className="telemetry mt-0.5">{score.libelle}</div>
      </div>
    </div>
  );
}
