import { test, expect } from "@playwright/test";

test("opportunity atlas explains the mechanism without reading or writing private research", async ({ page }) => {
  const apiRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { name: "See what a connection makes possible." })).toBeVisible();
  await expect(page.getByText(/Illustrative research case/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "A position already has value." })).toBeVisible();

  await page.getByRole("button", { name: "Explore Kamino's complementary capability" }).click();
  await expect(page.getByRole("heading", { name: "Another business supplies a missing use." })).toBeVisible();
  await expect(page.getByText("Are collateral eligibility, reliable pricing and liquidation arrangements in place?")).toBeVisible();
  await page.getByRole("button", { name: /05 Your participation/ }).click();
  await expect(page.getByRole("heading", { name: "Your role needs an agreement." })).toBeVisible();
  await expect(page.getByText("Who would pay, for which deliverables, over what period and against which results?")).toBeVisible();

  await page.getByRole("button", { name: /01 Existing product/ }).click();
  await page.clock.install();
  await page.getByRole("button", { name: "Play walkthrough", exact: true }).click();
  await page.clock.fastForward(6600);
  await expect(page.getByRole("button", { name: /02 Complementary capability/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Pause walkthrough", exact: true }).click();
  await page.clock.fastForward(14000);
  await expect(page.getByRole("button", { name: /02 Complementary capability/ })).toHaveAttribute("aria-pressed", "true");
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("opportunity research distinguishes measurements and validates hypothetical compensation", async ({ page }) => {
  await page.goto("/opportunities");
  await page.getByRole("tab", { name: "Business needs", exact: true }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByText("Capacity", { exact: true })).toBeVisible();
  await expect(panel.getByText("Deposited collateral", { exact: true })).toBeVisible();
  await expect(panel.getByText("Outstanding borrowing", { exact: true })).toBeVisible();
  await expect(panel.getByText("Attributed net revenue", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Your opportunity", exact: true }).click();
  await expect(panel.getByText(/No compensation agreement or market rate is established/)).toBeVisible();
  const revenue = page.getByRole("spinbutton", { name: "Attributed annual net revenue ($)" });
  const share = page.getByRole("spinbutton", { name: "Negotiated share (%)" });
  await revenue.fill("250000");
  await share.fill("5");
  await expect(panel.getByText("$12,500", { exact: true })).toBeVisible();
  await share.fill("101");
  await expect(panel.getByText("Enter non-negative revenue and a share between 0 and 100%.")).toBeVisible();
  await share.fill("5");
  await revenue.fill("-100");
  await expect(panel.getByText("Enter non-negative revenue and a share between 0 and 100%.")).toBeVisible();
  await revenue.fill("");
  await expect(panel.getByText("$12,500", { exact: true })).toHaveCount(0);
  await revenue.fill("0");
  await expect(panel.getByText("$0", { exact: true })).toBeVisible();

  const checklist = page.getByRole("checkbox", { name: "Find evidence that holders want this new use." });
  await checklist.check();
  await page.reload();
  await page.getByRole("tab", { name: "Your opportunity", exact: true }).click();
  await expect(checklist).not.toBeChecked(); // The preview never implies durable research storage.
});

test("opportunity atlas works on small screens and honors reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/opportunities");
    await expect(page.getByRole("button", { name: "Play walkthrough", exact: true })).toBeDisabled();
    await expect(page.getByText("Reduced motion is on. Select each step to explore at your pace.")).toBeVisible();
    await page.getByRole("button", { name: /03 New behaviour/ }).click();
    await expect(page.getByRole("heading", { name: "The holder gets another choice." })).toBeVisible();
    for (const tab of ["Value flow", "Business needs", "Your opportunity"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await page.getByRole("navigation").getByRole("button", { name: "Value flow", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toHaveAttribute("aria-expanded", "false");
  }
  await page.screenshot({ path: "/tmp/bd-oracle-opportunity-mobile.png", fullPage: true, animations: "disabled" });
});
