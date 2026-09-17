# Full-product QA UI acceptance standard

This request supersedes older guidance calling for semibold operational text.
Preserve approved `public/images/NegOSu_logo_dark.png` and light logo assets.
Preserve literal NegOSu casing, including computed text transformation.

- Regular body, field, status, navigation and table text; medium titles and primary actions at most. No uppercase operational labels.
- Existing neutral surface, border, radius and subtle shadow tokens; semantic color only for actual status. Preserve the five workspace palettes.
- Use existing Button, Input, Card, Tabs, RecordTable, FormActions and FormDialog. Native navigation links, visible focus, accessible names and scoped semantic IDs.
- One main page scroll; bounded modal body and intentional calendar/table horizontal scrolling are exceptions. No clipping to conceal overflow.
- Keep Cancel/Close and primary submit visible; preserve drafts on errors, filters on return, and disable duplicate submissions while pending.
- Currency follows the authoritative record/organization. Missing values differ from zero. Date-only values remain calendar dates; timestamps use the business timezone. State labels preserve domain meaning.
- Automotive: Customer/Vehicle/Job Order; Salon: Client/Service or Treatment/Staff; Pet Care: Pet Owner/Pet/Grooming; Hospitality: Guest/Room/Stay.
- Verify computed styles and actual screenshots at 320×740, 375×812, 390×844, 430×932, 768×1024, 1366×768 and 1440×900. Emulation is not real-device or virtual-keyboard evidence.

Implementation proceeds through shared primitives and focused consuming surfaces. An entry in this standard is an acceptance criterion, not a claim of completed coverage.
