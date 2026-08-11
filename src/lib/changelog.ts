// The app's user-facing changelog. This is the single source of truth for the
// "What's new" dialog that greets users after an update ships.
//
// HOW TO RELEASE A CHANGELOG ENTRY
// --------------------------------
// When you ship something users should know about, add a new object to the TOP
// of CHANGELOG (newest first) with a fresh `version`. That's it — on their next
// visit, every user who hasn't acknowledged that version sees it in the dialog,
// and the header "What's new" button gets a dot until they open it.
//
// `version` must be unique and ordered newest-first by array position (the
// dialog compares by position, not by parsing the string, so any consistent,
// human-readable scheme works — we use YYYY.MM.DD, suffixing -2, -3 for a second
// release on the same day). Keep entries short and written for a non-technical
// reader: what changed and why it helps them.

export type ChangelogTag = "new" | "improved" | "fixed";

export interface ChangelogItem {
  tag: ChangelogTag;
  text: string;
}

export interface ChangelogEntry {
  /** Unique, ordered newest-first by array position. e.g. "2026.07.15". */
  version: string;
  /** ISO date (YYYY-MM-DD) shown in the dialog. */
  date: string;
  /** Short headline for this release. */
  title: string;
  items: ChangelogItem[];
}

// Newest entry first. Add new releases at the top.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2026.08.11-2",
    date: "2026-08-11",
    title: "Demand-for-space charts on the dashboard",
    items: [
      {
        tag: "new",
        text:
          "The dashboard has two new charts showing what kind of space our prospects are after. \"Existing-space demand\" groups projects that want an existing building by square footage; \"Greenfield demand\" groups projects that want land by acreage. A project lands in one chart or the other based on its existing-building preference, and both respond to the filters at the top of the page. Projects with no existing-building preference recorded are noted below the charts.",
      },
    ],
  },
  {
    version: "2026.08.11",
    date: "2026-08-11",
    title: "A refreshed look across the app",
    items: [
      {
        tag: "improved",
        text:
          "The whole app has a cleaner, more modern look: a light neutral background with white cards, and HCEDP green used as a highlight for buttons, links, and the active menu item. Every screen (pipeline, sites, leads, dashboard, reports, intake, project pages, and Placer requests) now shares the same style, so things feel consistent wherever you are.",
      },
      {
        tag: "new",
        text:
          "Navigation moved to a sidebar on the left, so every area is one click away and there's more room for the board and tables. It shrinks to just icons on smaller screens.",
      },
      {
        tag: "new",
        text:
          "The Pipeline now has a Table view alongside the board. Use the Board / Table toggle at the top left: the board is best for moving projects between stages, the table is best for sorting and scanning many projects at once. Your filters and search apply to both, and your choice is remembered.",
      },
    ],
  },
  {
    version: "2026.08.10",
    date: "2026-08-10",
    title: "Add Placer requests yourself",
    items: [
      {
        tag: "new",
        text:
          "You can now add a Placer AI request straight from the Placer Requests board with the \"Add request\" button. Use it to log requests that came in by phone or email, or to seed ones a city sent before it had a login. Pick the city, and set a starting status if it's already underway or finished.",
      },
    ],
  },
  {
    version: "2026.07.15",
    date: "2026-07-15",
    title: "What's new, and a tidier pipeline",
    items: [
      {
        tag: "new",
        text:
          "This dialog. Whenever we ship an update, you'll see a short list of what changed the next time you open the app. You can reopen it anytime from the \"What's new\" button in the top bar.",
      },
      {
        tag: "fixed",
        text:
          "The \"sites submitted\" count on a pipeline card no longer spills past the edge of the card when a project also has a long date label.",
      },
    ],
  },
];

/** The version users are brought up to date with when they dismiss the dialog. */
export const CURRENT_VERSION = CHANGELOG[0]?.version ?? "";

// Entries newer than the one the user last acknowledged, newest first. A null
// (never dismissed) or unrecognized `seen` value yields the whole changelog.
export function entriesNewerThan(seen: string | null | undefined): ChangelogEntry[] {
  if (!seen) return CHANGELOG;
  const idx = CHANGELOG.findIndex((e) => e.version === seen);
  if (idx === -1) return CHANGELOG;
  return CHANGELOG.slice(0, idx);
}
