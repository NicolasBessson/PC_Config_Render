import { estimatePower, fanCountOf, PSU_MARGIN, type Build } from "../build";
import type { Category } from "../catalog";

export type Status = "ok" | "warn" | "fail";

export interface Diagnostic {
  ruleId: string;
  ruleVersion: number;
  title: string;
  /** ok = règle satisfaite · warn = à vérifier · fail = conflit bloquant. */
  status: Status;
  /** Explication lisible, avec les valeurs utilisées. */
  message: string;
  /** Catégories de composants concernées. */
  involves: Category[];
}

export interface Rule {
  id: string;
  /** Incrémenté à chaque changement de logique : les règles sont versionnées. */
  version: number;
  title: string;
  involves: Category[];
  /** Retourne `null` lorsque les composants nécessaires ne sont pas tous choisis. */
  check(build: Build): { status: Status; message: string } | null;
}

/** Épaisseur approximative d'un radiateur frontal avec ses ventilateurs. */
const FRONT_RADIATOR_DEPTH_MM = 55;

export const RULES: Rule[] = [
  {
    id: "cpu-socket",
    version: 1,
    title: "Socket processeur / carte mère",
    involves: ["cpu", "motherboard"],
    check({ cpu, motherboard }) {
      if (!cpu || !motherboard) return null;
      return cpu.socket === motherboard.socket
        ? { status: "ok", message: `Le processeur et la carte mère utilisent le socket ${cpu.socket}.` }
        : { status: "fail", message: `Le ${cpu.name} utilise le socket ${cpu.socket}, la carte mère ${motherboard.name} le socket ${motherboard.socket}. Ils ne peuvent pas être assemblés.` };
    },
  },
  {
    id: "cpu-bios",
    version: 1,
    title: "Version du BIOS",
    involves: ["cpu", "motherboard"],
    check({ cpu, motherboard }) {
      if (!cpu || !motherboard || cpu.socket !== motherboard.socket) return null;
      return motherboard.biosUpdateFor.includes(cpu.id)
        ? { status: "warn", message: `La ${motherboard.name} peut nécessiter une mise à jour du BIOS pour reconnaître le ${cpu.name}. À vérifier auprès du vendeur.` }
        : { status: "ok", message: "Aucune mise à jour du BIOS connue n'est requise pour ce processeur." };
    },
  },
  {
    id: "ram-type",
    version: 1,
    title: "Génération de RAM",
    involves: ["ram", "motherboard"],
    check({ ram, motherboard }) {
      if (!ram || !motherboard) return null;
      return ram.type === motherboard.ramType
        ? { status: "ok", message: `La carte mère accepte la ${ram.type}.` }
        : { status: "fail", message: `Le kit est en ${ram.type}, mais la ${motherboard.name} n'accepte que la ${motherboard.ramType}.` };
    },
  },
  {
    id: "motherboard-case",
    version: 1,
    title: "Format carte mère / boîtier",
    involves: ["motherboard", "case"],
    check({ motherboard, case: pcCase }) {
      if (!motherboard || !pcCase) return null;
      return pcCase.formFactors.includes(motherboard.formFactor)
        ? { status: "ok", message: `Le boîtier accepte les cartes mères ${motherboard.formFactor}.` }
        : { status: "fail", message: `La carte mère est au format ${motherboard.formFactor} ; le ${pcCase.name} n'accepte que ${pcCase.formFactors.join(", ")}.` };
    },
  },
  {
    id: "gpu-length",
    version: 1,
    title: "Longueur de la carte graphique",
    involves: ["gpu", "case"],
    check({ gpu, case: pcCase }) {
      if (!gpu || !pcCase) return null;
      return gpu.lengthMm <= pcCase.gpuMaxLengthMm
        ? { status: "ok", message: `Carte de ${gpu.lengthMm} mm pour ${pcCase.gpuMaxLengthMm} mm admis par le boîtier.` }
        : { status: "fail", message: `La carte graphique mesure ${gpu.lengthMm} mm ; le ${pcCase.name} admet ${pcCase.gpuMaxLengthMm} mm au maximum.` };
    },
  },
  {
    id: "gpu-front-radiator",
    version: 1,
    title: "Carte graphique / radiateur frontal",
    involves: ["gpu", "case", "cooler"],
    check({ gpu, case: pcCase, cooler }) {
      if (!gpu || !pcCase || !cooler || cooler.type !== "aio" || cooler.radiatorMm === null) return null;
      const size = cooler.radiatorMm;
      const fitsTop = pcCase.radiators.top.includes(size);
      const fitsFront = pcCase.radiators.front.includes(size);
      if (fitsTop || !fitsFront) return null; // pas de montage frontal imposé
      return gpu.lengthMm + FRONT_RADIATOR_DEPTH_MM > pcCase.gpuMaxLengthMm
        ? { status: "warn", message: `Le radiateur de ${size} mm ne se monte qu'en façade : avec ses ventilateurs (~${FRONT_RADIATOR_DEPTH_MM} mm), il peut gêner la carte graphique de ${gpu.lengthMm} mm. À vérifier.` }
        : { status: "ok", message: "Le radiateur monté en façade laisse la place à la carte graphique." };
    },
  },
  {
    id: "cooler-socket",
    version: 1,
    title: "Socket du refroidissement",
    involves: ["cooler", "cpu"],
    check({ cooler, cpu }) {
      if (!cooler || !cpu) return null;
      return cooler.sockets.includes(cpu.socket)
        ? { status: "ok", message: `Le ${cooler.name} se fixe sur le socket ${cpu.socket}.` }
        : { status: "fail", message: `Le ${cooler.name} ne prend pas en charge le socket ${cpu.socket} (sockets supportés : ${cooler.sockets.join(", ")}).` };
    },
  },
  {
    id: "cooler-fit",
    version: 1,
    title: "Encombrement du refroidissement",
    involves: ["cooler", "case"],
    check({ cooler, case: pcCase }) {
      if (!cooler || !pcCase) return null;
      if (cooler.type === "air") {
        if (cooler.heightMm === null) return { status: "warn", message: "Hauteur du ventirad inconnue : à vérifier." };
        return cooler.heightMm <= pcCase.coolerMaxHeightMm
          ? { status: "ok", message: `Ventirad de ${cooler.heightMm} mm pour ${pcCase.coolerMaxHeightMm} mm admis par le boîtier.` }
          : { status: "fail", message: `Le ventirad mesure ${cooler.heightMm} mm de haut ; le ${pcCase.name} admet ${pcCase.coolerMaxHeightMm} mm au maximum.` };
      }
      if (cooler.radiatorMm === null) return { status: "warn", message: "Taille du radiateur inconnue : à vérifier." };
      const supported = [...pcCase.radiators.top, ...pcCase.radiators.front];
      return supported.includes(cooler.radiatorMm)
        ? { status: "ok", message: `Le boîtier dispose d'un emplacement pour un radiateur de ${cooler.radiatorMm} mm.` }
        : { status: "fail", message: `Le ${pcCase.name} n'a pas d'emplacement pour un radiateur de ${cooler.radiatorMm} mm.` };
    },
  },
  {
    id: "cooler-capacity",
    version: 1,
    title: "Capacité thermique",
    involves: ["cooler", "cpu"],
    check({ cooler, cpu }) {
      if (!cooler || !cpu || !cooler.sockets.includes(cpu.socket)) return null;
      if (cooler.tdpRatingW === null) return { status: "warn", message: "Capacité de refroidissement non documentée : à vérifier." };
      return cooler.tdpRatingW >= cpu.powerW
        ? { status: "ok", message: `Capacité annoncée de ${cooler.tdpRatingW} W pour un processeur pouvant dissiper ${cpu.powerW} W.` }
        : { status: "warn", message: `Le processeur peut dissiper ${cpu.powerW} W, pour ${cooler.tdpRatingW} W annoncés par le refroidissement. Le PC fonctionnera, mais chauffera en charge soutenue. À vérifier.` };
    },
  },
  {
    id: "ram-cooler-clearance",
    version: 1,
    title: "Dégagement RAM / ventirad",
    involves: ["ram", "cooler"],
    check({ ram, cooler }) {
      if (!ram || !cooler || cooler.type !== "air" || cooler.ramClearanceMm === null) return null;
      return ram.heightMm <= cooler.ramClearanceMm
        ? { status: "ok", message: `Barrettes de ${ram.heightMm} mm sous un ventirad qui en admet ${cooler.ramClearanceMm}.` }
        : { status: "warn", message: `Les barrettes mesurent ${ram.heightMm} mm, le ${cooler.name} n'en admet que ${cooler.ramClearanceMm} sous son ventilateur. Un montage décalé est souvent possible : à vérifier.` };
    },
  },
  {
    id: "psu-wattage",
    version: 1,
    title: "Puissance de l'alimentation",
    involves: ["psu", "cpu", "gpu"],
    check(build) {
      const { psu } = build;
      const power = estimatePower(build);
      if (!psu || !power) return null;
      const margin = Math.round(PSU_MARGIN * 100);
      return psu.wattage >= power.requiredW
        ? { status: "ok", message: `Consommation estimée à ${power.totalW} W ; avec ${margin} % de marge, il faut ${power.requiredW} W. L'alimentation en fournit ${psu.wattage}.` }
        : { status: "fail", message: `Consommation estimée à ${power.totalW} W ; avec ${margin} % de marge, il faut ${power.requiredW} W. L'alimentation n'en fournit que ${psu.wattage}.` };
    },
  },
  {
    id: "psu-connectors",
    version: 1,
    title: "Connecteurs d'alimentation du GPU",
    involves: ["psu", "gpu"],
    check({ psu, gpu }) {
      if (!psu || !gpu) return null;
      const { connector, count, adapter8pin } = gpu.power;
      if (connector === "8pin") {
        return psu.pcie8pin >= count
          ? { status: "ok", message: `La carte demande ${count} connecteur(s) PCIe 8 broches ; l'alimentation en propose ${psu.pcie8pin}.` }
          : { status: "fail", message: `La carte demande ${count} connecteur(s) PCIe 8 broches ; l'alimentation n'en propose que ${psu.pcie8pin}.` };
      }
      if (psu.has12v2x6) return { status: "ok", message: "L'alimentation dispose du connecteur 12V-2x6 (16 broches) requis par la carte." };
      if (adapter8pin !== null && psu.pcie8pin >= adapter8pin) {
        return { status: "warn", message: `L'alimentation n'a pas de connecteur 12V-2x6. Un adaptateur vers ${adapter8pin} connecteurs 8 broches est en général fourni avec la carte : à vérifier.` };
      }
      return { status: "fail", message: `La carte demande un connecteur 12V-2x6 (16 broches) : l'alimentation n'en a pas et ne dispose pas d'assez de connecteurs 8 broches pour un adaptateur.` };
    },
  },
  {
    id: "fans-case",
    version: 1,
    title: "Emplacements des ventilateurs supplémentaires",
    involves: ["fans", "case", "cooler"],
    check(build) {
      const { fans, case: pcCase, cooler } = build;
      if (!fans || !pcCase) return null;
      const count = fanCountOf(build);
      if (!pcCase.fanSlots) return { status: "warn", message: "Les emplacements de ventilateurs de ce boîtier ne sont pas documentés : à vérifier." };
      const size = String(fans.sizeMm) as "120" | "140";
      // Un radiateur occupe toute sa position ; les ventilateurs fournis en façade occupent la leur.
      const radiator = cooler?.type === "aio" && cooler.radiatorMm ? (pcCase.radiators.top.includes(cooler.radiatorMm) ? "top" : "front") : null;
      const included = pcCase.visual?.frontFans ?? 0;
      const front = radiator === "front" ? 0 : Math.max(0, pcCase.fanSlots.front[size] - included);
      const top = radiator === "top" ? 0 : pcCase.fanSlots.top[size];
      const free = front + top;
      if (count > free) {
        return { status: "fail", message: `Le ${pcCase.name} n'a que ${free} emplacement(s) libre(s) de ${fans.sizeMm} mm (${front} en façade, ${top} en haut) pour ${count} ventilateur(s).` };
      }
      return { status: "ok", message: `${count} ventilateur(s) de ${fans.sizeMm} mm pour ${free} emplacement(s) libre(s). Prévoir un connecteur par ventilateur sur la carte mère, ou un répartiteur.` };
    },
  },
  {
    id: "psu-case",
    version: 1,
    title: "Format de l'alimentation",
    involves: ["psu", "case"],
    check({ psu, case: pcCase }) {
      if (!psu || !pcCase) return null;
      return psu.formFactor === pcCase.psuFormFactor
        ? { status: "ok", message: `Le boîtier accepte les alimentations ${psu.formFactor}.` }
        : { status: "fail", message: `L'alimentation est au format ${psu.formFactor}, le boîtier attend du ${pcCase.psuFormFactor}.` };
    },
  },
];
