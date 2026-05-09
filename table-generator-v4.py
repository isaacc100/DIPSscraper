import json
import csv
from html import unescape

# Load JSON
with open("events.json", "r", encoding="utf-8") as f:
    events = json.load(f)

def remaining_requirement(resources):
    parts = []
    for role, count in resources.items():
        try:
            count = int(count)
        except ValueError:
            continue
        if count > 0:
            parts.append(f"{count}× {role}")
    return ", ".join(parts)

def clean(text):
    return unescape(text).strip()

# Write CSV
with open("events.csv", "w", newline="", encoding="utf-8") as csvfile:
    writer = csv.writer(csvfile)

    # Header row
    writer.writerow([
        "Date & Time",
        "Event Name",
        "Location",
        "Additional Info",
        "Remaining Requirement"
    ])

    # Data rows
    for event in events:
        date_time = f"{event['date']} {event['start']}–{event['finish']}"
        event_name = clean(event.get("eventName", ""))
        location = clean(event.get("location", ""))
        additional_info = ""  # intentionally blank
        remaining = remaining_requirement(event.get("resources", {}))

        writer.writerow([
            date_time,
            event_name,
            location,
            additional_info,
            remaining
        ])