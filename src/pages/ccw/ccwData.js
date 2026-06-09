// CCW Reciprocity Data
// Source: handgunlaw.us/states/USStatesThatHonorMyPermit.pdf
// Last verified: April 18, 2026
// Updated by: PostCommand CCW Monitor (monthly)
// LEGAL DISCLAIMER: This data is for reference only. Laws change.
// Always verify with destination state authorities before carrying.

// PERMITLESS CARRY STATES (as of March 20, 2026)
// Source: handgunlaw.us/documents/Permitless_Carry_States.pdf
// AL, AK, AZ, AR, FL, GA, ID, IN, IA, KS, KY, LA, ME, MS, MO, MT,
// NE, NH, ND, OH, OK, SC, SD, TN, TX, UT, VT, WV, WY

// NOTES FROM SOURCE:
// CO, FL, ME, MI, NH, ND, PA, SC only honor RESIDENT permits
// from the states they honor.
// superscript 2 in source = resident permits only
// MD honors ZERO out-of-state permits

export const DATA_META = {
  source: 'handgunlaw.us',
  sourceUrl: 'https://handgunlaw.us/states/USStatesThatHonorMyPermit.pdf',
  lastVerified: '2026-04-18',
  nextReview: '2026-05-18',
  disclaimer: 'Data sourced from Handgunlaw.us, referenced by law enforcement attorneys. Reviewed monthly. Laws change — always verify with the destination state\'s official authority before carrying. This is not legal advice. PostCommand assumes no liability for accuracy.'
}

// honoredBy = states that honor THIS state's permit
// honors = states whose permit THIS state honors
// constitutionalCarry = permitless carry allowed
// residentsOnly = some honoring states only accept resident permits

export const CCW_DATA = {
  AL: {
    name: 'Alabama', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MS','MO','MT','NH','NC','ND','OH','OK','PA','SD','TN','TX','UT','VT','VA','WV','WI','WY'],
    honors: ['AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MS','MO','MT','NH','NC','ND','OH','OK','PA','SD','TN','TX','UT','VT','VA','WV','WI','WY'],
    permitRequired: false, openCarry: true, minAge: 19, redFlagLaw: false,
    officialSource: 'https://www.alea.gov/sbi/firearms-unit'
  },
  AK: {
    name: 'Alaska', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://dps.alaska.gov/statewide/permitslicensing/firearms'
  },
  AZ: {
    name: 'Arizona', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NE','NH','NM','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NE','NH','NM','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://azdps.gov/services/public/concealed_weapons'
  },
  AR: {
    name: 'Arkansas', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NM','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NM','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://www.dfa.arkansas.gov/office/divisions/revenue-legal-counsel/concealed-handgun-licensing'
  },
  CA: {
    name: 'California', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','NE','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    honors: [],
    permitRequired: true, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://oag.ca.gov/firearms/ccw'
  },
  CO: {
    name: 'Colorado', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','DE','FL','GA','IA','ID','IN','KS','KY','LA','MI','MN','MO','MS','MT','NH','NC','ND','NE','NM','OH','OK','PA','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','DE','FL','GA','IA','ID','IN','KS','KY','LA','MI','MN','MO','MS','MT','NH','NC','ND','NE','NM','OH','OK','PA','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    residentPermitsOnly: true,
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.coloradosos.gov/pubs/licensing/gunowners/gunOwnerMain.html'
  },
  CT: {
    name: 'Connecticut', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','NE','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    honors: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','NE','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    permitRequired: true, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://portal.ct.gov/DESPP/Division-of-State-Police/Permits-Firearms-Unit'
  },
  DE: {
    name: 'Delaware', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','ME','MI','MN','MO','MS','NC','ND','NM','OH','OK','SC','SD','TN','TX','UT','VA','VT','WV','WI'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','ME','MI','MN','MO','MS','NC','ND','NM','OH','OK','SC','SD','TN','TX','UT','VA','VT','WV','WI'],
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: true,
    officialSource: 'https://dsp.delaware.gov/firearms/'
  },
  DC: {
    name: 'District of Columbia', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MO','MS','NC','NE','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    honors: [],
    permitRequired: true, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://mpdc.dc.gov/page/concealed-pistol-licensing'
  },
  FL: {
    name: 'Florida', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NV','NC','NH','ND','NE','NM','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WV','WI','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NV','NC','NH','ND','NE','NM','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WV','WI','WY'],
    residentPermitsOnly: true,
    permitRequired: false, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.freshfromflorida.com/Divisions-Offices/Licensing/Businesses/Law-Enforcement-Firearms-Training/Concealed-Weapon-License'
  },
  GA: {
    name: 'Georgia', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NH','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NH','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://dds.georgia.gov/georgia-weapons-carry-license'
  },
  HI: {
    name: 'Hawaii', permitType: 'may-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','NC','NE','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    honors: [],
    permitRequired: true, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.honolulupd.org/information/firearms-registration/'
  },
  ID: {
    name: 'Idaho', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AL','AR','CO','FL','GA','IA','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NH','OH','OK','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AL','AR','CO','FL','GA','IA','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NH','OH','OK','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://www.isp.idaho.gov/BCI/gunreg.html'
  },
  IL: {
    name: 'Illinois', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','NE','NV','OH','OK','SC','SD','TN','TX','UT','VA','VT','WI'],
    honors: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','NE','NV','OH','OK','SC','SD','TN','TX','UT','VA','VT','WI'],
    permitRequired: true, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.isp.state.il.us/firearms/foid.cfm'
  },
  IN: {
    name: 'Indiana', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NH','OH','OK','PA','SD','TN','TX','UT','VA','VT','WV','WI','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NH','OH','OK','PA','SD','TN','TX','UT','VA','VT','WV','WI','WY'],
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://www.in.gov/isp/firearms.htm'
  },
  IA: {
    name: 'Iowa', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NE','NH','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NE','NH','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://www.dps.state.ia.us/asd/weapons.shtml'
  },
  KS: {
    name: 'Kansas', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KY','LA','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NM','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KY','LA','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NM','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://www.ag.ks.gov/in-your-corner-kansas/conceal-carry'
  },
  KY: {
    name: 'Kentucky', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','LA','ME','MI','MN','MO','MS','MT','NC','NH','ND','NE','NV','OH','OK','PA','SC','SD','TN','TX','VA','UT','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','LA','ME','MI','MN','MO','MS','MT','NC','NH','ND','NE','NV','OH','OK','PA','SC','SD','TN','TX','VA','UT','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://kentuckystatepolice.org/concealedcarry/'
  },
  LA: {
    name: 'Louisiana', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://www.lsp.org/ccp.html'
  },
  ME: {
    name: 'Maine', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','DE','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','ND','NC','NE','NH','OH','OK','SD','TN','TX','UT','VA','VT','WY'],
    honors: ['AK','AL','AR','AZ','DE','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','ND','NC','NE','NH','OH','OK','SD','TN','TX','UT','VA','VT','WY'],
    residentPermitsOnly: true,
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.maine.gov/dps/msp/licenses-permits/concealed-firearms-permits'
  },
  MD: {
    name: 'Maryland', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','OH','OK','SC','SD','TN','TX','UT','VA','VT','WI'],
    honors: [],
    residentPermitsOnlyStates: ['MI','SC'],
    permitRequired: true, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://mdsp.maryland.gov/Organization/Pages/CriminalInvestigationBureau/LicensingDivision/Firearms.aspx'
  },
  MA: {
    name: 'Massachusetts', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','NV','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    honors: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','NV','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    permitRequired: true, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.mass.gov/how-to/apply-for-a-firearms-license'
  },
  MI: {
    name: 'Michigan', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MN','MO','MS','MT','NC','NH','ND','NE','NM','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MN','MO','MS','MT','NC','NH','ND','NE','NM','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    residentPermitsOnly: true,
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://www.michigan.gov/msp/divisions/crd/concealed-pistol-licensing'
  },
  MN: {
    name: 'Minnesota', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MT','NE','NC','ND','NV','OH','OK','SC','SD','TN','TX','UT','VA','VT','WV','WI'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MT','NE','NC','ND','NV','OH','OK','SC','SD','TN','TX','UT','VA','VT','WV','WI'],
    permitRequired: true, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://dps.mn.gov/divisions/bca/bca-divisions/administrative/Pages/permit-to-carry.aspx'
  },
  MS: {
    name: 'Mississippi', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MT','NC','ND','NH','NM','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MT','NC','ND','NH','NM','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://www.dps.state.ms.us/firearms/'
  },
  MO: {
    name: 'Missouri', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MS','MN','MT','NC','ND','NE','NH','NM','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MS','MN','MT','NC','ND','NE','NH','NM','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 19, redFlagLaw: false,
    officialSource: 'https://www.mshp.dps.missouri.gov/MSHPWeb/PatrolDivisions/CRID/ccw.html'
  },
  MT: {
    name: 'Montana', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','NH','NC','ND','NE','NV','OH','OK','PA','SD','TN','TX','UT','VA','VT','WV','WI','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','NH','NC','ND','NE','NV','OH','OK','PA','SD','TN','TX','UT','VA','VT','WV','WI','WY'],
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://dojmt.gov/enforcement/concealed-weapons-permits/'
  },
  NE: {
    name: 'Nebraska', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NC','ND','NV','NM','OH','OK','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NC','ND','NV','NM','OH','OK','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://statepatrol.nebraska.gov/concealed-handgun-permits'
  },
  NV: {
    name: 'Nevada', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MN','MT','NC','ND','NE','NM','OH','OK','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MN','MT','NC','ND','NE','NM','OH','OK','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.leg.state.nv.us/nrs/nrs-202.html'
  },
  NH: {
    name: 'New Hampshire', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','VT','WV','WI','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','VT','WV','WI','WY'],
    residentPermitsOnly: true,
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://www.nh.gov/safety/divisions/nhsp/ssb/permitslicensing/pisrp.html'
  },
  NJ: {
    name: 'New Jersey', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','OH','OK','SD','TN','TX','UT','VA','VT'],
    honors: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','OH','OK','SD','TN','TX','UT','VA','VT'],
    permitRequired: true, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.njsp.org/firearms/index.shtml'
  },
  NM: {
    name: 'New Mexico', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','ND','NE','NV','OH','OK','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','MT','NC','ND','NE','NV','OH','OK','SC','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.dps.nm.gov/index.php/concealed-carry-unit-ccw/'
  },
  NY: {
    name: 'New York', permitType: 'may-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MO','MS','MN','MT','NC','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    honors: [],
    permitRequired: true, openCarry: false, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.criminaljustice.ny.gov/crimnet/ojsa/countycodes.htm'
  },
  NC: {
    name: 'North Carolina', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AZ','AR','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NV','ND','NE','NH','NM','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    honors: ['AK','AL','AZ','AR','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NV','ND','NE','NH','NM','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://www.ncsbi.gov/Services/Firearm-Regulatory'
  },
  ND: {
    name: 'North Dakota', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NC','NE','NH','NM','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NC','NE','NH','NM','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    residentPermitsOnly: true,
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://www.ag.nd.gov/BCI/Weapons/Weapons.html'
  },
  OH: {
    name: 'Ohio', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NE','NV','NC','ND','NH','NM','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MS','MT','NE','NV','NC','ND','NH','NM','OK','PA','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://www.ohioattorneygeneral.gov/Law-Enforcement/Concealed-Carry'
  },
  OK: {
    name: 'Oklahoma', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MN','MT','MS','NC','ND','NE','NH','NV','NM','OH','PA','SC','SD','TN','TX','UT','VA','VT','WV','WI','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MN','MT','MS','NC','ND','NE','NH','NV','NM','OH','PA','SC','SD','TN','TX','UT','VA','VT','WV','WI','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://oklahoma.gov/osbi/programs-and-services/firearms/handgun-licensing.html'
  },
  OR: {
    name: 'Oregon', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MO','MS','MT','NE','NC','OH','OK','SD','TN','UT','VA','VT'],
    honors: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MO','MS','MT','NE','NC','OH','OK','SD','TN','UT','VA','VT'],
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.oregon.gov/osp/programs/cch/pages/index.aspx'
  },
  PA: {
    name: 'Pennsylvania', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MT','NC','ND','NH','OH','OK','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MT','NC','ND','NH','OH','OK','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    residentPermitsOnly: true,
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://www.psp.pa.gov/firearms-information/Pages/Licensing-to-Carry-Firearms.aspx'
  },
  RI: {
    name: 'Rhode Island', permitType: 'may-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','NC','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    honors: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','MI','MN','MO','MS','NC','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: true,
    officialSource: 'https://riag.ri.gov/bureaus-divisions/bureau-criminal-identification/firearms'
  },
  SC: {
    name: 'South Carolina', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MN','MT','NC','ND','NE','NV','NM','OH','OK','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MN','MT','NC','ND','NE','NV','NM','OH','OK','SD','TN','TX','UT','VA','VT','WI','WV','WY'],
    residentPermitsOnly: true,
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://www.sled.sc.gov/concealedweapon.aspx'
  },
  SD: {
    name: 'South Dakota', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NH','NM','NC','ND','OH','OK','PA','TN','SC','TX','UT','VA','VT','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NH','NM','NC','ND','OH','OK','PA','TN','SC','TX','UT','VA','VT','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://dlr.sd.gov/licensing/professional_licensing/concealed_pistol_permits.aspx'
  },
  TN: {
    name: 'Tennessee', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','NH','NV','ND','OH','OK','PA','SC','SD','TX','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','NH','NV','ND','OH','OK','PA','SC','SD','TX','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://www.tn.gov/safety/driverlicense/handgunpermit.html'
  },
  TX: {
    name: 'Texas', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MN','MT','NC','ND','NE','NV','NM','OH','OK','PA','SC','SD','TN','UT','VA','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MN','MT','NC','ND','NE','NV','NM','OH','OK','PA','SC','SD','TN','UT','VA','VT','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://www.dps.texas.gov/rsd/LTC/index.htm'
  },
  UT: {
    name: 'Utah', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NE','NV','NH','OH','OK','PA','SD','TN','TX','VA','VT','WA','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NE','NV','NH','OH','OK','PA','SD','TN','TX','VA','VT','WA','WI','WV','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://bci.utah.gov/concealed-firearm/'
  },
  VT: {
    name: 'Vermont', permitType: 'constitutional', constitutionalCarry: true,
    honoredBy: ['AL','AK','AZ','AR','FL','GA','IN','ID','IA','KS','KY','ME','MT','MS','MO','NE','NH','ND','OH','OK','SC','SD','TN','TX','UT','VT','WV','WY'],
    honors: [],
    note: 'Vermont does not issue permits. Residents carry on state DL/ID in states that honor VT.',
    permitRequired: false, openCarry: true, minAge: 18, redFlagLaw: false,
    officialSource: 'https://www.dps.vermont.gov/criminal-justice-services/legislation/weapons'
  },
  VA: {
    name: 'Virginia', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NE','NV','NH','NM','OH','OK','PA','SC','SD','TN','TX','UT','VT','WI','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NE','NV','NH','NM','OH','OK','PA','SC','SD','TN','TX','UT','VT','WI','WV','WY'],
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.vsp.virginia.gov/Firearms_ConealedWeapons.shtm'
  },
  WA: {
    name: 'Washington', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','LA','MI','MS','MT','MO','NC','ND','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    honors: ['AK','AL','AR','AZ','FL','GA','IA','ID','IN','KS','KY','LA','MI','MS','MT','MO','NC','ND','OH','OK','SD','TN','TX','UT','VA','VT','WI'],
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: true,
    officialSource: 'https://www.dol.wa.gov/business/firearms/faconcealedpistol.html'
  },
  WV: {
    name: 'West Virginia', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','DE','FL','GA','ID','IN','IA','KS','KY','LA','MI','MN','MO','MS','MT','NC','ND','NE','NV','NH','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WY'],
    honors: ['AK','AL','AR','AZ','CO','DE','FL','GA','ID','IN','IA','KS','KY','LA','MI','MN','MO','MS','MT','NC','ND','NE','NV','NH','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WY'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://www.wvsp.gov/about/Pages/FirearmsLicensing.aspx'
  },
  WI: {
    name: 'Wisconsin', permitType: 'shall-issue', constitutionalCarry: false,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MT','NC','ND','NE','NV','OH','OK','PA','SD','TN','TX','UT','VA','VT','WV','WY'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','MI','MO','MS','MT','NC','ND','NE','NV','OH','OK','PA','SD','TN','TX','UT','VA','VT','WV','WY'],
    permitRequired: true, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://www.doj.state.wi.us/dles/cib/concealed-carry'
  },
  WY: {
    name: 'Wyoming', permitType: 'shall-issue', constitutionalCarry: true,
    honoredBy: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NE','NH','NM','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV'],
    honors: ['AK','AL','AR','AZ','CO','FL','GA','IA','ID','IN','KS','KY','LA','ME','MI','MO','MS','MT','NC','ND','NE','NH','NM','NV','OH','OK','PA','SC','SD','TN','TX','UT','VA','VT','WI','WV'],
    permitRequired: false, openCarry: true, minAge: 21, redFlagLaw: false,
    officialSource: 'https://wyomingdci.wyo.gov/dci-criminal-justice-information-systems-section/concealed-firearms-permits'
  }
}

export default CCW_DATA

// Helpers for CCWMap.jsx
export function getStateData(code) {
  return CCW_DATA[code] || null
}

export function getAllStateCodes() {
  return Object.keys(CCW_DATA)
}
