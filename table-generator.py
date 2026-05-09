import json

# Load JSON (replace this with reading from a file if needed)
with open("events.json", "r", encoding="utf-8") as f:
    events = json.load(f)

def build_remaining_requirement(resources):
    parts = []
    for role, count in resources.items():
        try:
            count = int(count)
        except ValueError:
            continue
        if count > 0:
            parts.append(f"{count}x {role}")
    return ", ".join(parts)

def extract_location(event):
    """
    Best-effort location extraction:
    Remove event name and trailing '- REQ' from details.
    """
    details = event.get("details", "")
    name = event.get("eventName", "")
    location = details.replace(name, "").replace(" - REQ", "")
    return location.strip()

# Table header
print("| Date & Time | Event Name | Location | Additional Info | Remaining Requirement |")
print("|---|---|---|---|---|")

# Table rows
for event in events:
    date_time = f"{event['date']} {event['start']}–{event['finish']}"
    event_name = event.get("eventName", "")
    location = extract_location(event)
    additional_info = ""
    remaining_req = build_remaining_requirement(event.get("resources", {}))

    print(
        f"| {date_time} | {event_name} | {location} | {additional_info} | {remaining_req} |"
    )
