# Beam Tracker V0.4.1

- Persistent machine status: Received, Inspection, Maintenance, Waiting for Parts, Ready, Complete, Out of Service.
- Change status directly from a machine record.
- Select an inspection template manually for a service visit.
- Model auto-fill still selects the default inspection template.
- Manual inspection selection overrides the model default.
- Inspection items support checkbox, Needs Repair, N/A, and details.
- Inspection results and selected template are saved with each service visit.
- Data remains in browser local storage for this prototype.


## V0.4.1
- Inspections can be saved partially and continued later.
- Inspection progress shows Not Started, In Progress, or Complete with item counts.
- Service history includes a Continue Inspection button for unfinished inspections.
- Continuing an inspection updates the original service visit instead of creating a duplicate visit.
