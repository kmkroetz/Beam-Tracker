# Beam Tracker V0.3

V0.3 is based directly on the working V0.2 files.

## V0.3 changes
- Fixed JavaScript initialization bug that could make all buttons appear unresponsive on a fresh browser.
- Inspection items now have checkboxes.
- Each inspection item has a details/notes box.
- Needs Repair and N/A can still be marked when applicable.
- Inspection results remain attached to the service visit and appear in machine history.
- Browser local storage remains the data store for this prototype.

## How to use
1. Open `index.html` in Chrome or deploy the folder to GitHub Pages.
2. Create an inspection template.
3. Create a model rule, such as `S26 -> Husqvarna -> Concrete Saw -> S26 Inspection`.
4. Start a new service and type `S26`.
5. Complete the inspection, enter details where needed, record labor/work performed, and save.

No Firebase connection is required for this version.
