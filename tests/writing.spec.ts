import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("writecn.audioEnabled", "false");
  });
});

test("mounts the writing surface after starting", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Start$/ }).click();
  const target = page.getByTestId("writing-target");
  await expect(target.locator("svg, canvas")).toBeVisible();
});

test("dragging on the board registers a stroke", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Start$/ }).click();

  const target = page.getByTestId("writing-target");
  await expect(target.locator("svg, canvas")).toBeVisible();

  const progress = page.locator('[data-testid="stroke-progress"]');
  await expect(progress).toHaveCount(0);

  const box = await target.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const points = [
    { x: box.x + box.width * 0.15, y: box.y + box.height * 0.15 },
    { x: box.x + box.width * 0.85, y: box.y + box.height * 0.15 },
    { x: box.x + box.width * 0.85, y: box.y + box.height * 0.85 },
    { x: box.x + box.width * 0.15, y: box.y + box.height * 0.85 },
  ];

  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index];
    const end = points[index + 1];
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
  }

  await expect(progress).toBeVisible();
});
