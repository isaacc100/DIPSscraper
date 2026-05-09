(function () {
  const DEFAULT_RESOURCE_NAMES = ["CDT", "FA", "CFA", "AFA", "ER", "CREW", "HCP", "FATC", "AMB"];

  function decodeInlinePayload() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const encoded = hash.get("data");
    if (!encoded) return null;

    try {
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json);
    } catch (error) {
      console.error("Unable to decode poster payload", error);
      return null;
    }
  }

  async function loadPayload() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const key = hash.get("key");

    if (key && typeof chrome !== "undefined" && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get(key);
        if (stored?.[key]) {
          return stored[key];
        }
      } catch (error) {
        console.error("Unable to load stored poster payload", error);
      }
    }

    return decodeInlinePayload();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseDisplayDate(dateText) {
    if (!dateText) return null;

    const direct = new Date(dateText);
    if (!Number.isNaN(direct.getTime())) return direct;

    const parts = dateText.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!parts) return null;

    const day = Number(parts[1]);
    const month = Number(parts[2]) - 1;
    const year = Number(parts[3].length === 2 ? `20${parts[3]}` : parts[3]);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function parseTimeMinutes(value) {
    const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
    if (!match) return Number.MAX_SAFE_INTEGER;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function isoWeekNumber(date) {
    const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    return Math.ceil((((copy - yearStart) / 86400000) + 1) / 7);
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short"
    }).format(date);
  }

  function formatDateTimeLabel(event) {
    const parsed = parseDisplayDate(event.date);
    const dateLabel = parsed ? formatDate(parsed) : (event.date || "Date unavailable");
    const start = event.start || "--";
    const finish = event.finish || "--";
    return `${dateLabel} | ${start}-${finish}`;
  }

  function getResourceTotals(events, names) {
    const totals = Object.fromEntries(names.map(name => [name, 0]));
    events.forEach(event => {
      names.forEach(name => {
        totals[name] += toInt(event.resources?.[name]);
      });
    });
    return totals;
  }

  function getPriorityClass(totalRemaining) {
    if (totalRemaining >= 6) return "high";
    if (totalRemaining >= 3) return "medium";
    return "low";
  }

  function getLocation(event) {
    return event.location || event.place || event.venue || "Not provided in scrape";
  }

  function getAdditionalInfo(event) {
    const extra = [];
    if (event.ref) extra.push(`Ref ${event.ref}`);
    if (event.additionalInfo) extra.push(event.additionalInfo);
    if (event.details && event.details !== event.eventName) extra.push(event.details);
    return extra.join(" | ") || "No extra notes";
  }

  function buildRows(events, resourceNames) {
    return events.map(event => {
      const remaining = resourceNames.reduce((sum, name) => sum + toInt(event.resources?.[name]), 0);
      const priorityClass = getPriorityClass(remaining);
      const requirementSummary = resourceNames
        .map(name => ({ name, count: toInt(event.resources?.[name]) }))
        .filter(item => item.count > 0);

      const requirementText = requirementSummary.length
        ? requirementSummary.map(item => `${item.name} ${item.count}`).join(", ")
        : "No remaining requirement shown";

      const chips = requirementSummary.length
        ? requirementSummary
            .map(item => `<span class="resource-chip">${escapeHtml(item.name)} ${item.count}</span>`)
            .join("")
        : `<span class="resource-chip">No requirement listed</span>`;

      return `
        <tr>
          <td class="date-cell" data-label="Date & Time">
            <strong>${escapeHtml(formatDateTimeLabel(event))}</strong>
            <span class="muted">${escapeHtml(event.date || "")}</span>
          </td>
          <td data-label="Event Name">
            <strong>${escapeHtml(event.eventName || event.details || "Unnamed event")}</strong>
            <span class="muted">${escapeHtml(event.ref || "")}</span>
          </td>
          <td data-label="Location">${escapeHtml(getLocation(event))}</td>
          <td data-label="Additional Info">${escapeHtml(getAdditionalInfo(event))}</td>
          <td data-label="Remaining Requirement">
            <div class="requirement-pill ${priorityClass}">${remaining} remaining</div>
            <div class="muted" style="margin-bottom:8px">${escapeHtml(requirementText)}</div>
            <div class="resource-list">${chips}</div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderTable(events, resourceNames) {
    const host = document.getElementById("tableHost");
    if (!events.length) {
      host.innerHTML = `
        <div class="empty-state">
          No events were included in this sheet. Scrape a DIPS listing first, then open the filled poster again.
        </div>
      `;
      return;
    }

    host.innerHTML = `
      <table aria-label="Event staffing table">
        <thead>
          <tr>
            <th style="width:18%">Date &amp; Time</th>
            <th style="width:24%">Event Name</th>
            <th style="width:16%">Location</th>
            <th style="width:20%">Additional Info</th>
            <th style="width:22%">Remaining Requirement</th>
          </tr>
        </thead>
        <tbody>${buildRows(events, resourceNames)}</tbody>
      </table>
    `;
  }

  function sortEvents(events) {
    return [...events].sort((a, b) => {
      const dateA = parseDisplayDate(a.date);
      const dateB = parseDisplayDate(b.date);
      const timeA = parseTimeMinutes(a.start);
      const timeB = parseTimeMinutes(b.start);

      if (dateA && dateB && dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      return timeA - timeB;
    });
  }

  function renderTopRequirements(roleTotals) {
    const list = document.getElementById("topRequirementsList");
    const entries = Object.entries(roleTotals)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    list.innerHTML = entries.length
      ? entries.map(([name, count]) => `<li>${escapeHtml(name)}: ${count} remaining</li>`).join("")
      : "<li>No outstanding role counts were scraped.</li>";
  }

  function renderSummary(payload, events, roleTotals, dates) {
    const totalRemaining = Object.values(roleTotals).reduce((sum, count) => sum + count, 0);
    const highPriority = events.filter(event => {
      const total = Object.values(event.resources || {}).reduce((sum, count) => sum + toInt(count), 0);
      return total >= 6;
    }).length;

    const topRoleEntry = Object.entries(roleTotals)
      .sort((a, b) => b[1] - a[1])[0];

    document.getElementById("summaryEvents").textContent = String(events.length);
    document.getElementById("summaryRemaining").textContent = String(totalRemaining);
    document.getElementById("summaryHighPriority").textContent = String(highPriority);
    document.getElementById("summaryTopRole").textContent = topRoleEntry && topRoleEntry[1] > 0 ? topRoleEntry[0] : "--";
    document.getElementById("summaryTopRoleCount").textContent =
      topRoleEntry && topRoleEntry[1] > 0 ? `${topRoleEntry[1]} remaining across the sheet` : "No requirement data";

    if (dates.length) {
      document.getElementById("summaryRange").textContent = `${formatShortDate(dates[0])} - ${formatShortDate(dates[dates.length - 1])}`;
    }

    const weeks = [...new Set(dates.map(isoWeekNumber))];
    const years = [...new Set(dates.map(date => date.getFullYear()))];
    document.getElementById("heroYear").textContent = years.length ? years.join(" / ") : String(new Date().getFullYear());
    document.getElementById("heroWeeks").textContent = weeks.length ? `Weeks ${weeks.join(" & ")}` : "Weeks -- & --";

    const releaseDate = payload.releaseDate || new Date().toLocaleString("en-GB");
    document.getElementById("releaseDate").textContent = releaseDate;
    document.getElementById("sourceLabel").textContent = payload.sourceLabel || "DIPS";
    document.getElementById("windowLabel").textContent =
      payload.windowLabel || (dates.length ? `${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])}` : "No valid dates detected");
  }

  function attachActions(payload) {
    document.getElementById("printBtn").addEventListener("click", () => window.print());
    document.getElementById("copyJsonBtn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        document.getElementById("copyJsonBtn").textContent = "Copied";
        setTimeout(() => {
          document.getElementById("copyJsonBtn").textContent = "Copy data";
        }, 1500);
      } catch (error) {
        console.error("Unable to copy data", error);
      }
    });
  }

  async function render() {
    const payload = (await loadPayload()) || { events: [] };
    const resourceNames = payload.resourceNames?.length ? payload.resourceNames : DEFAULT_RESOURCE_NAMES;
    const events = sortEvents(payload.events || []);
    const dates = events
      .map(event => parseDisplayDate(event.date))
      .filter(Boolean);
    const roleTotals = getResourceTotals(events, resourceNames);

    if (payload.title) document.title = payload.title;
    if (payload.brand) document.getElementById("brand").textContent = payload.brand;
    if (payload.title) {
      const titleLine = document.getElementById("titleLine");
      if (titleLine) titleLine.textContent = payload.title;
    }
    if (payload.subtitle) {
      const parts = String(payload.subtitle).split(/(?<=\.)\s+/).filter(Boolean);
      const line1 = document.getElementById("subtitleLine1");
      const line2 = document.getElementById("subtitleLine2");
      if (line1) line1.textContent = parts[0] || payload.subtitle;
      if (line2) line2.textContent = parts.slice(1).join(" ") || "";
    }
    if (payload.bookingNotes) document.getElementById("bookingNotes").textContent = payload.bookingNotes;
    if (payload.footerLeft) {
      const footerLeft = document.getElementById("footerLeft");
      if (footerLeft) footerLeft.textContent = payload.footerLeft;
    }
    if (payload.footerRight) {
      const footerRight = document.getElementById("footerRight");
      if (footerRight) footerRight.textContent = payload.footerRight;
    }
    const sourceShell = document.getElementById("sourceLabelShell");
    if (sourceShell) sourceShell.textContent = payload.sourceLabel || "DIPS";
    const releaseShell = document.getElementById("releaseDateShell");
    if (releaseShell) releaseShell.textContent = payload.releaseDate || new Date().toLocaleString("en-GB");

    renderSummary(payload, events, roleTotals, dates);
    renderTable(events, resourceNames);
    renderTopRequirements(roleTotals);
    attachActions(payload);
  }

  render();
})();
