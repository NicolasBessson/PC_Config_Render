// Tests navigateur des parcours principaux (roadmap V2, tâche 7.3).
//
// Prérequis : le site doit tourner (npm run build && npm start), et Chromium
// doit être installé pour Playwright (npx playwright install chromium).
//
// Usage : npm run e2e
//   BASE_URL       adresse du site (défaut : http://localhost:3000)
//   PW_CHROMIUM    chemin d'un Chromium déjà installé, si besoin
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const BUILD = "r5-7600.rx-9070xt.b650-tomahawk.ddr5-32-vengeance.nv3-1tb.rm750e.pa120-se.4000d-airflow";
// Rendu WebGL logiciel : fonctionne aussi sur une machine sans carte graphique.
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const results = [];
async function test(name, run, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  try {
    await run(page);
    if (errors.length) throw new Error(`erreurs dans la console : ${errors[0].slice(0, 200)}`);
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`  ✗ ${name}\n      ${String(error.message ?? error).split("\n")[0]}`);
  } finally {
    await context.close();
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const open = (page, path) => page.goto(BASE + path, { waitUntil: "networkidle" });

console.log(`Tests navigateur sur ${BASE}`);

await test("configurateur assisté : du questionnaire à trois propositions", async (page) => {
  await open(page, "/assiste");
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: /Cyberpunk 2077/ }).click();
  for (const choice of [null, /1440p/, /^60 FPS/]) {
    if (choice) await page.getByRole("button", { name: choice }).click();
    await page.getByRole("button", { name: /Continuer/ }).click();
  }
  await page.getByRole("button", { name: /RGB/ }).click();
  await page.getByRole("button", { name: /Voir mes configurations/ }).click();
  await page.waitForURL(/resultats/);
  const titles = await page.locator("article h2").allTextContents();
  expect(titles.join() === "Économique,Équilibrée,Performance", `propositions inattendues : ${titles}`);
  expect((await page.getByText("Objectif atteint").count()) === 3, "les trois propositions doivent atteindre l'objectif");
});

await test("cible irréalisable : aucun résultat présenté comme satisfaisant", async (page) => {
  await open(page, "/resultats?budget=900&jeux=cyberpunk-2077&res=4K&fps=144&style=noir");
  expect(await page.getByText(/Aucune configuration du catalogue n'atteint/).count(), "le message d'échec doit s'afficher");
  expect((await page.getByText("Objectif atteint", { exact: true }).count()) === 0, "aucune proposition ne doit afficher « Objectif atteint »");
});

await test("jeu sans benchmark : aucun FPS inventé", async (page) => {
  await open(page, "/resultats?budget=1500&jeux=monster-hunter-wilds&res=1440p&fps=60&style=noir");
  expect(await page.getByText(/Aucun benchmark exploitable/).count(), "l'absence de données doit être annoncée");
  expect((await page.locator("article").count()) === 0, "aucune proposition ne doit être affichée");
});

await test("configuration manuelle : incompatibilité processeur / carte mère", async (page) => {
  await open(page, "/manuel?b=r5-7600");
  await page.getByRole("button", { name: /Carte mère/ }).click();
  await page.getByRole("button", { name: /Z790 Tomahawk/ }).click();
  expect(await page.getByText(/Ils ne peuvent pas être assemblés/).count(), "le conflit de socket doit être expliqué");
  expect(await page.getByText("Incompatible").count(), "l'état « Incompatible » doit s'afficher");
});

await test("ventilateurs supplémentaires : quantité, prix et emplacements", async (page) => {
  await open(page, `/manuel?b=${BUILD}`);
  await page.getByRole("button", { name: /P12 PWM PST 120 mm/ }).first().click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Ajouter un ventilateur" }).click();
  expect(page.url().includes(".arctic-p12-pwm-pst.5"), "le nombre de ventilateurs doit figurer dans le lien");
  expect(await page.getByText(/n'a que 4 emplacement/).count(), "le dépassement des emplacements doit être signalé");
});

await test("partage par URL : la configuration et l'éclairage sont restaurés", async (page) => {
  await open(page, `/config?b=${BUILD}&style=rgb&lum=breath&c=2f6bff&c2=ff2d6f&li=140&anim=0`);
  expect(await page.getByText("AMD Ryzen 5 7600").count(), "les composants du lien doivent s'afficher");
  expect((await page.getByRole("button", { name: "Respiration" }).getAttribute("aria-pressed")) === "true", "l'effet d'éclairage doit être restauré");
  expect((await page.getByLabel("Intensité de l'éclairage").inputValue()) === "140", "l'intensité doit être restaurée");
  expect(!(await page.getByRole("checkbox", { name: "Animations" }).isChecked()), "les animations doivent rester coupées");
});

await test("visualiseur 3D : vues, vitre, fiche au clic et capture", async (page) => {
  await open(page, `/config?b=${BUILD}&style=noir`);
  await page.waitForSelector("canvas");
  await page.getByRole("group", { name: "Vues" }).getByRole("button", { name: "Côté", exact: true }).click();
  await page.getByRole("button", { name: "Retirer la vitre" }).click();
  expect(await page.getByRole("button", { name: "Remettre la vitre" }).count(), "la vitre doit pouvoir être retirée");
  await page.waitForTimeout(4000);
  const stage = await page.locator(".viewer-stage").first().boundingBox();
  await page.mouse.click(stage.x + stage.width * 0.5, stage.y + stage.height * 0.52);
  await page.getByLabel("Composant sélectionné").waitFor({ timeout: 5000 });
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Capture" }).click()]);
  expect(download.suggestedFilename().endsWith(".png"), "la capture doit produire une image");
  await page.getByRole("button", { name: "Réinitialiser" }).click();
  expect(await page.getByRole("button", { name: "Retirer la vitre" }).count(), "la réinitialisation doit remettre la vitre");
});

await test("comparateur : tableau et résumé des écarts", async (page) => {
  const other = "r7-9800x3d.rtx-5080.b650-tomahawk.ddr5-32-tridentz5-rgb.990pro-2tb.rm850x.lf3-360-argb.lancool-216-rgb";
  await open(page, `/comparer?a=${encodeURIComponent(`b=${BUILD}&style=noir`)}&b=${encodeURIComponent(`b=${other}&style=rgb`)}`);
  expect((await page.locator("tbody tr").count()) >= 18, "le tableau comparatif doit être complet");
  expect(await page.getByText(/coûte .* de moins/).count(), "le résumé doit indiquer l'écart de prix");
});

await test("repli sans WebGL : la page reste utilisable", async (page) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return /webgl/.test(type) ? null : original.call(this, type, ...rest);
    };
  });
  await open(page, `/config?b=${BUILD}`);
  await page.getByText("Rendu 3D indisponible").waitFor({ timeout: 10000 });
  expect(await page.getByText("AMD Ryzen 5 7600").count(), "les données doivent rester accessibles");
});

await test("mobile : onglets du configurateur et aucune page qui déborde", async (page) => {
  for (const path of ["/", "/assiste", `/manuel?b=${BUILD}`, `/config?b=${BUILD}`, "/comparer"]) {
    await open(page, path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow <= 0, `${path} déborde de ${overflow} px`);
  }
  await open(page, `/manuel?b=${BUILD}`);
  await page.getByRole("tab", { name: "Aperçu 3D" }).click();
  await page.waitForSelector("canvas", { state: "visible" });
}, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

await browser.close();
const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed} réussis, ${failed} échoué(s)`);
process.exit(failed ? 1 : 0);
