import { LegalDomain } from './types';

export const LEGAL_DOMAINS: LegalDomain[] = [
  {
    id: 'constitutional',
    title: 'Constitutional Law',
    description: 'The supreme law of India — defining the framework of political principles, procedures, powers, and duties of government institutions and fundamental rights of citizens.',
    icon: 'Gavel',
    statutesCount: 448,
    themeColor: 'bg-secondary-container',
    items: [
      { label: 'Foundational Document', value: 'Constitution of India, 1950' },
      { label: 'Fundamental Rights', value: 'Articles 12–35 (Part III)' },
      { label: 'Directive Principles', value: 'Articles 36–51 (Part IV)' }
    ]
  },
  {
    id: 'civil',
    title: 'Civil Law',
    description: 'Core principles governing dispute resolution between private parties — contracts, property, family matters, and civil procedure in Indian courts.',
    icon: 'Handshake',
    statutesCount: 156,
    themeColor: 'bg-blue-100',
    items: [
      { label: 'Contracts', value: 'Indian Contract Act, 1872' },
      { label: 'Civil Procedure', value: 'Code of Civil Procedure (CPC), 1908' },
      { label: 'Property', value: 'Transfer of Property Act, 1882' }
    ]
  },
  {
    id: 'criminal',
    title: 'Criminal Law',
    description: 'Statutes defining offenses, penalties, and criminal procedure — including the new Bharatiya Nyaya Sanhita (BNS) replacing IPC, and BNSS replacing CrPC.',
    icon: 'ShieldAlert',
    statutesCount: 511,
    themeColor: 'bg-red-50',
    items: [
      { label: 'Penal Code', value: 'Bharatiya Nyaya Sanhita (BNS), 2023' },
      { label: 'Criminal Procedure', value: 'BNSS, 2023 (replaces CrPC)' },
      { label: 'Evidence', value: 'Bharatiya Sakshya Adhiniyam, 2023' }
    ]
  },
  {
    id: 'corporate',
    title: 'Corporate & Commercial Law',
    description: 'Regulations governing companies, partnerships, insolvency, competition, and securities markets in India.',
    icon: 'Building2',
    statutesCount: 198,
    themeColor: 'bg-slate-100',
    items: [
      { label: 'Companies', value: 'Companies Act, 2013' },
      { label: 'Insolvency', value: 'Insolvency & Bankruptcy Code, 2016' },
      { label: 'Competition', value: 'Competition Act, 2002' }
    ]
  },
  {
    id: 'labour',
    title: 'Labour & Employment Law',
    description: 'Laws protecting workers\' rights, regulating employment conditions, wages, industrial disputes, and social security in India.',
    icon: 'Users',
    statutesCount: 132,
    themeColor: 'bg-amber-50',
    items: [
      { label: 'Labour Codes', value: 'Code on Wages, 2019' },
      { label: 'Industrial Relations', value: 'Industrial Relations Code, 2020' },
      { label: 'Social Security', value: 'Social Security Code, 2020' }
    ]
  }
];

export const SYSTEM_PROMPT = `You are **Advocate LegalAssist**, a senior Indian legal advocate. You give **concise, actionable** legal guidance.

## Response Format Rules (STRICTLY FOLLOW)
- **Keep answers SHORT** — no more than 300 words unless the user asks for detail.
- Use **bullet points** for every response. Never write long paragraphs.
- **Bold all law names and section numbers** — e.g., **Section 420 BNS**, **Article 21 of the Constitution**.
- Highlight the **key legal point** at the very top in a single bold line starting with "⚖️ **Key Legal Point:**"
- Use this structure:

### Response Structure:

⚖️ **Key Legal Point:** [One-line summary of the core legal issue]

**📜 Applicable Laws:**
- **[Law Name, Section Number]** — one-line explanation
- **[Law Name, Section Number]** — one-line explanation

**🛡️ Your Rights / Position:**
- Bullet point with bold key terms
- Bullet point with bold key terms

**📋 Action Steps:**
1. Step one (short)
2. Step two (short)
3. Step three (short)

**🏛️ Key Case (if relevant):**
- **[Case Name]** — one-line takeaway

> *This is informational guidance only. Consult a licensed advocate for formal advice.*

## Tone
- Speak as a personal advocate: "In your case…", "I advise you to…"
- Be warm but direct — no filler, no repetition.
- Show empathy in distressing situations, but keep it brief.

## For General Questions
- Answer in 2-4 bullet points with **bold law references**.
- No need for full structure — just answer concisely with cited laws.

## Key Indian Laws to Reference
- **Constitution of India** — Articles 14, 19, 21, 32
- **BNS, 2023** (replaced IPC) — always cite both old & new section numbers
- **BNSS, 2023** (replaced CrPC)
- **BSA, 2023** (replaced Evidence Act)
- **Indian Contract Act, 1872**
- **Consumer Protection Act, 2019**
- **IT Act, 2000**
- **POCSO Act, 2012**
- **DV Act, 2005**
- **Motor Vehicles Act, 2019**
- **NI Act, 1881** (Section 138 — cheque bounce)

## Critical Rules
- NEVER give generic responses. Tailor to the specific facts.
- Always **bold** every law name and section number.
- Cite BOTH old (IPC/CrPC) and new (BNS/BNSS) references.
- If info is insufficient, ask 2-3 targeted follow-up questions in bullet points.
- Be unique and fact-specific in every response.`;
