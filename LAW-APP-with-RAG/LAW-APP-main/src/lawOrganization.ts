import type { VerifiedLaw } from './types';

type ReferenceKind = 'article' | 'section' | 'chapter' | 'part' | 'clause' | 'provision';

type LawSourceDefinition = {
  id: string;
  title: string;
  category?: string;
  priority: number;
  referenceKind: ReferenceKind;
  matchers: RegExp[];
};

type ChunkAnchor = {
  heading: string;
  index: number;
};

export interface LawSourceInfo {
  id: string;
  title: string;
  category: string;
  priority: number;
  referenceKind: ReferenceKind;
  sectionLabel: string;
}

export interface OrganizedLawEntry {
  law: VerifiedLaw;
  source: LawSourceInfo;
  primaryReference: string;
  sortNumber: number;
  sortSuffix: string;
}

export interface OrganizedLawChunk {
  id: string;
  heading: string;
  content: string;
  preview: string;
  sortNumber: number;
  sortSuffix: string;
}

export interface OrganizedLawTopic {
  id: string;
  source: LawSourceInfo;
  title: string;
  primaryReference: string;
  summary: string;
  category: string;
  type: 'file' | 'text' | 'mixed';
  chunks: OrganizedLawChunk[];
  laws: VerifiedLaw[];
  sortNumber: number;
  sortSuffix: string;
}

export interface OrganizedLawGroup {
  source: LawSourceInfo;
  topics: OrganizedLawTopic[];
}

const MAX_SEARCH_CONTENT = 3000;
const MAX_REFERENCE_SCAN_CONTENT = 1500;
const CHUNK_PREVIEW_LENGTH = 220;
const CHUNK_PARAGRAPH_TARGET = 900;

const KNOWN_LAW_SOURCES: LawSourceDefinition[] = [
  {
    id: 'constitution',
    title: 'Constitution of India',
    category: 'constitutional',
    priority: 10,
    referenceKind: 'article',
    matchers: [/\bconstitution of india\b/i, /\barticle\s+\d+[a-z]?\b/i],
  },
  {
    id: 'bns',
    title: 'Bharatiya Nyaya Sanhita (BNS), 2023',
    category: 'criminal',
    priority: 20,
    referenceKind: 'section',
    matchers: [/\bbns\b/i, /\bbharatiya nyaya sanhita\b/i],
  },
  {
    id: 'bnss',
    title: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023',
    category: 'criminal',
    priority: 21,
    referenceKind: 'section',
    matchers: [/\bbnss\b/i, /\bbharatiya nagarik suraksha sanhita\b/i],
  },
  {
    id: 'bsa',
    title: 'Bharatiya Sakshya Adhiniyam (BSA), 2023',
    category: 'criminal',
    priority: 22,
    referenceKind: 'section',
    matchers: [/\bbsa\b/i, /\bbharatiya sakshya adhiniyam\b/i],
  },
  {
    id: 'ipc',
    title: 'Indian Penal Code (IPC), 1860',
    category: 'criminal',
    priority: 23,
    referenceKind: 'section',
    matchers: [/\bipc\b/i, /\bindian penal code\b/i],
  },
  {
    id: 'crpc',
    title: 'Code of Criminal Procedure (CrPC), 1973',
    category: 'criminal',
    priority: 24,
    referenceKind: 'section',
    matchers: [/\bcrpc\b/i, /\bcode of criminal procedure\b/i],
  },
  {
    id: 'cpc',
    title: 'Code of Civil Procedure (CPC), 1908',
    category: 'civil',
    priority: 30,
    referenceKind: 'section',
    matchers: [/\bcpc\b/i, /\bcode of civil procedure\b/i],
  },
  {
    id: 'contract-act',
    title: 'Indian Contract Act, 1872',
    category: 'civil',
    priority: 31,
    referenceKind: 'section',
    matchers: [/\bindian contract act\b/i],
  },
  {
    id: 'transfer-of-property',
    title: 'Transfer of Property Act, 1882',
    category: 'civil',
    priority: 32,
    referenceKind: 'section',
    matchers: [/\btransfer of property act\b/i],
  },
  {
    id: 'consumer-protection',
    title: 'Consumer Protection Act, 2019',
    category: 'civil',
    priority: 33,
    referenceKind: 'section',
    matchers: [/\bconsumer protection act\b/i],
  },
  {
    id: 'companies-act',
    title: 'Companies Act, 2013',
    category: 'corporate',
    priority: 40,
    referenceKind: 'section',
    matchers: [/\bcompanies act\b/i],
  },
  {
    id: 'insolvency-code',
    title: 'Insolvency & Bankruptcy Code, 2016',
    category: 'corporate',
    priority: 41,
    referenceKind: 'section',
    matchers: [/\binsolvency\b/i, /\bbankruptcy code\b/i],
  },
  {
    id: 'competition-act',
    title: 'Competition Act, 2002',
    category: 'corporate',
    priority: 42,
    referenceKind: 'section',
    matchers: [/\bcompetition act\b/i],
  },
  {
    id: 'it-act',
    title: 'Information Technology Act, 2000',
    category: 'corporate',
    priority: 43,
    referenceKind: 'section',
    matchers: [/\bit act\b/i, /\binformation technology act\b/i],
  },
  {
    id: 'code-on-wages',
    title: 'Code on Wages, 2019',
    category: 'labour',
    priority: 50,
    referenceKind: 'section',
    matchers: [/\bcode on wages\b/i],
  },
  {
    id: 'industrial-relations',
    title: 'Industrial Relations Code, 2020',
    category: 'labour',
    priority: 51,
    referenceKind: 'section',
    matchers: [/\bindustrial relations code\b/i],
  },
  {
    id: 'social-security',
    title: 'Code on Social Security, 2020',
    category: 'labour',
    priority: 52,
    referenceKind: 'section',
    matchers: [/\bsocial security code\b/i, /\bcode on social security\b/i],
  },
];

const REFERENCE_PATTERNS: Record<ReferenceKind, RegExp> = {
  article: /\bArticle\s+[0-9A-Za-z/-]+\b/gi,
  section: /\bSection\s+[0-9A-Za-z/-]+\b/gi,
  chapter: /\bChapter\s+[0-9A-Za-z/-]+\b/gi,
  part: /\bPart\s+[0-9A-Za-z/-]+\b/gi,
  clause: /\bClause\s+[0-9A-Za-z/-]+\b/gi,
  provision: /\bProvision\s+[0-9A-Za-z/-]+\b/gi,
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function slugify(text: string): string {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function romanToNumber(value: string): number {
  const numerals: Record<string, number> = {
    i: 1,
    v: 5,
    x: 10,
    l: 50,
    c: 100,
    d: 500,
    m: 1000,
  };

  let total = 0;
  let previous = 0;
  for (const char of value.toLowerCase().split('').reverse()) {
    const current = numerals[char] || 0;
    total += current < previous ? -current : current;
    previous = current;
  }
  return total || Number.MAX_SAFE_INTEGER;
}

function getSectionLabel(referenceKind: ReferenceKind): string {
  switch (referenceKind) {
    case 'article':
      return 'Articles';
    case 'section':
      return 'Sections';
    case 'chapter':
      return 'Chapters';
    case 'part':
      return 'Parts';
    case 'clause':
      return 'Clauses';
    default:
      return 'Provisions';
  }
}

function getLawSearchText(law: VerifiedLaw): string {
  return [law.title, law.summary, law.sections.join(' '), law.content.slice(0, MAX_SEARCH_CONTENT)]
    .join(' ')
    .toLowerCase();
}

function getFallbackReferenceKind(law: VerifiedLaw): ReferenceKind {
  const text = `${law.title} ${law.sections.join(' ')}`.toLowerCase();

  if (text.includes('article')) return 'article';
  if (text.includes('section')) return 'section';
  if (text.includes('chapter')) return 'chapter';
  if (text.includes('part')) return 'part';
  if (text.includes('clause')) return 'clause';

  return 'provision';
}

function getFallbackSourceTitle(law: VerifiedLaw): string {
  const articleMatch = law.title.match(/^(.+?)\s+(Article|Section|Chapter|Part|Clause)\b/i);
  if (articleMatch?.[1]) return normalizeWhitespace(articleMatch[1]);
  return normalizeWhitespace(law.title);
}

function findKnownSource(law: VerifiedLaw): LawSourceDefinition | null {
  const searchText = getLawSearchText(law);
  let bestMatch: { source: LawSourceDefinition; score: number } | null = null;

  for (const source of KNOWN_LAW_SOURCES) {
    const score = source.matchers.reduce(
      (total, matcher) => total + (matcher.test(searchText) ? 1 : 0),
      0,
    );

    if (score === 0) continue;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { source, score };
    }
  }

  return bestMatch?.source || null;
}

export function classifyLawSource(law: VerifiedLaw): LawSourceInfo {
  const knownSource = findKnownSource(law);

  if (knownSource) {
    return {
      id: knownSource.id,
      title: knownSource.title,
      category: knownSource.category || law.category,
      priority: knownSource.priority,
      referenceKind: knownSource.referenceKind,
      sectionLabel: getSectionLabel(knownSource.referenceKind),
    };
  }

  const referenceKind = getFallbackReferenceKind(law);
  const fallbackTitle = getFallbackSourceTitle(law) || 'Other Law';

  return {
    id: slugify(fallbackTitle) || law.id,
    title: fallbackTitle,
    category: law.category,
    priority: 900,
    referenceKind,
    sectionLabel: getSectionLabel(referenceKind),
  };
}

function getReferenceSortParts(reference: string): { number: number; suffix: string } {
  const digitMatch = reference.match(/(\d+)([A-Za-z]?)/);
  if (digitMatch) {
    return {
      number: Number.parseInt(digitMatch[1], 10),
      suffix: (digitMatch[2] || '').toLowerCase(),
    };
  }

  const romanMatch = reference.match(/\b([IVXLCDM]+)\b/i);
  if (romanMatch?.[1]) {
    return {
      number: romanToNumber(romanMatch[1]),
      suffix: '',
    };
  }

  return {
    number: Number.MAX_SAFE_INTEGER,
    suffix: reference.toLowerCase(),
  };
}

function extractPrimaryReference(law: VerifiedLaw, source: LawSourceInfo): string {
  const searchTargets = [
    law.title,
    ...law.sections,
    law.summary,
    law.content.slice(0, MAX_REFERENCE_SCAN_CONTENT),
  ];
  const preferredKinds: ReferenceKind[] = [
    source.referenceKind,
    'article',
    'section',
    'chapter',
    'part',
    'clause',
  ];

  for (const kind of preferredKinds) {
    const matcher = new RegExp(REFERENCE_PATTERNS[kind].source, 'i');
    for (const target of searchTargets) {
      const match = target.match(matcher);
      if (match?.[0]) {
        const normalized = normalizeWhitespace(match[0]);
        return /^article|section|chapter|part|clause|provision/i.test(normalized)
          ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
          : toTitleCase(normalized);
      }
    }
  }

  if (law.sections[0]) return normalizeWhitespace(law.sections[0]);
  return source.title;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeHeading(value: string): string {
  return normalizeWhitespace(value).replace(/[:\-–—]+$/, '');
}

function collectAnchorsFromLabels(content: string, labels: string[]): ChunkAnchor[] {
  const anchors: ChunkAnchor[] = [];

  for (const label of labels) {
    const normalizedLabel = normalizeHeading(label);
    if (normalizedLabel.length < 4) continue;

    const regex = new RegExp(escapeRegExp(normalizedLabel), 'gi');
    const match = regex.exec(content);
    if (!match || typeof match.index !== 'number') continue;

    anchors.push({
      heading: normalizedLabel,
      index: match.index,
    });
  }

  return anchors;
}

function collectAnchorsFromContent(content: string, referenceKind: ReferenceKind): ChunkAnchor[] {
  const anchors: ChunkAnchor[] = [];
  const pattern = REFERENCE_PATTERNS[referenceKind];

  for (const match of content.matchAll(pattern)) {
    if (!match[0] || typeof match.index !== 'number') continue;
    anchors.push({
      heading: normalizeHeading(match[0]),
      index: match.index,
    });
  }

  return anchors;
}

function dedupeAnchors(anchors: ChunkAnchor[]): ChunkAnchor[] {
  const seen = new Set<string>();

  return [...anchors]
    .sort((a, b) => a.index - b.index)
    .filter((anchor) => {
      const key = `${anchor.index}:${anchor.heading.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((anchor, index, arr) => {
      if (index === 0) return true;
      const previous = arr[index - 1];
      if (
        previous &&
        anchor.heading.toLowerCase() === previous.heading.toLowerCase() &&
        Math.abs(anchor.index - previous.index) < 12
      ) {
        return false;
      }
      return true;
    });
}

function createChunkPreview(content: string): string {
  const normalized = normalizeWhitespace(content);
  if (normalized.length <= CHUNK_PREVIEW_LENGTH) return normalized;
  return `${normalized.slice(0, CHUNK_PREVIEW_LENGTH).trim()}...`;
}

function buildChunksFromAnchors(content: string, anchors: ChunkAnchor[]): OrganizedLawChunk[] {
  const dedupedAnchors = dedupeAnchors(anchors);
  const chunks: OrganizedLawChunk[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < dedupedAnchors.length; index += 1) {
    const anchor = dedupedAnchors[index];
    const nextAnchor = dedupedAnchors[index + 1];
    const chunkContent = content
      .slice(anchor.index, nextAnchor ? nextAnchor.index : content.length)
      .trim();

    if (!chunkContent) continue;

    const sortParts = getReferenceSortParts(anchor.heading);
    const normalizedSignature = `${anchor.heading.toLowerCase()}::${normalizeWhitespace(
      chunkContent.slice(0, 160).toLowerCase(),
    )}`;
    if (seen.has(normalizedSignature)) continue;
    seen.add(normalizedSignature);

    chunks.push({
      id: `${slugify(anchor.heading) || 'chunk'}-${index}`,
      heading: anchor.heading,
      content: chunkContent,
      preview: createChunkPreview(chunkContent),
      sortNumber: sortParts.number,
      sortSuffix: sortParts.suffix,
    });
  }

  return chunks;
}

function buildParagraphChunks(content: string, referenceKind: ReferenceKind): OrganizedLawChunk[] {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [];

  const chunks: OrganizedLawChunk[] = [];
  let buffer = '';
  let chunkIndex = 1;

  const pushChunk = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return;

    const headingBase =
      referenceKind === 'article'
        ? 'Article Text'
        : referenceKind === 'section'
        ? 'Section Text'
        : 'Law Text';

    chunks.push({
      id: `chunk-${chunkIndex}`,
      heading: `${headingBase} ${chunkIndex}`,
      content: cleaned,
      preview: createChunkPreview(cleaned),
      sortNumber: chunkIndex,
      sortSuffix: '',
    });
    chunkIndex += 1;
  };

  for (const paragraph of paragraphs) {
    if (!buffer) {
      buffer = paragraph;
      continue;
    }

    if ((buffer.length + paragraph.length + 2) <= CHUNK_PARAGRAPH_TARGET) {
      buffer = `${buffer}\n\n${paragraph}`;
      continue;
    }

    pushChunk(buffer);
    buffer = paragraph;
  }

  pushChunk(buffer);
  return chunks;
}

function createChunksForLaw(law: VerifiedLaw, primaryReference: string, source: LawSourceInfo) {
  const content = law.content.trim();
  if (!content) return [];

  const candidateLabels = Array.from(
    new Set(
      [primaryReference, ...law.sections]
        .map(normalizeHeading)
        .filter((value) => value.length > 0),
    ),
  );

  const labelAnchors = collectAnchorsFromLabels(content, candidateLabels);
  const referenceAnchors = collectAnchorsFromContent(content, source.referenceKind);
  const chunksFromAnchors = buildChunksFromAnchors(content, [...labelAnchors, ...referenceAnchors]);

  if (chunksFromAnchors.length > 0) return chunksFromAnchors;

  return buildParagraphChunks(content, source.referenceKind);
}

function shouldGroupByReference(entry: OrganizedLawEntry): boolean {
  const normalizedTitle = normalizeWhitespace(entry.law.title).toLowerCase();
  const normalizedSource = normalizeWhitespace(entry.source.title).toLowerCase();
  const normalizedReference = normalizeWhitespace(entry.primaryReference).toLowerCase();

  if (entry.law.sections.length > 1) return false;
  if (!normalizedReference || normalizedReference === normalizedSource) return false;
  if (normalizedTitle === normalizedSource) return true;
  if (normalizedTitle === normalizedReference) return true;
  if (normalizedTitle.includes(normalizedReference)) return true;
  if (/^(article|section|chapter|part|clause)\b/i.test(entry.law.title)) return true;

  return false;
}

function getTopicKey(entry: OrganizedLawEntry): string {
  const keyBase = shouldGroupByReference(entry)
    ? entry.primaryReference || entry.law.title
    : entry.law.title || entry.primaryReference;

  return `${entry.source.id}:${slugify(keyBase) || entry.law.id}`;
}

function chooseTopicTitle(entries: OrganizedLawEntry[], source: LawSourceInfo): string {
  const firstNonSourceTitle = entries.find(
    (entry) =>
      normalizeWhitespace(entry.law.title).toLowerCase() !==
      normalizeWhitespace(source.title).toLowerCase(),
  );

  return firstNonSourceTitle?.law.title || entries[0]?.law.title || source.title;
}

function chooseTopicSummary(entries: OrganizedLawEntry[]): string {
  return [...entries]
    .map((entry) => entry.law.summary)
    .sort((a, b) => b.length - a.length)[0] || '';
}

function dedupeChunks(chunks: OrganizedLawChunk[]): OrganizedLawChunk[] {
  const seen = new Set<string>();

  return [...chunks]
    .sort((a, b) => {
      if (a.sortNumber !== b.sortNumber) return a.sortNumber - b.sortNumber;
      if (a.sortSuffix !== b.sortSuffix) return a.sortSuffix.localeCompare(b.sortSuffix);
      return a.heading.localeCompare(b.heading);
    })
    .filter((chunk) => {
      const key = `${chunk.heading.toLowerCase()}::${normalizeWhitespace(
        chunk.content.slice(0, 200).toLowerCase(),
      )}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function createOrganizedLawEntry(law: VerifiedLaw): OrganizedLawEntry {
  const source = classifyLawSource(law);
  const primaryReference = extractPrimaryReference(law, source);
  const sortParts = getReferenceSortParts(primaryReference);

  return {
    law,
    source,
    primaryReference,
    sortNumber: sortParts.number,
    sortSuffix: sortParts.suffix,
  };
}

export function organizeLawsBySource(laws: VerifiedLaw[]): OrganizedLawGroup[] {
  const sourceGroups = new Map<
    string,
    {
      source: LawSourceInfo;
      topics: Map<string, OrganizedLawEntry[]>;
    }
  >();

  for (const law of laws) {
    const entry = createOrganizedLawEntry(law);
    const groupKey = entry.source.id;
    const existingGroup = sourceGroups.get(groupKey);

    if (!existingGroup) {
      sourceGroups.set(groupKey, {
        source: entry.source,
        topics: new Map([[getTopicKey(entry), [entry]]]),
      });
      continue;
    }

    const topicKey = getTopicKey(entry);
    const existingEntries = existingGroup.topics.get(topicKey);
    if (existingEntries) {
      existingEntries.push(entry);
    } else {
      existingGroup.topics.set(topicKey, [entry]);
    }
  }

  return Array.from(sourceGroups.values())
    .map(({ source, topics }) => ({
      source,
      topics: Array.from(topics.values())
        .map((entries) => {
          const representative = [...entries].sort((a, b) => {
            if (a.sortNumber !== b.sortNumber) return a.sortNumber - b.sortNumber;
            if (a.sortSuffix !== b.sortSuffix) return a.sortSuffix.localeCompare(b.sortSuffix);
            return a.law.title.localeCompare(b.law.title);
          })[0];

          const chunks = dedupeChunks(
            entries.flatMap((entry) =>
              createChunksForLaw(entry.law, entry.primaryReference, entry.source),
            ),
          );

          const typeValues = Array.from(new Set(entries.map((entry) => entry.law.type)));

          return {
            id: getTopicKey(representative),
            source,
            title: chooseTopicTitle(entries, source),
            primaryReference: representative.primaryReference,
            summary: chooseTopicSummary(entries),
            category: representative.law.category,
            type: typeValues.length === 1 ? typeValues[0] : 'mixed',
            chunks,
            laws: entries.map((entry) => entry.law),
            sortNumber: representative.sortNumber,
            sortSuffix: representative.sortSuffix,
          } satisfies OrganizedLawTopic;
        })
        .sort((a, b) => {
          if (a.sortNumber !== b.sortNumber) return a.sortNumber - b.sortNumber;
          if (a.sortSuffix !== b.sortSuffix) return a.sortSuffix.localeCompare(b.sortSuffix);
          return a.title.localeCompare(b.title);
        }),
    }))
    .sort((a, b) => {
      if (a.source.priority !== b.source.priority) {
        return a.source.priority - b.source.priority;
      }
      return a.source.title.localeCompare(b.source.title);
    });
}

export function matchesLawSearch(law: VerifiedLaw, query: string): boolean {
  return getLawSearchText(law).includes(query.toLowerCase());
}

export function matchesTopicSearch(topic: OrganizedLawTopic, query: string): boolean {
  const loweredQuery = query.toLowerCase();

  if (topic.title.toLowerCase().includes(loweredQuery)) return true;
  if (topic.primaryReference.toLowerCase().includes(loweredQuery)) return true;
  if (topic.summary.toLowerCase().includes(loweredQuery)) return true;
  if (topic.source.title.toLowerCase().includes(loweredQuery)) return true;
  if (
    topic.chunks.some(
      (chunk) =>
        chunk.heading.toLowerCase().includes(loweredQuery) ||
        chunk.content.toLowerCase().includes(loweredQuery),
    )
  ) {
    return true;
  }

  return topic.laws.some((law) => matchesLawSearch(law, query));
}
