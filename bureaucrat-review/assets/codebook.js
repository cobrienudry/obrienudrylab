// Codebook for the bureaucrat-review site. Edit here; bump CB_VERSION when categories change
// (the Google Sheet then starts new "positions <version>" / "persons <version>" tabs).
window.CB_VERSION = "v1";

// The review tasks. `file` is the encrypted data file in data/; `kind` picks the screen.
// double_pct: share of cases (by hash of the case id) that two RAs code independently.
window.TASKS = [
  { id: "mos_extract", kind: "extract", group: "MOS digitization", file: "mos_extract.bin", color: "--mos", n: 300, prefix: "X",
    title: "Extraction check (300 entries)",
    desc: "One MOS entry beside its scanned page. Check every field the pipeline extracted (country, title, amount, lender, agency, contact…) against what is printed.",
    double_pct: 15 },
  { id: "mos_pages", kind: "page", group: "MOS digitization", file: "mos_pages.bin", color: "--top", n: 120, prefix: "G",
    title: "Page completeness (120 pages)",
    desc: "A whole scanned page beside the rows the pipeline pulled from it. Mark fragments and garbage rows, and add entries the pipeline missed.",
    double_pct: 15 },
  { id: "mos_links", kind: "link", group: "MOS digitization", file: "mos_links.bin", color: "--li", n: 350, prefix: "L",
    title: "Linking across issues (350 pairs)",
    desc: "Two listings from different monthly issues. Are they the same project? This checks how projects are followed from month to month and year to year.",
    double_pct: 15 },
  { id: "linkedin", kind: "careers", group: "Bureaucrat careers", file: "linkedin.bin", color: "--li", n: 200, prefix: "P",
    title: "LinkedIn careers (200)",
    desc: "Check each job parsed from a LinkedIn PDF against what the PDF printed: employer, title, sector, role level, country and dates. Also check the identity match to the World Bank contact.",
    double_pct: 15, search: false },
  { id: "mos_random", kind: "careers", group: "Bureaucrat careers", file: "mos_random.bin", color: "--mos", n: 350, prefix: "M",
    title: "Careers of MOS contacts, random (350)",
    desc: "Random MOS contacts whose careers were researched on the web. Check the MOS and web positions, re-code what is wrong, search for and add missing jobs, and re-judge the identity match.",
    double_pct: 15, search: true },
  { id: "mos_top", kind: "careers", group: "Bureaucrat careers", file: "mos_top.bin", color: "--top", n: 500, prefix: "T",
    title: "Careers of MOS contacts, targeted (500)",
    desc: "The 500 most findable MOS contacts (mostly ministers and agency heads). Same work as the random sample: check, re-code, add missing jobs, re-judge identity.",
    double_pct: 15, search: true },
];

// ---------- MOS digitization ----------
// Fields checked in the extraction task: [field, label, what it should hold]. `long` fields scroll.
window.MOS_FIELDS = {
  country: ["Country", "Borrowing country (or region/grouping) heading the entry"],
  region: ["Region", "World Bank region heading. The pipeline canonicalises names (e.g. Western Hemisphere → Latin America and the Caribbean); a renamed region is correct"],
  sector: ["Sector", "Sector heading as printed. In 1955–1995 the pipeline infers it from keywords (often blank or guessed)"],
  listing_status: ["New / revised", "(N) → new, (R) → revised, nothing printed → empty"],
  project_title: ["Project title", "The project name only, without the description, loan numbers or contact names"],
  amount_raw: ["Amount", "Amount as printed in US$ millions, or e.g. “to be determined”"],
  funding_source: ["Lender", "IBRD (“Bank”), IDA, IBRD/IDA, GEF, Trust Fund… The pipeline writes “Bank” as IBRD; that is correct"],
  implementing_agency: ["Agency / borrower", "Implementing agency or borrower (paragraph era: with its address)"],
  description: ["Description", "Objective or components text", true],
  stage_of_processing: ["Stage of processing", "The “Stage of Processing / Action on Procurement” column", true],
  environmental_category: ["Env. category", "Environmental Assessment Category A, B, C, FI, U, TBD…"],
  pid: ["Project ID", "P###### code (or “PID: 12345”), if printed"],
  consulting_services: ["Consulting services", "The sentence about consultants", true],
  contact: ["Contact", "Tel / Fax / E-mail / named contact block", true],
};
window.ENTRY_TYPES = [
  ["real", "A real project entry", "a", "One complete project listing"],
  ["merged", "Two entries merged", "m", "This row mixes text from two or more listings"],
  ["fragment", "Fragment", "f", "Only a piece of a listing (e.g. a continuation line), not a project of its own"],
  ["garbage", "OCR garbage", "g", "Unreadable scramble or non-project text (headers, footnotes)"],
  ["not_found", "Can't find it on the page", "n", "The highlighted page doesn't contain this entry"],
];
window.FIELD_VERDICTS = [
  ["ok", "Correct", "a"],
  ["typos", "Right, minor OCR typos", "t"],
  ["fix", "Wrong: fix", "e"],
  ["blank", "Not printed", "x"],
];
window.ROW_VERDICTS = [
  ["real", "Real entry", "a"],
  ["fragment", "Fragment", "f"],
  ["merged", "Two merged", "m"],
  ["garbage", "Garbage", "g"],
  ["wrong_page", "Not on this page", "w"],
];
window.LINK_VERDICTS = [
  ["same", "Same project", "s"],
  ["different", "Different projects", "d"],
  ["unsure", "Can't tell", "u"],
];
window.LINK_REASONS = [
  ["pid", "Same project ID"], ["title", "Same or near-identical title"], ["agency", "Same agency"],
  ["amount", "Amounts consistent"], ["phase", "Different phase / number (II vs III)"],
  ["place", "Different place or sub-sector"], ["country", "Different country"], ["other", "Other (note)"],
];

window.SECTORS = [
  ["GOVN", "Government, national", "Ministries, central agencies, central banks, regulators, courts, foreign service"],
  ["GOVS", "Government, subnational", "State, provincial, municipal government"],
  ["GOVX", "Government, level unclear", ""],
  ["SOE", "State-owned enterprise", "Incl. public banks and utilities"],
  ["PIU", "Project implementation unit", "Borrower-side unit running a donor-financed project"],
  ["LEG", "Legislature / party", "Elected office, legislature, party office"],
  ["WBG", "World Bank Group", ""],
  ["IO", "Other international org", "UN, ADB, AfDB, IDB, SADC, UEMOA…"],
  ["BIL", "Bilateral donor", "USAID, GIZ, MCC, DFAT…"],
  ["NGO", "NGO / foundation", "Non-profit, foundation, association (IUCN = NGO)"],
  ["ACAD", "Academia / think tank", ""],
  ["PRIV", "Private firm", ""],
  ["CONS", "Consulting / self-employed", ""],
  ["UNK", "Unknown", ""],
];

window.ROLE_LEVELS = [
  ["1", "Political executive", "Minister, deputy minister, state secretary, cabinet-rank head, governor, mayor, central-bank governor"],
  ["2", "Head of org / top civil servant", "Permanent secretary, DG of an agency, CEO, MD, president"],
  ["3", "Director / senior manager", "Department head, project director, national project coordinator"],
  ["4", "Manager / coordinator", "Mid-level"],
  ["5", "Professional / specialist", "Adviser, consultant, officer"],
  ["6", "Academic / researcher", ""],
  ["7", "Junior / trainee / student", ""],
  ["8", "Board / council member", "Non-executive"],
  ["9", "Legislator / party office", ""],
  ["0", "Unclassifiable", ""],
];

// Identity match: is the person whose career we coded the same person as the World Bank / MOS contact?
window.IDENTITY = {
  linkedin: [
    ["confirmed", "Confirmed", "Profile clearly matches the WB contact (same project, agency or post)"],
    ["probable", "Probable", "Consistent, but no direct link (e.g. right agency and period, post undated)"],
    ["uncertain", "Uncertain", "Can't tell either way"],
    ["likely_mismatch", "Likely mismatch", "Probably a different person with the same name"],
    ["confirmed_wb_staff", "WB staff", "The contact is World Bank staff, not a counterpart"],
    ["no_wb_record", "No WB record", "No World Bank contact record to compare with"],
  ],
  mos: [
    ["confirmed", "Confirmed", "Web/LinkedIn career clearly belongs to the MOS contact"],
    ["probable", "Probable", "Consistent, but no direct link"],
    ["uncertain", "Uncertain", "Can't tell either way"],
    ["likely_mismatch", "Likely mismatch", "The web career belongs to a namesake"],
    ["confirmed_wb_staff", "WB staff", "The contact is World Bank staff"],
    ["mos_only", "MOS only", "Nothing found beyond the MOS listings"],
  ],
};

window.DROP_REASONS = [
  ["wrong_person", "Wrong person (namesake)"],
  ["duplicate", "Duplicate of another row"],
  ["not_a_job", "Not a job (degree, award, membership)"],
  ["unsupported", "Source does not support it"],
  ["other", "Other (say in note)"],
];

// MOS tasks only: how far the RA got in searching for missing positions.
window.COMPLETENESS = [
  ["added", "Added missing jobs", "I searched and added at least one position"],
  ["searched_none", "Searched, nothing new", "I searched and found nothing to add"],
  ["looks_complete", "Looks complete", "The career already looks complete; I did not search much"],
  ["not_searched", "Did not search", "I only checked the existing rows"],
];

window.SOURCE_TYPES = {
  linkedin: "LinkedIn", web: "Web", wb_document: "WB document", mos: "MOS",
  s200_linkedin: "LinkedIn (sample200)", s200_web: "Web (sample200)", s200_wb_document: "WB doc (sample200)", added: "Added by RA",
};
