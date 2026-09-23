// tests/e2e/specs/dashboard.spec.ts
import { expect, test } from "@playwright/test";
import { e2eTag } from "../helpers/session";
import { addDays, today } from "../helpers/fixtures";
import { createPastBookingViaDrawer, deleteBookingByTag, uniquePastDayOffset } from "../helpers/bookings";

test.describe("dashboard — azioni arretrate", () => {
  test("un'azione DA_FARE con data passata compare in 'Arretrate', non in 'Da completare: 0'", async ({ page }) => {
    const tag = e2eTag("dashboard-overdue");
    const offset = uniquePastDayOffset(3000);
    const checkIn = addDays(today(), offset);
    const checkOut = addDays(today(), offset + 2);

    try {
      // check_out è nel passato: usa createPastBookingViaDrawer, non
      // createBookingViaDrawer — dal Task 8 il filtro di default "Attive"
      // (check_out >= oggi) nasconderebbe subito la riga appena creata e
      // farebbe fallire l'asserzione di visibilità interna dell'helper.
      await createPastBookingViaDrawer(page, {
        checkIn,
        checkOut,
        guests: "2",
        channel: "airbnb",
        amount: "90.00",
        note: tag,
      });

      const resyncResult = await page.evaluate(async () => {
        const response = await fetch("/api/bookings/resync", { method: "POST" });
        return { ok: response.ok, status: response.status };
      });
      expect(resyncResult.ok, `resync fallita con status ${resyncResult.status}`).toBe(true);

      await page.goto("/");
      const arretrateCard = page.getByRole("button", { name: /Arretrate/ });
      await expect(arretrateCard).toBeVisible();
      const arretrateValue = await arretrateCard.locator("p").filter({ hasText: /^\d+$/ }).first().innerText();
      expect(Number(arretrateValue)).toBeGreaterThan(0);

      await arretrateCard.click();
      // history.replaceState ripulisce l'URL non appena legge i query param
      // (stesso pattern di ?new=1 in app/bookings/page.tsx): l'URL torna a
      // /actions "nudo", il periodo applicato si verifica sui valori del
      // pannello "Periodo personalizzato", non sulla query string.
      await expect(page).toHaveURL(/\/actions$/);
      await expect(page.locator("#actions-from-date")).toHaveValue("2000-01-01");
      await expect(page.locator("#actions-to-date")).toHaveValue(addDays(today(), -1));

      // Le due asserzioni sopra (URL e valori degli input "Periodo
      // personalizzato") sono sincrone e si applicano a prescindere da quale
      // fetch delle azioni "vince" la race: non bastano a intercettare una
      // regressione della race condition tra il fetch automatico del mese
      // corrente (al mount di /actions, prima che il deep-link venga letto)
      // e il fetch a range ampio innescato da applyExplicitRange — entrambi
      // condividono lo stesso AbortController ref, e se il cleanup
      // dell'effect di auto-load lo aborte "alla cieca" (invece di limitarsi
      // a `clearTimeout`), può cancellare per danno collaterale il fetch a
      // range ampio già in volo, lasciando `actions` vuoto. Gli input data
      // mostrerebbero comunque i valori "giusti" in quel caso. Verifichiamo
      // quindi il contenuto reale della lista renderizzata, non solo
      // l'URL/gli input:

      // 1) il sottotitolo dell'header ("N azioni · <mese>") deve riportare un
      //    conteggio > 0: con la race reintrodotta, il fetch a range ampio
      //    verrebbe cancellato e il conteggio resterebbe a 0.
      //    `expect.poll` invece di una singola lettura di `innerText`: il
      //    sottotitolo è visibile fin da subito con "0 azioni" (stato
      //    iniziale, prima che la fetch a range ampio risolva), quindi un
      //    singolo controllo "è visibile + leggi il testo" può catturare
      //    quello stato transitorio invece del risultato finale — bisogna
      //    ripetere la lettura finché il conteggio non si stabilizza > 0 (o
      //    scade il timeout, il che significa che la race NON si è risolta
      //    correttamente).
      const subtitle = page.getByText(/^\d+ azion[ei] · /);
      await expect(subtitle).toBeVisible();
      await expect
        .poll(
          async () => {
            const subtitleText = await subtitle.innerText();
            const match = subtitleText.match(/^(\d+) azion/);
            return match ? Number(match[1]) : -1;
          },
          { message: "conteggio azioni nel sottotitolo dell'header /actions" },
        )
        .toBeGreaterThan(0);

      // 2) deve comparire almeno un'azione "Pulizia" in lista: ogni
      //    prenotazione genera sempre una PULIZIA alla data di checkout
      //    (lib/booking-automation.ts), quindi la nostra prenotazione di
      //    test ne garantisce almeno una nel range arretrato. Con la race
      //    reintrodotta la lista risulterebbe svuotata insieme al resto,
      //    quindi anche questa asserzione fallirebbe.
      await expect(page.getByRole("button", { name: /Pulizia/ }).first()).toBeVisible();
    } finally {
      await deleteBookingByTag(page, tag);
    }
  });
});
