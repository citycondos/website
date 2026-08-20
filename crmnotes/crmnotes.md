# Transparent form embeds

Administer -> Theme Settings
Clone (Copy and Edit) Minetta
Enter this Advanced CSS for both Darkmode and Lightmode:
```
.crm-container { background-color: rgba(0,0,0,0); --crm-f-fieldset-bg-color: rgba(0,0,0,0); }
.af-container { --crm-f-fieldset-bg-color: rgba(0,0,0,0); }
```

# Custom Event Type

Create new event type for Move.

# Custom Field on Participant Type
Make sure field is for Participant for Move Slot events.

Add field for Move Type (radio) + Move Notes.

# Profile

Create a new one and add all the custom fields. Remember to set things as required.

# Profile permissions
Administer -> Users & Permissions -> User Permissions

Everyone needs:
access all custom data
profile create
register for events

# Event Template

Make sure it's open to the public.
Add the notification to the Building Manager.

# Event

Add Move Slot events - AM & PM need to be separate. Make sure you use the template and set recurrence.
Need to skip public holidays.

# Search for Events

Create a Search -> SearchBuilder.
Query Start Date, End Date ID
Filter Remaining Participants > 0, Enabled = Yes, Start Date >= After Now 23 Hours, Start Date <= After Now 60 Days,
Event Type = Move Booking.

Need to create a Table Display with Bypass permissions.
Set links on Table display to hide controls + have link to public event URL (get from Event screen, but template the Event ID).
Create afform linked to display (not search or bypass won't work).
