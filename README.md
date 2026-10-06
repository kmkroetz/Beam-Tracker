# Machine Service Log v0.2

V0.2 adds editable inspection templates and links them to model presets.

## Main features
- Machine/unit history
- Service visits and labor hours
- Manufacturer, machine type, company and model presets
- Model auto-fill rules
- Inspection template builder
- Inspection results saved with each service visit
- Inspection result history shown on the machine record
- PWA install support

## How to use
1. Open `index.html` in Chrome.
2. Go to **Inspections** and create the inspection sheet used for a machine.
3. Go to **Presets** and create a model rule, such as `S26 -> Husqvarna -> Concrete Saw -> S26 Inspection`.
4. Start a new service and type `S26`. The related fields and inspection template will load.
5. Record inspection results, labor and work performed, then save.

Data is stored in browser local storage for this prototype. Existing V0.1 local data is migrated when the app first opens.
