import json
from html import unescape

# Load JSON from file
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

def clean_text(text):
    return unescape(text).strip()

# Print header (Excel-style)
print(
    "Date & Time\t"
    "Event Name\t"
    "Location\t"
    "Additional Info\t"
    "Remaining Requirement"
)

# Print rows
for event in events:
    date_time = f"{event['date']} {event['start']}–{event['finish']}"
    event_name = clean_text(event.get("eventName", ""))
    location = clean_text(event.get("location", ""))
    additional_info = ""  # intentionally blank
    remaining = remaining_requirement(event.get("resources", {}))

    print(
        f"{date_time}\t"
        f"{event_name}\t"
        f"{location}\t"
        f"{additional_info}\t"
        f"{remaining}"
    )