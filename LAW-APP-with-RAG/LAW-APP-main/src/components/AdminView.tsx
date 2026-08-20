import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  X,
  FileText,
  User,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { approveLaw, rejectLaw, subscribeToAllLaws } from '../firebase';
import { indexLawForRag } from '../rag';
import type { UserProfile, VerifiedLaw } from '../types';
import { LEGAL_DOMAINS } from '../constants';

interface AdminViewProps {
  user: UserProfile;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export const AdminView: React.FC<AdminViewProps> = ({ user }) => {
  const [laws, setLaws] = React.useState<VerifiedLaw[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [previewLaw, setPreviewLaw] = React.useState<VerifiedLaw | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>('pending');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);

    const unsubscribe = subscribeToAllLaws(
      (allLaws) => {
        setLaws(allLaws);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading laws:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const handleApprove = async (lawId: string) => {
    setActionLoading(lawId);
    try {
      await approveLaw(lawId, user.uid);

      // Chunk + embed + store this law so it becomes retrievable in chat.
      // Runs once here, at approval time, instead of on every chat query.
      const law = laws.find((l) => l.id === lawId);
      if (law) {
        try {
          await indexLawForRag({ ...law, status: 'approved' });
        } catch (indexErr) {
          // Don't fail the approval if indexing hiccups — the law is still
          // approved and visible; it just won't be retrievable in chat yet.
          console.error('Error indexing law for RAG:', indexErr);
        }
      }
    } catch (err) {
      console.error('Error approving law:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (lawId: string) => {
    setActionLoading(lawId);
    try {
      await rejectLaw(lawId, user.uid);
    } catch (err) {
      console.error('Error rejecting law:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredLaws = filterStatus === 'all' ? laws : laws.filter((l) => l.status === filterStatus);

  const stats = {
    total: laws.length,
    pending: laws.filter((l) => l.status === 'pending').length,
    approved: laws.filter((l) => l.status === 'approved').length,
    rejected: laws.filter((l) => l.status === 'rejected').length,
  };

  const getCategoryLabel = (catId: string) => {
    const domain = LEGAL_DOMAINS.find((d) => d.id === catId);
    return domain?.title || catId;
  };

  const getCategoryColor = (catId: string) => {
    const colors: Record<string, string> = {
      constitutional: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      civil: 'bg-blue-100 text-blue-800 border-blue-200',
      criminal: 'bg-red-100 text-red-800 border-red-200',
      corporate: 'bg-slate-100 text-slate-800 border-slate-200',
      labour: 'bg-amber-100 text-amber-800 border-amber-200',
    };
    return colors[catId] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 md:space-y-8 h-full overflow-y-auto pb-24 md:pb-20">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold">Admin Panel</h1>
            <p className="text-on-surface-variant text-sm">Review and approve uploaded laws</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-outline-variant rounded-xl p-4 md:p-5 shadow-sm"
        >
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Total</p>
          <p className="text-2xl md:text-3xl font-display font-bold">{stats.total}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5 shadow-sm"
        >
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">Pending</p>
          <p className="text-2xl md:text-3xl font-display font-bold text-amber-900">{stats.pending}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-50 border border-green-200 rounded-xl p-4 md:p-5 shadow-sm"
        >
          <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-1">Approved</p>
          <p className="text-2xl md:text-3xl font-display font-bold text-green-900">{stats.approved}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-red-50 border border-red-200 rounded-xl p-4 md:p-5 shadow-sm"
        >
          <p className="text-xs font-bold text-red-700 uppercase tracking-widest mb-1">Rejected</p>
          <p className="text-2xl md:text-3xl font-display font-bold text-red-900">{stats.rejected}</p>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant pb-4 overflow-x-auto">
        <Filter className="w-4 h-4 text-on-surface-variant" />
        {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filterStatus === status
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-on-surface-variant hover:bg-slate-100 border border-outline-variant'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({status === 'pending' ? stats.pending : status === 'approved' ? stats.approved : stats.rejected})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Laws List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-on-surface-variant" />
        </div>
      ) : filteredLaws.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <FileText className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="font-bold text-lg">No {filterStatus === 'all' ? '' : filterStatus} laws found</p>
          <p className="text-sm mt-1">
            {filterStatus === 'pending'
              ? 'All caught up! No laws waiting for review.'
              : 'No laws match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLaws.map((law) => (
            <motion.div
              key={law.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all"
            >
              {/* Card Header */}
              <div className="p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-display font-bold text-lg truncate">{law.title}</h3>
                      {getStatusBadge(law.status)}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryColor(law.category)}`}>
                        {getCategoryLabel(law.category)}
                      </span>
                      <span className="text-xs text-on-surface-variant flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {law.uploaderName} ({law.uploaderEmail})
                      </span>
                      {law.pdfUrl && (
                        <a
                          href={law.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Original PDF
                        </a>
                      )}
                      <span className="text-xs text-outline">
                        {law.createdAt.toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex w-full md:w-auto flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPreviewLaw(law)}
                      className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Preview"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {law.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(law.id)}
                          disabled={actionLoading === law.id}
                          className="flex flex-1 md:flex-none items-center justify-center gap-1.5 px-4 py-2.5 bg-green-600 text-white font-bold text-sm rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 shadow-sm"
                        >
                          {actionLoading === law.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(law.id)}
                          disabled={actionLoading === law.id}
                          className="flex flex-1 md:flex-none items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 shadow-sm"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Summary */}
                <p className="text-sm text-on-surface-variant mt-3 leading-relaxed">{law.summary}</p>

                {/* Expandable sections */}
                {law.sections.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setExpandedId(expandedId === law.id ? null : law.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      {expandedId === law.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {law.sections.length} Sections
                    </button>
                    <AnimatePresence>
                      {expandedId === law.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {law.sections.map((s, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 bg-surface-container rounded-lg text-[11px] font-bold text-on-surface-variant border border-outline-variant"
                              >
                                {s.length > 50 ? s.slice(0, 50) + '...' : s}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewLaw && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[100]"
              onClick={() => setPreviewLaw(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-3 md:inset-16 bg-white rounded-xl shadow-2xl z-[101] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 p-4 md:p-6 border-b border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <h2 className="text-xl font-display font-bold truncate">{previewLaw.title}</h2>
                  {getStatusBadge(previewLaw.status)}
                </div>
                <button
                  onClick={() => setPreviewLaw(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getCategoryColor(previewLaw.category)}`}>
                  {getCategoryLabel(previewLaw.category)}
                </span>
                <span className="text-xs text-on-surface-variant">
                  Uploaded by {previewLaw.uploaderName}
                </span>
                {previewLaw.sections.map((s, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold"
                  >
                    {s}
                  </span>
                ))}
              </div>
              {previewLaw.summary && (
                <div className="px-6 py-3 border-b border-slate-100 bg-surface-container-low">
                  <p className="text-sm text-on-surface-variant font-medium">{previewLaw.summary}</p>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-6">
                <pre className="whitespace-pre-wrap text-sm text-on-surface font-sans leading-relaxed">
                  {previewLaw.content}
                </pre>
              </div>
              {previewLaw.status === 'pending' && (
                <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row sm:justify-end gap-3">
                  <button
                    onClick={() => {
                      handleReject(previewLaw.id);
                      setPreviewLaw(null);
                    }}
                    className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-700 transition-all"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={() => {
                      handleApprove(previewLaw.id);
                      setPreviewLaw(null);
                    }}
                    className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-green-600 text-white font-bold text-sm rounded-lg hover:bg-green-700 transition-all"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
