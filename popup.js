const BASE_URL = "https://dips.sja.org.uk/NER/DutySystem-List.asp";

function openListing(filter) {
    chrome.tabs.create({
        url: `${BASE_URL}?filter=${filter}`
    });
}

document.getElementById("openRegional").onclick = () =>
    openListing("none");

document.getElementById("openCounty").onclick = () =>
    openListing("mydist");

document.getElementById("openNetwork").onclick = () =>
    openListing("myarea");

document.getElementById("scrapeBtn").addEventListener("click", async () => {
    const status = document.getElementById("status");
    status.textContent = "Checking page…";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.startsWith(BASE_URL)) {
        status.textContent =
            "❌ You must be on the DIPS DutySystem page to scrape.";
        return;
    }

    status.textContent = "Scraping…";

    chrome.tabs.sendMessage(tab.id, { action: "scrape" }, async response => {
        if (chrome.runtime.lastError) {
            status.textContent =
                "❌ Scraper not available on this page.";
            return;
        }

        if (!response) {
            status.textContent = "❌ No response from scraper.";
            return;
        }

        if (response.success) {
            const json = JSON.stringify(response.data, null, 2);
            try {
                await navigator.clipboard.writeText(json);
                status.textContent =
                    `✅ Done\n${response.data.length} events copied to clipboard`;
            } catch {
                status.textContent =
                    `✅ Done\n${response.data.length} events ready (clipboard blocked)`;
            }
        } else {
            status.textContent = "❌ Error: " + response.error;
        }
    });
});