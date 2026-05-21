import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Library,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Loader2,
  X,
  Scale,
  FileText,
  ExternalLink,
  FileUp,
  User,
} from 'lucide-react';
import { LEGAL_DOMAINS } from '../constants';
import { subscribeToAllLaws } from '../firebase';
import type { VerifiedLaw } from '../types';
import type { OrganizedLawTopic } from '../lawOrganization';
import {
  classifyLawSource,
  matchesTopicSearch,
  organizeLawsBySource,
} from '../lawOrganization';

export const RepositoryView: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [approvedLaws, setApprovedLaws] = React.useState<VerifiedLaw[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedTopicId, setExpandedTopicId] = React.useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [previewTopic, setPreviewTopic] = React.useState<OrganizedLawTopic | null>(null);

  React.useEffect(() => {
    setLoading(true);

    const unsubscribe = subscribeToAllLaws(
      (laws) => {
        setApprovedLaws(laws.filter((law) => law.status === 'approved'));
        setLoading(false);
      },
      (error) => {
        console.error('Error loading approved laws:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const visibleDomains = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return LEGAL_DOMAINS
      .filter((domain) => !selectedCategory || domain.id === selectedCategory)
      .map((domain) => {
        const domainLaws = approvedLaws.filter((law) => law.category === domain.id);
        const groupedSources = organizeLawsBySource(domainLaws)
          .map((group) => {
            const sourceMatches = query && group.source.title.toLowerCase().includes(query);
            const filteredTopics = !query
              ? group.topics
              : sourceMatches
              ? group.topics
              : group.topics.filter((topic) => matchesTopicSearch(topic, query));

            return {
              ...group,
              topics: filteredTopics,
            };
          })
          .filter((group) => group.topics.length > 0);

        const domainMatches =
          query.length > 0 &&
          (domain.title.toLowerCase().includes(query) ||
            domain.description.toLowerCase().includes(query));

        return {
          domain,
          groups: groupedSources,
          totalTopics: groupedSources.reduce((total, group) => total + group.topics.length, 0),
          hasMatch: groupedSources.length > 0 || domainMatches,
        };
      })
      .filter((item) => {
        if (selectedCategory) return true;
        if (!query) return item.groups.length > 0;
        return item.hasMatch;
      });
  }, [approvedLaws, searchQuery, selectedCategory]);

  const categoryCounts = React.useMemo(() => {
    return LEGAL_DOMAINS.reduce<Record<string, number>>((counts, domain) => {
      counts[domain.id] = organizeLawsBySource(
        approvedLaws.filter((law) => law.category === domain.id),
      ).reduce((total, group) => total + group.topics.length, 0);
      return counts;
    }, {});
  }, [approvedLaws]);

  const previewSource = React.useMemo(
    () => (previewTopic ? classifyLawSource(previewTopic.laws[0]) : null),
    [previewTopic],
  );

  // Get unique source PDFs for a topic
  const getTopicSources = (topic: OrganizedLawTopic) => {
    const seen = new Set<string>();
    return topic.laws
      .filter((law) => {
        const key = law.pdfUrl || law.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((law) => ({
        id: law.id,
        name: law.originalFileName || law.title,
        pdfUrl: law.pdfUrl,
        uploaderName: law.uploaderName,
        type: law.type,
        createdAt: law.createdAt,
      }));
  };

  const getCategoryColor = (catId: string) => {
    const colors: Record<string, string> = {
      constitutional: 'from-indigo-500 to-purple-600',
      civil: 'from-blue-500 to-cyan-600',
      criminal: 'from-red-500 to-rose-600',
      corporate: 'from-slate-500 to-gray-700',
      labour: 'from-amber-500 to-orange-600',
    };
    return colors[catId] || 'from-gray-500 to-gray-700';
  };

  const getCategoryBg = (catId: string) => {
    const colors: Record<string, string> = {
      constitutional: 'bg-indigo-50 border-indigo-200',
      civil: 'bg-blue-50 border-blue-200',
      criminal: 'bg-red-50 border-red-200',
      corporate: 'bg-slate-50 border-slate-200',
      labour: 'bg-amber-50 border-amber-200',
    };
    return colors[catId] || 'bg-gray-50 border-gray-200';
  };

  const totalApproved = approvedLaws.length;

  // Clear search handler
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="h-full overflow-y-auto">
      <header className="px-4 sm:px-6 md:px-10 py-5 sm:py-8 md:py-10 border-b border-outline-variant bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold">
                    Study Law
                  </h1>
                  <p className="text-on-surface-variant text-sm">
                    {totalApproved} approved laws organized into topics and section chunks
                  </p>
                </div>
              </div>
            </div>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search laws, articles, sections..."
                className="w-full pl-12 pr-10 py-3 md:py-4 bg-surface rounded-xl border border-outline outline-none focus:ring-2 focus:ring-black/5"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-5 sm:mt-6 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                !selectedCategory
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white border border-outline-variant text-on-surface-variant hover:bg-slate-50'
              }`}
            >
              All Domains
            </button>
            {LEGAL_DOMAINS.map((domain) => (
              <button
                key={domain.id}
                onClick={() =>
                  setSelectedCategory(selectedCategory === domain.id ? null : domain.id)
                }
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  selectedCategory === domain.id
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white border border-outline-variant text-on-surface-variant hover:bg-slate-50'
                }`}
              >
                {domain.title}
                {categoryCounts[domain.id] > 0 && (
                  <span className="ml-1 opacity-60">({categoryCounts[domain.id]})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto pb-24 md:pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-on-surface-variant" />
              <p className="text-on-surface-variant font-medium">
                Loading study materials...
              </p>
            </div>
          </div>
        ) : totalApproved === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-white p-10 text-center">
            <Scale className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-on-surface-variant">
              No approved laws are available yet
            </p>
            <p className="text-sm text-outline mt-1">
              Upload a law and approve it in the admin panel to make it appear here.
            </p>
          </div>
        ) : visibleDomains.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-lg">No results for &quot;{searchQuery}&quot;</p>
            <p className="text-sm mt-1">
              Try a different search term or browse another domain.
            </p>
            <button
              onClick={handleClearSearch}
              className="mt-4 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {visibleDomains.map(({ domain, groups, totalTopics }, index) => (
              <motion.div
                key={domain.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getCategoryColor(
                      domain.id,
                    )} flex items-center justify-center shadow-lg`}
                  >
                    <Library className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold">
                      {domain.title}
                    </h2>
                    <p className="text-on-surface-variant text-sm mt-0.5">
                      {domain.description}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-on-surface-variant bg-surface-container px-4 py-2 rounded-full hidden md:inline-flex">
                    {totalTopics} {totalTopics === 1 ? 'Topic' : 'Topics'}
                  </span>
                </div>

                {groups.length === 0 ? (
                  <div
                    className={`rounded-2xl p-8 text-center border ${getCategoryBg(domain.id)}`}
                  >
                    <Scale className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-on-surface-variant">
                      No approved laws in this domain yet
                    </p>
                    <p className="text-sm text-outline mt-1">
                      Approved laws will appear here automatically after admin review.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {groups.map((group) => (
                      <div
                        key={group.source.id}
                        className={`rounded-xl border p-4 md:p-6 ${getCategoryBg(domain.id)}`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-outline mb-1">
                              Source Law
                            </p>
                            <h3 className="text-xl md:text-2xl font-display font-bold">
                              {group.source.title}
                            </h3>
                            <p className="text-sm text-on-surface-variant mt-1">
                              Each topic expands into deduplicated {group.source.sectionLabel.toLowerCase()}
                            </p>
                          </div>
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-white border border-outline-variant text-xs font-bold text-on-surface-variant">
                            {group.topics.length} {group.topics.length === 1 ? 'Topic' : 'Topics'}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {group.topics.map((topic) => {
                            const isExpanded = expandedTopicId === topic.id;
                            const sources = getTopicSources(topic);

                            return (
                              <div
                                key={topic.id}
                                className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden"
                              >
                                <button
                                  onClick={() =>
                                    setExpandedTopicId(isExpanded ? null : topic.id)
                                  }
                                  className="w-full text-left p-4 md:p-6 flex items-start justify-between gap-3 md:gap-4 hover:bg-slate-50 transition-colors"
                                >
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-outline mb-1">
                                      {topic.primaryReference}
                                    </p>
                                    <h4 className="font-display font-bold text-base md:text-lg leading-tight">
                                      {topic.title}
                                    </h4>
                                    <p className="text-sm text-on-surface-variant mt-2">
                                      {topic.summary}
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap mt-3">
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface-container text-on-surface-variant border border-outline-variant">
                                        {topic.chunks.length} section chunks
                                      </span>
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface-container-low text-on-surface-variant border border-outline-variant">
                                        {topic.type === 'mixed'
                                          ? 'Mixed source'
                                          : topic.type === 'file'
                                          ? 'Uploaded file'
                                          : 'Text entry'}
                                      </span>
                                      {/* Source PDF badges */}
                                      {sources.some((s) => s.pdfUrl) && (
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                          <FileUp className="w-3 h-3" />
                                          PDF Source Available
                                        </span>
                                      )}
                                    </div>
                                    {/* Source info line */}
                                    {sources.length > 0 && (
                                      <div className="flex items-center gap-3 flex-wrap mt-2">
                                        {sources.map((src) => (
                                          <span key={src.id} className="text-[10px] text-on-surface-variant flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {src.uploaderName}
                                            {src.pdfUrl && (
                                              <a
                                                href={src.pdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-1 text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-0.5"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <ExternalLink className="w-3 h-3" />
                                                {src.name.length > 30 ? src.name.slice(0, 27) + '...' : src.name}
                                              </a>
                                            )}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setPreviewTopic(topic);
                                      }}
                                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Read topic"
                                    >
                                      <BookOpen className="w-4 h-4" />
                                    </button>
                                    {isExpanded ? (
                                      <ChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                      <ChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                  </div>
                                </button>

                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden border-t border-slate-100"
                                    >
                                      <div className="p-5 md:p-6 space-y-3 bg-slate-50/70">
                                        {/* Source documents section */}
                                        {sources.length > 0 && sources.some((s) => s.pdfUrl) && (
                                          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">
                                              Original Source Documents
                                            </p>
                                            <div className="space-y-2">
                                              {sources.filter((s) => s.pdfUrl).map((src) => (
                                                <a
                                                  key={src.id}
                                                  href={src.pdfUrl!}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center justify-between gap-3 p-3 bg-white border border-blue-100 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group"
                                                >
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                                    <div className="min-w-0">
                                                      <p className="text-sm font-bold text-blue-800 truncate">
                                                        {src.name}
                                                      </p>
                                                      <p className="text-[10px] text-blue-600">
                                                        Uploaded by {src.uploaderName} • {src.createdAt.toLocaleDateString()}
                                                      </p>
                                                    </div>
                                                  </div>
                                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-md group-hover:bg-blue-700 transition-colors shrink-0">
                                                    <ExternalLink className="w-3 h-3" /> View PDF
                                                  </span>
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {topic.chunks.map((chunk) => (
                                          <div
                                            key={chunk.id}
                                            className="rounded-xl border border-outline-variant bg-white p-4"
                                          >
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                              <h5 className="font-bold text-sm md:text-base">
                                                {chunk.heading}
                                              </h5>
                                              <span className="text-[10px] font-black uppercase tracking-widest text-outline">
                                                Chunk
                                              </span>
                                            </div>
                                            <p className="text-sm text-on-surface-variant leading-relaxed">
                                              {chunk.preview}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-b border-outline-variant mt-10" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewTopic && previewSource && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[100]"
              onClick={() => setPreviewTopic(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-3 md:inset-12 bg-white rounded-xl shadow-2xl z-[101] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 p-4 md:p-6 border-b border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getCategoryColor(
                      previewTopic.category,
                    )} flex items-center justify-center`}
                  >
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-display font-bold truncate">
                      {previewTopic.primaryReference}
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      {previewSource.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewTopic(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-4 md:px-6 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-surface-container text-on-surface-variant border-outline-variant">
                  {
                    LEGAL_DOMAINS.find((domain) => domain.id === previewTopic.category)?.title ||
                    previewTopic.category
                  }
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-surface-container-low text-on-surface-variant border-outline-variant">
                  {previewTopic.chunks.length} section chunks
                </span>
              </div>
              {/* Source PDF links in modal */}
              {(() => {
                const sources = getTopicSources(previewTopic).filter((s) => s.pdfUrl);
                if (sources.length === 0) return null;
                return (
                  <div className="px-4 md:px-6 py-3 border-b border-slate-100 bg-blue-50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">
                      Original Source Documents
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sources.map((src) => (
                        <a
                          key={src.id}
                          href={src.pdfUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {src.name.length > 40 ? src.name.slice(0, 37) + '...' : src.name}
                        </a>
                      ))}
                    </div>
                    <p className="text-[10px] text-blue-600 mt-1.5">
                      Uploaded by {sources.map((s) => s.uploaderName).join(', ')}
                    </p>
                  </div>
                );
              })()}
              {previewTopic.summary && (
                <div className="px-4 md:px-6 py-3 border-b border-slate-100 bg-surface-container-low">
                  <p className="text-sm text-on-surface-variant font-medium">
                    {previewTopic.summary}
                  </p>
                </div>
              )}
              <div className="px-4 md:px-6 pt-4">
                <h3 className="font-display font-bold text-lg">{previewTopic.title}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {previewTopic.chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="rounded-xl border border-outline-variant bg-white p-5"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h4 className="font-display font-bold text-base md:text-lg">
                        {chunk.heading}
                      </h4>
                      <span className="text-[10px] font-black uppercase tracking-widest text-outline">
                        Section Chunk
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-on-surface font-sans leading-relaxed">
                      {chunk.content}
                    </pre>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
