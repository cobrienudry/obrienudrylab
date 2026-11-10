// Codebook for the bureaucrat-review site. Edit here; bump CB_VERSION when categories change
// (the Google Sheet then starts new "positions <version>" / "persons <version>" tabs).
window.CB_VERSION = "v1";

// The three review tasks. `file` is the encrypted data file in data/.
// double_pct: share of cases (by hash of the case id) that two RAs code independently.
window.TASKS = [
  { id: "linkedin", file: "linkedin.bin", color: "--li", title: "LinkedIn careers (200)",
    desc: "Check each job parsed from a LinkedIn PDF against what the PDF printed: employer, title, sector, role level, country and dates. Also check the identity match to the World Bank contact.",
    double_pct: 15, search: false },
  { id: "mos_random", file: "mos_random.bin", color: "--mos", title: "MOS random sample (350)",
    desc: "Random MOS contacts whose careers were researched on the web. Check the MOS and web positions, re-code what is wrong, search for and add missing jobs, and re-judge the identity match.",
    double_pct: 15, search: true },
  { id: "mos_top", file: "mos_top.bin", color: "--top", title: "MOS targeted set (500)",
    desc: "The 500 most findable MOS contacts (mostly ministers and agency heads). Same work as the random sample: check, re-code, add missing jobs, re-judge identity.",
    double_pct: 15, search: true },
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
