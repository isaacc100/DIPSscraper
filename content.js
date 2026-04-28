(() => {
	const RESOURCE_NAMES = ["CDT", "FA", "CFA", "AFA", "ER", "CREW", "HCP", "FATC", "AMB"];

	function extractDataFromDoc(doc) {
		const table = doc.querySelector('table[border="1"].normal');
		if (!table) return [];

		const rows = Array.from(table.querySelectorAll("tr"));
		const results = [];
		let currentDate = "";

		rows.forEach(row => {
			const dateCell = row.querySelector('td[bgcolor="#CCFFCC"]');
			if (dateCell) {
				currentDate = dateCell.textContent.trim();
				return;
			}

			const cells = Array.from(row.cells);
			const refOnClick = cells[0]?.getAttribute("onclick") || "";

			if (cells.length >= 10 && refOnClick.startsWith("SE")) {
				const eventData = {
					date: currentDate,
					ref: cells[0].textContent.trim(),
					details: (cells[1]?.textContent || "").trim().replace(/\s+/g, " "),
					start: (cells[3]?.textContent || "").trim(),
					finish: (cells[4]?.textContent || "").trim(),
					resources: {}
				};

				RESOURCE_NAMES.forEach((name, index) => {
					const cellIndex = 5 + index;
					eventData.resources[name] = (cells[cellIndex]?.textContent || "").trim() || "0";
				});

				results.push(eventData);
			}
		});

		return results;
	}

	async function scrapeAllPages() {
		const pageLinks = Array.from(document.querySelectorAll('a[href*="page="]'))
			.filter(a => /^\d+$/.test((a.textContent || "").trim()));

		const uniquePageNumbers = new Set(pageLinks.map(a => (a.textContent || "").trim()));

		const urlParams = new URLSearchParams(window.location.search);
		const currentPage = urlParams.get("page") || "0";
		uniquePageNumbers.add(currentPage);

		const allPages = Array.from(uniquePageNumbers).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
		let allResults = [];

		const sleep = ms => new Promise(res => setTimeout(res, ms));

		for (const pageNum of allPages) {
			const fetchUrl = new URL(window.location.href);
			fetchUrl.searchParams.set("page", pageNum);

			const response = await fetch(fetchUrl.toString());
			if (!response.ok) {
				throw new Error(`Failed to fetch page ${pageNum}: ${response.status}`);
			}

			const html = await response.text();
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			const pageData = extractDataFromDoc(doc);
			allResults = allResults.concat(pageData);

			await sleep(200);
		}

		return allResults;
	}

	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if (message?.action !== "scrape") {
			return;
		}

		scrapeAllPages()
			.then(results => {
				sendResponse({ success: true, data: results });
			})
			.catch(error => {
				sendResponse({
					success: false,
					error: error instanceof Error ? error.message : String(error)
				});
			});

		// Keep the response channel open for async completion.
		return true;
	});
})();