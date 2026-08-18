# Transparent form embeds

Administer -> Theme Settings
Clone (Copy and Edit) Minetta
Enter this Advanced CSS for both Darkmode and Lightmode:
```
.crm-container { background-color: rgba(0,0,0,0); }
.af-container { --crm-f-fieldset-bg-color: rgba(0,0,0,0); }
```

# Activity notifications

Create a Scheduled Reminder and set it to send to the Assignee when activities
of the form type are created.

Don't try sending to a custom contact - for Activities that's hard-coded to
filter to contacts on the activities (it does work for some other entity types).

Add an Assignee field to the FormBuilder form that creates the activity, and mark it has
hidden, required, and defaulting to the contacts that should receive the notification.

# Custom Field on Activity Type
Move Type
Move Event Booked (event type)

# Event

Create new event type for Move.
Add Move Slot events - AM & PM need to be separate.

Create a Search -> SearchBuilder.
Query Start Date, End Date ID
Filter Remaining Participants > 0, Enabled = Yes, Start Date >= After Now 23 Hours, Start Date <= After Now 60 Days,
Event Type = Move Booking.

Need to create a Table Display with Bypass permissions.
Create afform linked to display (not search or bypass won't work).
