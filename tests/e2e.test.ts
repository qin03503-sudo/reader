import { test, expect } from "@playwright/test";
import path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

test.describe("App E2E Tests", () => {
    test("Upload PDF, translate and other functional tests", async ({ page }) => {
        // Mock the settings API endpoint
        await page.route("/api/settings", async route => {
            if (route.request().method() === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        id: "default",
                        openaiKey: process.env.GEMINI_API_KEY || "test-key",
                        openaiBaseUrl: "",
                        openaiKeys: [],
                        litellmBaseUrl: "",
                        litellmKeys: [],
                        openrouterKey: ""
                    })
                });
            } else {
                await route.continue();
            }
        });

        // Mock upload endpoint
        await page.route("/api/upload", async route => {
            if (route.request().method() === "POST") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        success: true,
                        book: {
                            id: "123",
                            title: "Test Book",
                            author: "Test Author",
                            coverUrl: null,
                            chapters: [
                                { id: "c1", href: "chapter1.xhtml", title: "Chapter 1" }
                            ]
                        }
                    })
                });
            } else if (route.request().method() === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        books: [
                            {
                                id: "123",
                                title: "Test Book",
                                author: "Test Author",
                                coverUrl: null,
                                chapters: [
                                    { id: "c1", href: "chapter1.xhtml", title: "Chapter 1" }
                                ]
                            }
                        ]
                    })
                });
            } else {
                await route.continue();
            }
        });

        await page.route("/api/chapter?bookId=123&href=chapter1.xhtml", async route => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    html: "<p>This is a test chapter.</p>"
                })
            })
        });

        await page.goto("/");

        // Settings tests
        await page.locator("button", { has: page.locator("svg.lucide-settings") }).click();
        await expect(page.locator("h2", { hasText: "Settings" })).toBeVisible();
        await page.click("button >> text=Cancel");

        // Upload tests

        // wait for library to load
        await page.waitForTimeout(1000);

        // Create dummy pdf
        const dummyPdfPath = path.join(__dirname, "dummy.pdf");
        fs.writeFileSync(dummyPdfPath, "dummy content");

        const fileChooserPromise = page.waitForEvent("filechooser");
        await page.locator("label", { hasText: "Add Book" }).click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(dummyPdfPath);

        // wait for upload
        await page.waitForTimeout(1000);

        // The mock will return Test Book
        await expect(page.locator("h3", { hasText: "Test Book" })).toBeVisible();

        // Open book
        await page.locator("div.group").first().locator("div[role=\"button\"]").click();

        // Check reader
        await expect(page.locator("text=This is a test chapter.")).toBeVisible();

        fs.unlinkSync(dummyPdfPath);
    });

});
