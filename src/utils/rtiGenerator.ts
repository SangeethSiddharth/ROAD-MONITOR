import { AggregatedReport } from '../types';

interface MunicipalAuthority {
  name: string;
  designation: string;
  office: string;
  address: string;
}

// Municipal authority lookup (simplified - in production, use a comprehensive database)
const MUNICIPAL_AUTHORITIES: Record<string, MunicipalAuthority> = {
  'delhi': {
    name: 'Public Information Officer',
    designation: 'Executive Engineer (Roads)',
    office: 'Municipal Corporation of Delhi',
    address: 'Town Hall, Chandni Chowk, Delhi - 110006'
  },
  'mumbai': {
    name: 'Public Information Officer',
    designation: 'Executive Engineer (Roads)',
    office: 'Brihanmumbai Municipal Corporation',
    address: 'Mahapalika Marg, Fort, Mumbai - 400001'
  },
  'bangalore': {
    name: 'Public Information Officer',
    designation: 'Executive Engineer (Roads)',
    office: 'Bruhat Bengaluru Mahanagara Palike',
    address: 'N.R. Square, Bangalore - 560002'
  },
  'default': {
    name: 'Public Information Officer',
    designation: 'Executive Engineer (Roads)',
    office: 'Municipal Corporation',
    address: '[Municipal Office Address]'
  }
};

function getMunicipalAuthority(city: string): MunicipalAuthority {
  const key = city.toLowerCase().replace(/\s+/g, '');
  return MUNICIPAL_AUTHORITIES[key] || MUNICIPAL_AUTHORITIES['default'];
}

function getSeverityDescription(severity: number): string {
  if (severity >= 8) return 'Critical - Immediate safety hazard';
  if (severity >= 6) return 'High - Significant road damage requiring urgent repair';
  if (severity >= 4) return 'Moderate - Notable damage affecting vehicle safety';
  return 'Low - Minor damage requiring scheduled maintenance';
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

export function generateRTIDraft(
  report: AggregatedReport,
  address: string,
  city: string,
  applicantName: string,
  applicantAddress: string
): string {
  const authority = getMunicipalAuthority(city);
  const today = formatDate(Date.now());
  const mapLink = `https://www.google.com/maps?q=${report.location.latitude},${report.location.longitude}`;
  
  const defectTypeDisplay = report.defectType === 'pothole' ? 'Pothole' : 'Speed Breaker';
  const severityDesc = getSeverityDescription(report.averageSeverity);

  return `
RIGHT TO INFORMATION APPLICATION
(Under Section 6(1) of RTI Act, 2005)

Date: ${today}

To,
${authority.name}
${authority.designation}
${authority.office}
${authority.address}

Subject: Request for Information Regarding Road Defect at ${address}

Sir/Madam,

I, ${applicantName}, a citizen of India, hereby submit this application under the Right to Information Act, 2005, seeking the following information:

═══════════════════════════════════════════════════════════════════════════════
ROAD DEFECT DETAILS
═══════════════════════════════════════════════════════════════════════════════

Location:
• Address: ${address}
• GPS Coordinates: ${report.location.latitude.toFixed(6)}, ${report.location.longitude.toFixed(6)}
• Map Link: ${mapLink}

Defect Information:
• Type: ${defectTypeDisplay}
• Severity: ${report.averageSeverity.toFixed(1)}/10 (${severityDesc})
• First Reported: ${formatDate(report.firstReported)}
• Last Reported: ${formatDate(report.lastReported)}

Verification:
• Number of Independent Citizen Detections: ${report.reportCount}
• Unique Citizen Reports: ${report.uniqueUsers.length}
• Credibility Score: ${(report.credibilityScore * 100).toFixed(0)}%

═══════════════════════════════════════════════════════════════════════════════
INFORMATION SOUGHT
═══════════════════════════════════════════════════════════════════════════════

1. AWARENESS & RECORDS
   a) Is the aforementioned road defect recorded in your department's road 
      maintenance register? If yes, please provide the registration number 
      and date of registration.
   b) Have any previous complaints been received regarding this specific 
      location? Please provide details.

2. MAINTENANCE RESPONSIBILITY
   a) Which department/contractor is responsible for maintaining this 
      stretch of road?
   b) What is the current status of the road maintenance contract for 
      this area?

3. INSPECTION & ASSESSMENT
   a) When was the last inspection conducted for this road segment?
   b) Please provide a copy of the latest inspection report for this 
      location.

4. REPAIR SCHEDULE
   a) Is this defect scheduled for repair? If yes, please provide the 
      expected timeline.
   b) If not scheduled, please provide reasons for the same.

5. BUDGET ALLOCATION
   a) What is the budget allocated for road repairs in this ward/zone 
      for the current financial year?
   b) How much of this budget has been utilized to date?

6. ACCIDENT RECORDS
   a) Have any accidents been reported at this location in the past 
      12 months that may be attributed to road conditions?

═══════════════════════════════════════════════════════════════════════════════
PUBLIC SAFETY STATEMENT
═══════════════════════════════════════════════════════════════════════════════

This application is submitted in the interest of public safety. The reported 
road defect poses significant risk to:
• Two-wheeler riders
• Four-wheeler vehicles
• Pedestrians
• Senior citizens and children

Multiple independent citizens have verified this defect through GPS-enabled 
mobile sensing technology, confirming its existence and severity.

═══════════════════════════════════════════════════════════════════════════════
DECLARATION
═══════════════════════════════════════════════════════════════════════════════

I declare that:
1. I am a citizen of India.
2. The information sought does not relate to any person's personal information.
3. I am willing to pay the prescribed fee for obtaining this information.

Fee: Rs. 10/- (Rupees Ten Only) - [Payment details to be attached]

═══════════════════════════════════════════════════════════════════════════════
APPLICANT DETAILS
═══════════════════════════════════════════════════════════════════════════════

Name: ${applicantName}
Address: ${applicantAddress}

Thanking you,

Yours faithfully,


___________________
(${applicantName})

═══════════════════════════════════════════════════════════════════════════════
Note: This RTI was generated using RoadWatch - a citizen-powered road safety 
initiative using AI-based defect detection. Data collected by ${report.uniqueUsers.length} 
independent volunteers.
═══════════════════════════════════════════════════════════════════════════════
`.trim();
}

export function generateRTISummary(report: AggregatedReport): string {
  return `Road defect (${report.defectType}) at coordinates ${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)} - Severity: ${report.averageSeverity.toFixed(1)}/10, Verified by ${report.reportCount} reports from ${report.uniqueUsers.length} citizens.`;
}
