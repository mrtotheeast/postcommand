// CCW Reciprocity Data — maintained by AI agent monthly
// Last static update: 2026-05-30
// Source: State statutes, AG opinions, USCCA reciprocity maps
// Always verify with your state's AG office before carrying

export const PERMIT_TYPES = {
  constitutional: { label:'Constitutional Carry', color:'#4caf50', bg:'rgba(76,175,80,0.14)',   short:'CC' },
  shall_issue:    { label:'Shall-Issue',          color:'#2196f3', bg:'rgba(33,150,243,0.14)',  short:'SI' },
  may_issue:      { label:'May-Issue',            color:'#ff9800', bg:'rgba(255,152,0,0.14)',   short:'MI' },
  no_issue:       { label:'No Civilian Carry',    color:'#f44336', bg:'rgba(244,67,54,0.14)',   short:'NI' },
}

// Full 50-state + DC dataset
export const CCW_STATES = [
  {
    code:'AL', name:'Alabama', permitType:'constitutional', constitutional:true,
    permitName:'Pistol Permit (optional)',
    fee:20, trainingHours:0, residencyRequired:false, minAge:18, validYears:5,
    honors:['AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VT','VA','WV','WY'],
    notes:'Constitutional carry since Jan 1, 2023. Optional permits still issued for out-of-state reciprocity. Permit valid 5 years.',
  },
  {
    code:'AK', name:'Alaska', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Handgun Permit (optional)',
    fee:88, trainingHours:0, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','OR','PA','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'],
    notes:'No permit needed to carry. Optional permit for reciprocity. Recognized by most shall-issue states.',
  },
  {
    code:'AZ', name:'Arizona', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Weapons Permit (optional)',
    fee:60, trainingHours:8, residencyRequired:false, minAge:21, validYears:5,
    honors:['AL','AK','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VT','VA','WV','WI','WY'],
    notes:'Broadest reciprocity of any state. Honors all valid out-of-state permits. Optional permit available for reciprocity travel.',
  },
  {
    code:'AR', name:'Arkansas', permitType:'constitutional', constitutional:true,
    permitName:'License to Carry (LTC)',
    fee:95, trainingHours:5, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry enacted 2018. Enhanced carry permit offers broader reciprocity.',
  },
  {
    code:'CA', name:'California', permitType:'shall_issue', constitutional:false,
    permitName:'Carry Concealed Weapon (CCW) License',
    fee:200, trainingHours:16, residencyRequired:true, minAge:21, validYears:2,
    honors:[],
    notes:'Does not honor any out-of-state permits. Very restrictive on sensitive places post-Bruen. County sheriff discretion on issuance.',
  },
  {
    code:'CO', name:'Colorado', permitType:'shall_issue', constitutional:false,
    permitName:'Concealed Handgun Permit (CHP)',
    fee:152, trainingHours:0, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Does not honor permits from non-resident states. 2013 law eliminated automatic reciprocity with many states.',
  },
  {
    code:'CT', name:'Connecticut', permitType:'shall_issue', constitutional:false,
    permitName:'State Permit to Carry Pistols',
    fee:140, trainingHours:0, residencyRequired:true, minAge:21, validYears:5,
    honors:[],
    notes:'Does not honor out-of-state permits. Permit requires 8-hour safety course from approved instructor.',
  },
  {
    code:'DE', name:'Delaware', permitType:'shall_issue', constitutional:false,
    permitName:'License to Carry Concealed Deadly Weapon',
    fee:65, trainingHours:0, residencyRequired:true, minAge:18, validYears:3,
    honors:[],
    notes:'Court-issued permit. Does not honor out-of-state permits. Applicants must show justifiable need.',
  },
  {
    code:'DC', name:'District of Columbia', permitType:'may_issue', constitutional:false,
    permitName:'Concealed Carry Pistol License',
    fee:75, trainingHours:16, residencyRequired:true, minAge:21, validYears:2,
    honors:[],
    notes:'Does not honor any out-of-state permits. Carry prohibited in all government buildings and many public areas.',
  },
  {
    code:'FL', name:'Florida', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Weapon License (CWL)',
    fee:97, trainingHours:0, residencyRequired:false, minAge:21, validYears:7,
    honors:['AL','AK','AZ','AR','CO','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WI','WY'],
    notes:'Constitutional carry enacted July 2023. Florida CWL is one of the most widely honored permits in the US (~37 states).',
  },
  {
    code:'GA', name:'Georgia', permitType:'constitutional', constitutional:true,
    permitName:'Weapons Carry License (WCL)',
    fee:30, trainingHours:0, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','ID','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry enacted April 2022. Optional WCL still issued for reciprocity. Very affordable permit.',
  },
  {
    code:'HI', name:'Hawaii', permitType:'may_issue', constitutional:false,
    permitName:'License to Carry Loaded Firearms',
    fee:20, trainingHours:8, residencyRequired:true, minAge:21, validYears:1,
    honors:[],
    notes:'Extremely restrictive. Does not honor out-of-state permits. Hawaii permit rarely honored by other states.',
  },
  {
    code:'ID', name:'Idaho', permitType:'constitutional', constitutional:true,
    permitName:'Enhanced Concealed Weapons License',
    fee:20, trainingHours:8, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','OR','PA','SD','TN','TX','UT','VA','WA','WV','WY'],
    notes:'Constitutional carry for residents. Enhanced permit required for broader reciprocity (includes training). Standard permit available at reduced cost.',
  },
  {
    code:'IL', name:'Illinois', permitType:'shall_issue', constitutional:false,
    permitName:'Firearms Owner ID (FOID) + Concealed Carry License',
    fee:153, trainingHours:16, residencyRequired:true, minAge:21, validYears:5,
    honors:[],
    notes:'Does not honor any out-of-state permits. 16-hour training requirement. FOID card separately required to own firearms.',
  },
  {
    code:'IN', name:'Indiana', permitType:'constitutional', constitutional:true,
    permitName:'Handgun License (optional)',
    fee:17, trainingHours:0, residencyRequired:false, minAge:18, validYears:4,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry enacted July 2022. One of the most affordable optional permits. Lifetime license available.',
  },
  {
    code:'IA', name:'Iowa', permitType:'constitutional', constitutional:true,
    permitName:'Permit to Carry Weapons',
    fee:50, trainingHours:0, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry enacted July 2021. Permit still available for reciprocity use.',
  },
  {
    code:'KS', name:'Kansas', permitType:'constitutional', constitutional:true,
    permitName:'Kansas Concealed Carry License',
    fee:32, trainingHours:0, residencyRequired:true, minAge:21, validYears:4,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry since 2015 — one of the first states. Training required for permit but not to carry.',
  },
  {
    code:'KY', name:'Kentucky', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Carry Deadly Weapons (CCDW) License',
    fee:60, trainingHours:8, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry since 2019. CCDW permit still widely honored for reciprocity.',
  },
  {
    code:'LA', name:'Louisiana', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Handgun Permit (CHP)',
    fee:125, trainingHours:8, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry enacted July 2024. Existing CHP still honored in ~31 states.',
  },
  {
    code:'ME', name:'Maine', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Firearms Permit (optional)',
    fee:35, trainingHours:0, residencyRequired:false, minAge:18, validYears:4,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry since 2015. Non-resident permits available.',
  },
  {
    code:'MD', name:'Maryland', permitType:'shall_issue', constitutional:false,
    permitName:'Handgun Permit',
    fee:125, trainingHours:16, residencyRequired:true, minAge:21, validYears:2,
    honors:[],
    notes:'Shall-issue post-Bruen (2022). Does not honor out-of-state permits. Extensive training required.',
  },
  {
    code:'MA', name:'Massachusetts', permitType:'may_issue', constitutional:false,
    permitName:'License to Carry (LTC)',
    fee:100, trainingHours:0, residencyRequired:true, minAge:21, validYears:6,
    honors:[],
    notes:'Local police chief has discretion. Does not honor out-of-state permits. Extremely difficult in some cities.',
  },
  {
    code:'MI', name:'Michigan', permitType:'shall_issue', constitutional:false,
    permitName:'Concealed Pistol License (CPL)',
    fee:105, trainingHours:8, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MN','MO','MT','NE','NV','NH','NC','ND','OH','OK','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Shall-issue with fingerprints. Honors permits with equivalent safety training requirements.',
  },
  {
    code:'MN', name:'Minnesota', permitType:'shall_issue', constitutional:false,
    permitName:'Permit to Carry a Pistol',
    fee:100, trainingHours:0, residencyRequired:false, minAge:21, validYears:5,
    honors:['AK','AZ','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MO','MT','NE','NV','NH','NC','ND','OH','OK','OR','SD','TN','TX','UT','VA','WV','WI','WY'],
    notes:'Does not honor AL, AR permits but honors most shall-issue states. Training required from certified instructor.',
  },
  {
    code:'MS', name:'Mississippi', permitType:'constitutional', constitutional:true,
    permitName:'Enhanced Concealed Carry Permit',
    fee:132, trainingHours:8, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry since 2015 (with some restrictions). Enhanced permit honors carry in more locations.',
  },
  {
    code:'MO', name:'Missouri', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Carry Permit (CCP)',
    fee:0, trainingHours:0, residencyRequired:true, minAge:19, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'No permit required. Free optional permit for reciprocity. No training required for permit.',
  },
  {
    code:'MT', name:'Montana', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Weapon Permit (CWP)',
    fee:60, trainingHours:0, residencyRequired:true, minAge:18, validYears:4,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry since 2021. Enhanced permit also available for additional reciprocity.',
  },
  {
    code:'NE', name:'Nebraska', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Handgun Permit (CHP)',
    fee:100, trainingHours:10, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry enacted 2023. CHP still required for broader reciprocity.',
  },
  {
    code:'NV', name:'Nevada', permitType:'shall_issue', constitutional:false,
    permitName:'Concealed Firearm Permit (CFP)',
    fee:100, trainingHours:8, residencyRequired:false, minAge:21, validYears:5,
    honors:['AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','WA','WV','WY'],
    notes:'Nevada does not honor AL, CA, and a few others. Non-resident permits available.',
  },
  {
    code:'NH', name:'New Hampshire', permitType:'constitutional', constitutional:true,
    permitName:'Non-Resident Pistol/Revolver License',
    fee:100, trainingHours:0, residencyRequired:false, minAge:18, validYears:4,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'No permit required for residents. Non-resident license available. Widely honored.',
  },
  {
    code:'NJ', name:'New Jersey', permitType:'shall_issue', constitutional:false,
    permitName:'Permit to Carry a Handgun',
    fee:200, trainingHours:16, residencyRequired:true, minAge:21, validYears:2,
    honors:[],
    notes:'Shall-issue post-Bruen (2022) but extensive training and numerous sensitive place restrictions. Does not honor out-of-state permits.',
  },
  {
    code:'NM', name:'New Mexico', permitType:'shall_issue', constitutional:false,
    permitName:'Concealed Handgun License (CHL)',
    fee:100, trainingHours:15, residencyRequired:true, minAge:21, validYears:4,
    honors:['AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Does not honor AL, CA, and some others. Requires 15 hours of training.',
  },
  {
    code:'NY', name:'New York', permitType:'may_issue', constitutional:false,
    permitName:'Pistol License',
    fee:340, trainingHours:16, residencyRequired:true, minAge:21, validYears:3,
    honors:[],
    notes:'Does not honor any out-of-state permits. CCIA 2022 created extensive sensitive location restrictions post-Bruen. NYC requires separate city permit.',
  },
  {
    code:'NC', name:'North Carolina', permitType:'shall_issue', constitutional:false,
    permitName:'Concealed Handgun Permit (CHP)',
    fee:90, trainingHours:8, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Strong reciprocity agreements with most states. Permit widely honored.',
  },
  {
    code:'ND', name:'North Dakota', permitType:'constitutional', constitutional:true,
    permitName:'Class 1/Class 2 Concealed Weapon License',
    fee:25, trainingHours:8, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry for residents. Class 1 permit offers broader reciprocity (includes training). Class 2 has limited reciprocity.',
  },
  {
    code:'OH', name:'Ohio', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Handgun License (CHL)',
    fee:67, trainingHours:8, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry enacted June 2022. CHL widely accepted by other states.',
  },
  {
    code:'OK', name:'Oklahoma', permitType:'constitutional', constitutional:true,
    permitName:'Self-Defense Act License (SDA)',
    fee:100, trainingHours:8, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry since Nov 2019. SDA license for reciprocity with other states.',
  },
  {
    code:'OR', name:'Oregon', permitType:'shall_issue', constitutional:false,
    permitName:'Concealed Handgun License (CHL)',
    fee:65, trainingHours:0, residencyRequired:false, minAge:21, validYears:4,
    honors:['AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NV','NH','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Measure 114 (2022) attempted to ban standard capacity magazines — ongoing litigation. Does not honor some southern state permits.',
  },
  {
    code:'PA', name:'Pennsylvania', permitType:'shall_issue', constitutional:false,
    permitName:'License to Carry Firearms (LTCF)',
    fee:20, trainingHours:0, residencyRequired:false, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','SD','TN','TX','UT','VA','WV','WY'],
    notes:'One of the lowest-cost shall-issue permits. Philadelphia has additional restrictions. No training required.',
  },
  {
    code:'RI', name:'Rhode Island', permitType:'may_issue', constitutional:false,
    permitName:'License to Carry Concealed Pistol/Revolver',
    fee:40, trainingHours:0, residencyRequired:true, minAge:21, validYears:1,
    honors:[],
    notes:'Attorney General and local licensing authorities both issue permits. AG permits have broader recognition within RI. Does not honor out-of-state permits.',
  },
  {
    code:'SC', name:'South Carolina', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Weapon Permit (CWP)',
    fee:50, trainingHours:8, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry enacted March 2024. CWP still widely honored.',
  },
  {
    code:'SD', name:'South Dakota', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Pistol Permit',
    fee:10, trainingHours:0, residencyRequired:true, minAge:18, validYears:4,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SC','TN','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry since 2019. One of cheapest permits at $10. No training required.',
  },
  {
    code:'TN', name:'Tennessee', permitType:'constitutional', constitutional:true,
    permitName:'Enhanced Handgun Carry Permit (EHCP)',
    fee:100, trainingHours:8, residencyRequired:true, minAge:21, validYears:8,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TX','UT','VA','WV','WY'],
    notes:'Constitutional carry since July 2021 for those who qualify. Enhanced permit required for reciprocity and some restricted areas.',
  },
  {
    code:'TX', name:'Texas', permitType:'constitutional', constitutional:true,
    permitName:'License to Carry (LTC)',
    fee:40, trainingHours:4, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','UT','VA','WV','WY'],
    notes:'Constitutional carry enacted September 2021. Texas LTC honored in ~40 states. One of the most widely recognized permits.',
  },
  {
    code:'UT', name:'Utah', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Firearm Permit (CFP)',
    fee:65, trainingHours:4, residencyRequired:false, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','VA','WV','WY'],
    notes:'Utah permits one of the most widely accepted non-resident permits globally. Many residents of other states hold Utah permits for reciprocity.',
  },
  {
    code:'VT', name:'Vermont', permitType:'constitutional', constitutional:true,
    permitName:'N/A — No permit issued',
    fee:0, trainingHours:0, residencyRequired:false, minAge:16, validYears:0,
    honors:[],
    notes:'Vermont has never required a permit to carry (permitless since founding). Does not issue permits, limiting reciprocity travel options for Vermonters.',
  },
  {
    code:'VA', name:'Virginia', permitType:'shall_issue', constitutional:false,
    permitName:'Concealed Handgun Permit (CHP)',
    fee:50, trainingHours:0, residencyRequired:false, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','WV','WY'],
    notes:'Non-resident permits available online. Virginia CHP widely honored (~30 states).',
  },
  {
    code:'WA', name:'Washington', permitType:'shall_issue', constitutional:false,
    permitName:'Concealed Pistol License (CPL)',
    fee:55, trainingHours:0, residencyRequired:false, minAge:21, validYears:5,
    honors:['AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MO','MT','NE','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'No training required. Washington CPL honored by fewer states due to stricter local laws. Mag capacity restrictions apply.',
  },
  {
    code:'WV', name:'West Virginia', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Handgun License (CHL)',
    fee:25, trainingHours:0, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WY'],
    notes:'Constitutional carry since May 2016. CHL still issued for reciprocity travel.',
  },
  {
    code:'WI', name:'Wisconsin', permitType:'shall_issue', constitutional:false,
    permitName:'Concealed Carry Weapon (CCW) License',
    fee:40, trainingHours:0, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV','WY'],
    notes:'Training certificate required — many accepted including online options. License widely accepted.',
  },
  {
    code:'WY', name:'Wyoming', permitType:'constitutional', constitutional:true,
    permitName:'Concealed Firearm Permit (CFP)',
    fee:75, trainingHours:0, residencyRequired:true, minAge:21, validYears:5,
    honors:['AL','AK','AZ','AR','CO','FL','GA','ID','IN','IA','KS','KY','LA','ME','MI','MN','MS','MO','MT','NE','NV','NH','NM','NC','ND','OH','OK','PA','SD','TN','TX','UT','VA','WV'],
    notes:'Constitutional carry since 2011 — one of the first states. CFP issued for reciprocity.',
  },
]

// Derive "honoredBy" from "honors" arrays
const codeMap = Object.fromEntries(CCW_STATES.map(s => [s.code, s]))
CCW_STATES.forEach(state => {
  state.honoredBy = CCW_STATES.filter(other => other.honors.includes(state.code)).map(s => s.code)
})

export const CCW_MAP = Object.fromEntries(CCW_STATES.map(s => [s.code, s]))

export function getStateColor(permitType) {
  return PERMIT_TYPES[permitType]?.color || '#888'
}
export function getStateBg(permitType) {
  return PERMIT_TYPES[permitType]?.bg || 'rgba(136,136,136,0.15)'
}
