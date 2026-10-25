// Helpers for working with parsed JSON-LD nodes.

export type JsonLdNode = Record<string, unknown>;

export function isNode(v: unknown): v is JsonLdNode {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Schema.org types of a node, with any schema.org URL prefix stripped. */
export function typesOf(node: JsonLdNode): string[] {
  const t = node["@type"];
  const arr = Array.isArray(t) ? t : t === undefined ? [] : [t];
  return arr
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/^https?:\/\/schema\.org\//i, "").replace(/^schema:/i, ""));
}

const ORG_EXACT = new Set([
  "Organization", "Corporation", "LocalBusiness", "NGO", "OnlineBusiness", "OnlineStore", "Airline",
  "Consortium", "EducationalOrganization", "CollegeOrUniversity", "School", "ElementarySchool",
  "HighSchool", "MiddleSchool", "Preschool", "GovernmentOrganization", "LibrarySystem",
  "MedicalOrganization", "Hospital", "Pharmacy", "Physician", "Dentist", "DiagnosticLab",
  "ResearchOrganization", "SportsOrganization", "SportsTeam", "WorkersUnion", "NewsMediaOrganization",
  "PerformingGroup", "Store", "Restaurant", "FoodEstablishment", "CafeOrCoffeeShop", "Bakery",
  "BarOrPub", "Hotel", "LodgingBusiness", "ProfessionalService", "LegalService", "Attorney", "Notary",
  "AccountingService", "FinancialService", "BankOrCreditUnion", "InsuranceAgency", "RealEstateAgent",
  "AutoRepair", "AutoDealer", "AutoPartsStore", "HealthAndBeautyBusiness", "BeautySalon", "HairSalon",
  "DaySpa", "HealthClub", "SportsActivityLocation", "TravelAgency", "EmploymentAgency", "Library",
  "MovingCompany", "Plumber", "Electrician", "RoofingContractor", "HVACBusiness", "HomeAndConstructionBusiness",
  "GeneralContractor", "Locksmith", "HousePainter", "ShoppingCenter", "ClothingStore", "ElectronicsStore",
  "FurnitureStore", "GroceryStore", "HardwareStore", "JewelryStore", "BookStore", "PetStore", "Florist",
  "MedicalClinic", "VeterinaryCare", "Optician", "Hostel", "Motel", "BedAndBreakfast", "Resort",
  "EntertainmentBusiness", "ChildCare", "SelfStorage", "TattooParlor", "Brewery", "Winery", "Distillery",
]);

const ORG_SUFFIX = /.+(Store|Shop|Restaurant|Service|Clinic|Salon|Business|Organization|Agency|Dealer|Repair|Studio|Contractor)$/;

/** A type that names a business or organisation (not a person, page or product). */
export function isOrgType(t: string): boolean {
  return ORG_EXACT.has(t) || ORG_SUFFIX.test(t);
}

const GENERIC_ORG = new Set(["Organization", "Corporation", "NGO", "NewsMediaOrganization", "OnlineBusiness", "OnlineStore", "EducationalOrganization", "GovernmentOrganization", "ResearchOrganization", "Consortium", "PerformingGroup"]);

/** A type for a business with a physical presence (not just a generic organisation). */
export function isLocalType(t: string): boolean {
  return isOrgType(t) && !GENERIC_ORG.has(t);
}

export function isOrgNode(n: JsonLdNode): boolean {
  return typesOf(n).some(isOrgType);
}

export function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (isNode(v)) {
    for (const key of ["name", "url", "@id", "contentUrl"]) {
      const s = asString(v[key]);
      if (s) return s;
    }
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = asString(item);
      if (s) return s;
    }
  }
  return null;
}

export function asStringArray(v: unknown): string[] {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => asString(x)).filter((x): x is string => !!x);
}

/** Logo URL from a string or an ImageObject. */
export function logoUrl(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) return v.map(logoUrl).find(Boolean) ?? null;
  if (isNode(v)) return asString(v.url) ?? asString(v.contentUrl) ?? asString(v["@id"]);
  return null;
}

export function hasValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.some(hasValue);
  if (isNode(v)) return Object.keys(v).some((k) => !k.startsWith("@") || k === "@id") && Object.keys(v).length > 0;
  return true;
}

/** Strip the schema.org prefix from a microdata itemtype URL. */
export function shortType(itemtype: string): string {
  return itemtype.replace(/^https?:\/\/schema\.org\//i, "").trim();
}
