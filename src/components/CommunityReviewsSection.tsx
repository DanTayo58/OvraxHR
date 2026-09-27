import React, { useState, useEffect, useRef } from 'react';
import {
  Star,
  Plus,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Edit3,
  Trash2,
  Send,
  X,
  Check,
  Building2,
  MessageSquare,
  ShieldCheck,
  CornerDownRight,
  Filter,
  Key,
  ExternalLink,
  Upload,
  AlertCircle,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { AppSettings, User, PlatformReview, ReviewReply } from '../types';
import { getActiveCompanyId, getActiveSessionCompany } from '../utils/companyStorage';
import { getCentralCompanyLogo, saveCentralCompanyLogo } from '../utils/logoStorage';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  loadAllPlatformReviews,
  addPlatformReview,
  updatePlatformReview,
  deletePlatformReview,
  toggleReviewReaction,
  addReviewReply,
  deleteReviewReply,
  REVIEW_CATEGORIES,
} from '../utils/reviewsAndTickets';

interface CommunityReviewsSectionProps {
  user: User;
  settings?: AppSettings;
  isLight?: boolean;
  searchQuery?: string;
  onOpenSettings?: () => void;
}

export const CommunityReviewsSection: React.FC<CommunityReviewsSectionProps> = ({
  user,
  settings,
  isLight = false,
  searchQuery = '',
  onOpenSettings,
}) => {
  const [reviewsList, setReviewsList] = useState<PlatformReview[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Write Review Modal State
  const [isAddingReview, setIsAddingReview] = useState(false);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewCategory, setReviewCategory] = useState<string>(REVIEW_CATEGORIES[0]);
  const [customLogoUrl, setCustomLogoUrl] = useState<string | undefined>(undefined);
  
  // My Reviews Modal State
  const [isMyReviewsOpen, setIsMyReviewsOpen] = useState(false);

  // Edit Review Modal State
  const [editingReview, setEditingReview] = useState<PlatformReview | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editRating, setEditRating] = useState<number>(5);
  const [editHoverRating, setEditHoverRating] = useState<number>(0);
  const [editCategory, setEditCategory] = useState<string>(REVIEW_CATEGORIES[0]);

  // Reply State
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  // Expand writeups
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<string>>(new Set());
  const [expandedCommentsReviewIds, setExpandedCommentsReviewIds] = useState<Set<string>>(new Set());
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // In-app Confirmation Modal for safe deletion without window.confirm blocking
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemName?: string;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const companyId = getActiveCompanyId(user.companyId || user.company || settings?.companyId);
  const companyName = user.company || settings?.companyName || getActiveSessionCompany() || 'Verified Organization';

  // Check if current user is part of support / technical team or super admin
  const isSupportStaff = Boolean(
    user.isInternalCrew ||
    user.isSuperAdmin ||
    user.role === 'SuperAdmin' ||
    (user.username && user.username.startsWith('entry-rheivatech-')) ||
    user.departmentId ||
    user.departmentName
  );

  // Check if logo is already configured from Settings modal / centralized storage
  const centralCompanyLogo = getCentralCompanyLogo(companyId || companyName);
  const settingsCompanyLogo =
    settings?.companyLogo ||
    settings?.jdLogo ||
    settings?.confirmationLogo ||
    settings?.appointmentLogo;
  const hasSettingsLogo = Boolean(settingsCompanyLogo || centralCompanyLogo);

  // Resolved active company logo from centralized store and settings
  const resolvedCompanyLogo =
    settingsCompanyLogo ||
    centralCompanyLogo ||
    customLogoUrl ||
    undefined;

  const currentUserId = user.id || user.email || user.username || user.name || 'anonymous-user';

  const notify = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3500);
  };

  useEffect(() => {
    setReviewsList(loadAllPlatformReviews());
    const handleUpdated = () => setReviewsList(loadAllPlatformReviews());
    const handleLogoSync = () => {
      const central = getCentralCompanyLogo(companyId || companyName);
      if (central) setCustomLogoUrl(central);
    };
    window.addEventListener('skima_reviews_updated', handleUpdated);
    window.addEventListener('skima_logo_updated', handleLogoSync);
    return () => {
      window.removeEventListener('skima_reviews_updated', handleUpdated);
      window.removeEventListener('skima_logo_updated', handleLogoSync);
    };
  }, [companyId, companyName, settings?.companyLogo, settings?.jdLogo]);

  // Check if a review belongs to the active user or their organization
  const isAuthor = (r: PlatformReview): boolean => {
    if (r.authorId && (r.authorId === user.id || r.authorId === currentUserId)) return true;
    if (r.authorName && user.name && r.authorName.trim().toLowerCase() === user.name.trim().toLowerCase()) return true;
    if (r.companyId && companyId && r.companyId === companyId) return true;
    if (r.companyName && companyName && r.companyName.trim().toLowerCase() === companyName.trim().toLowerCase()) return true;
    return false;
  };

  // Get user's own reviews
  const myReviews = reviewsList.filter(isAuthor);

  // Logo upload helper - Centralized system-wide
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('Image file must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCustomLogoUrl(base64);
      saveCentralCompanyLogo(base64, companyId || companyName);
      notify('Company logo updated and centralized across your organization.');
    };
    reader.readAsDataURL(file);
  };

  // Submit new review (Support staff are barred from writing reviews)
  const handleCreateReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSupportStaff) {
      notify('Support staff members are not permitted to publish client reviews.');
      setIsAddingReview(false);
      return;
    }
    if (!reviewTitle.trim() || !reviewContent.trim()) {
      notify('Please enter a review topic and writeup.');
      return;
    }

    const effectiveLogoToSave = getCentralCompanyLogo(companyId || companyName) || resolvedCompanyLogo;

    addPlatformReview({
      authorId: user.id || currentUserId,
      authorName: user.name || 'Anonymous Contributor',
      companyName: companyName,
      companyId: companyId,
      companyLogo: effectiveLogoToSave,
      rating: reviewRating,
      category: reviewCategory,
      title: reviewTitle.trim(),
      content: reviewContent.trim(),
    });

    setReviewsList(loadAllPlatformReviews());
    setIsAddingReview(false);
    setReviewTitle('');
    setReviewContent('');
    setReviewRating(5);
    setReviewCategory(REVIEW_CATEGORIES[0]);
    notify('Your review has been successfully published!');
  };

  // Open Edit Modal
  const handleStartEdit = (r: PlatformReview) => {
    setEditingReview(r);
    setEditTitle(r.title);
    setEditContent(r.content);
    setEditRating(r.rating || 5);
    setEditCategory(r.category || REVIEW_CATEGORIES[0]);
  };

  // Save Edited Review
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;
    if (!editTitle.trim() || !editContent.trim()) {
      notify('Please fill in both title and writeup.');
      return;
    }

    const effectiveLogo = resolvedCompanyLogo || editingReview.companyLogo;

    updatePlatformReview(editingReview.id, {
      title: editTitle.trim(),
      content: editContent.trim(),
      rating: editRating,
      category: editCategory,
      companyLogo: effectiveLogo,
    });

    setReviewsList(loadAllPlatformReviews());
    setEditingReview(null);
    notify('Review updated successfully!');
  };

  // Delete Review
  const handleDelete = (reviewId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Review',
      message: 'Are you sure you want to permanently delete this review?',
      action: () => {
        deletePlatformReview(reviewId);
        setReviewsList(loadAllPlatformReviews());
        notify('Review deleted.');
      },
    });
  };

  // Toggle Like / Dislike
  const handleReaction = (reviewId: string, type: 'like' | 'dislike') => {
    toggleReviewReaction(reviewId, currentUserId, type);
    setReviewsList(loadAllPlatformReviews());
  };

  // Toggle Read More / Less
  const toggleExpand = (id: string) => {
    setExpandedReviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle Show / Hide Comments
  const toggleComments = (id: string) => {
    setExpandedCommentsReviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Submit Reply
  const handlePostReply = (reviewId: string) => {
    if (!replyMessage.trim()) return;
    const supportDept = user.departmentName || (isSupportStaff ? 'Customer Support & Helpdesk' : undefined);

    addReviewReply(reviewId, {
      authorId: currentUserId,
      authorName: user.name || (isSupportStaff ? 'OvraxHR Support Specialist' : 'Verified Member'),
      authorRole: isSupportStaff ? (supportDept || 'Support Desk') : companyName,
      companyName: isSupportStaff ? undefined : companyName,
      departmentName: isSupportStaff ? supportDept : undefined,
      message: replyMessage.trim(),
      isOfficialSupport: isSupportStaff,
    });
    setReviewsList(loadAllPlatformReviews());
    setReplyMessage('');
    setReplyingReviewId(null);
    notify('Reply posted to review.');
  };

  // Delete Comment (Allowed for comment author and support/technical team)
  const handleDeleteComment = (reviewId: string, replyId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Comment',
      message: 'Are you sure you want to permanently delete this comment from this review thread?',
      itemName: 'Comment',
      action: () => {
        deleteReviewReply(reviewId, replyId);
        setReviewsList(loadAllPlatformReviews());
        notify('Comment successfully removed.');
      },
    });
  };

  // Filter reviews
  const q = searchQuery.trim().toLowerCase();
  const filteredReviews = reviewsList.filter((r) => {
    const matchesCategory = selectedCategory === 'All' || r.category === selectedCategory;
    const matchesSearch =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q) ||
      r.authorName.toLowerCase().includes(q) ||
      r.companyName.toLowerCase().includes(q) ||
      (r.category && r.category.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Toast / Status Notification */}
      {statusNotification && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 shadow-lg animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Top Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border transition shadow-sm bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Star className="w-4 h-4 fill-amber-400" />
            </span>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Community & Organization Reviews
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700">
              {reviewsList.length} reviews
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Explore verified feedback from HR directors, shift managers, and enterprise admins. Share your team's experience with attendance, contracts, and payroll.
          </p>
        </div>

        {/* Action Buttons: For clients, "My Reviews" and "Write a Review"; For support staff, indicator */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {!isSupportStaff ? (
            <>
              {myReviews.length > 0 && (
                <button
                  type="button"
                  id="btn-my-reviews"
                  onClick={() => setIsMyReviewsOpen(true)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
                  }`}
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>My Reviews</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                    {myReviews.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                id="btn-write-review"
                onClick={() => setIsAddingReview(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-600/30 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Write a Review</span>
              </button>
            </>
          ) : (
            <div className="px-3.5 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Support Desk Official Replies & Moderation</span>
            </div>
          )}
        </div>
      </div>

      {/* Categories Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        <div className="flex items-center gap-1 text-xs font-bold text-slate-400 shrink-0 mr-1">
          <Filter className="w-3.5 h-3.5 text-indigo-400" />
          <span>Category:</span>
        </div>
        <button
          type="button"
          onClick={() => setSelectedCategory('All')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
            selectedCategory === 'All'
              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
              : isLight
              ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          All Categories ({reviewsList.length})
        </button>
        {REVIEW_CATEGORIES.map((cat) => {
          const count = reviewsList.filter((r) => r.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                  : isLight
                  ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {cat} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* WRITE A REVIEW MODAL / FORM */}
      {isAddingReview && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-8 ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
            }`}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Star className="w-5 h-5 fill-amber-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Create Community Review</h4>
                  <p className="text-xs text-slate-400">
                    Publish your feedback for the Skima help desk and enterprise network.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingReview(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="p-6 space-y-4">
              {/* Organization Profile & Logo Preview Display */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {resolvedCompanyLogo ? (
                    <img
                      src={resolvedCompanyLogo}
                      alt={companyName}
                      className="w-12 h-12 rounded-xl object-contain bg-white/10 p-1 border border-slate-700 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                      {companyName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-100">{companyName}</span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                        Verified
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Author: <strong className="text-indigo-300">{user.name || 'User'}</strong>
                    </p>
                    <p className="text-[10px] text-emerald-400/90 font-medium">
                      ✓ Company logo will be featured as the primary display image
                    </p>
                  </div>
                </div>

                {/* Upload or change logo button */}
                <div>
                  {hasSettingsLogo ? (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        disabled
                        title="Logo was uploaded from the settings modal. Upload is deactivated here to respect settings modal storage locations."
                        className="px-3 py-1.5 rounded-lg bg-slate-800/60 text-slate-400 text-xs font-semibold flex items-center gap-1.5 border border-slate-700/60 cursor-not-allowed opacity-70 select-none"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Logo Upload Deactivated</span>
                      </button>
                      <span className="text-[10px] text-slate-400">
                        Managed via Settings Modal
                      </span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>Upload Logo</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Star Rating Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Overall Rating (1 to 5 Stars):
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 p-2 rounded-xl bg-slate-950 border border-slate-800">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = star <= (hoverRating || reviewRating);
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setReviewRating(star)}
                          className="p-1 cursor-pointer transition transform hover:scale-110"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              isFilled
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {reviewRating}.0 of 5.0 Stars
                  </span>
                </div>
              </div>

              {/* Category Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Help Desk Category / Module:
                </label>
                <select
                  value={reviewCategory}
                  onChange={(e) => setReviewCategory(e.target.value)}
                  className={`w-full p-3 rounded-xl text-xs font-semibold outline-none border transition ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                >
                  {REVIEW_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Review Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Review Topic / Headline:
                </label>
                <input
                  type="text"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="e.g. Robust biometric clock-in parsing and zero-error payroll slips"
                  className={`w-full p-3 rounded-xl text-xs font-medium outline-none border transition ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                  required
                />
              </div>

              {/* Review Content */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Detailed Feedback & Experience:
                </label>
                <textarea
                  rows={4}
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="Describe your workflows with Skima, speed improvements, biometric syncing, or any recommendations for our engineering team..."
                  className={`w-full p-3 rounded-xl text-xs font-medium outline-none border transition leading-relaxed ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                  required
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingReview(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-600/30 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Review</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* "MY REVIEWS" MODAL */}
      {isMyReviewsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div
            className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden my-8 ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
            }`}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>My Reviews & Submissions</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                      {myReviews.length}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Manage, edit, or update your published feedback and view community responses.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMyReviewsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {myReviews.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 space-y-3">
                  <Star className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">You haven't posted any reviews yet</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Share feedback regarding attendance tracking, contract documents, or payroll slips to help the Skima team and other organizations.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMyReviewsOpen(false);
                      setIsAddingReview(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Write Your First Review</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {myReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3 relative group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {getCentralCompanyLogo(rev.companyId || rev.companyName) || resolvedCompanyLogo || rev.companyLogo ? (
                            <img
                              src={getCentralCompanyLogo(rev.companyId || rev.companyName) || resolvedCompanyLogo || rev.companyLogo}
                              alt={rev.companyName}
                              className="w-10 h-10 rounded-xl object-contain bg-white/10 p-0.5 border border-slate-700 shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                              {rev.companyName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-100">{rev.title}</span>
                              {rev.category && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 text-[10px] font-medium border border-slate-700">
                                  {rev.category}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 pt-0.5 text-[11px] text-slate-400">
                              <span>Posted on {new Date(rev.createdAt).toLocaleDateString()}</span>
                              {rev.updatedAt && (
                                <span className="text-amber-400 text-[10px] font-mono">
                                  (Edited {new Date(rev.updatedAt).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Edit & Delete Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(rev)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-indigo-500/30 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(rev.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/40 transition cursor-pointer"
                            title="Delete review"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Review details */}
                      <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-1 text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-mono font-bold text-amber-300 ml-1">
                            {rev.rating}.0 / 5.0
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{rev.content}</p>
                        
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-emerald-400 font-medium">
                              <ThumbsUp className="w-3 h-3" /> {rev.likes || 0}
                            </span>
                            <span className="flex items-center gap-1 text-rose-400 font-medium">
                              <ThumbsDown className="w-3 h-3" /> {rev.dislikes || 0}
                            </span>
                          </div>
                          {rev.replies && rev.replies.length > 0 && (
                            <span className="text-indigo-400 font-medium">
                              💬 {rev.replies.length} official {rev.replies.length === 1 ? 'reply' : 'replies'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMyReviewsOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT REVIEW MODAL */}
      {editingReview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-8 ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
            }`}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Edit Platform Review</h4>
                  <p className="text-xs text-slate-400">
                    Update your feedback, ratings, and module category.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingReview(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {/* Star Rating Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Rating:</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 p-2 rounded-xl bg-slate-950 border border-slate-800">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = star <= (editHoverRating || editRating);
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setEditHoverRating(star)}
                          onMouseLeave={() => setEditHoverRating(0)}
                          onClick={() => setEditRating(star)}
                          className="p-1 cursor-pointer transition transform hover:scale-110"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              isFilled
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {editRating}.0 of 5.0 Stars
                  </span>
                </div>
              </div>

              {/* Category Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Category / Module:
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className={`w-full p-3 rounded-xl text-xs font-semibold outline-none border transition ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                >
                  {REVIEW_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Review Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Title / Topic:</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={`w-full p-3 rounded-xl text-xs font-medium outline-none border transition ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                  required
                />
              </div>

              {/* Review Content */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Writeup:</label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={`w-full p-3 rounded-xl text-xs font-medium outline-none border transition leading-relaxed ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                  required
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingReview(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEWS GRID / LIST */}
      {filteredReviews.length === 0 ? (
        <div
          className={`p-12 text-center rounded-2xl border border-dashed space-y-3 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <Star className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h4 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-slate-300'}`}>
              No reviews match this filter
            </h4>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Try selecting "All Categories" or click "Write a Review" to publish the first review in this category.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReviews.map((r, idx) => {
            const isExpanded = expandedReviewIds.has(r.id);
            const userIsReviewAuthor = isAuthor(r);

            // Resilient logo resolution: client's settings modal logo, centralized store, or review logo
            const isClientReview =
              userIsReviewAuthor ||
              (r.companyId && companyId && r.companyId === companyId) ||
              (r.companyName && companyName && r.companyName.trim().toLowerCase() === companyName.trim().toLowerCase());

            const displayLogo = isClientReview
              ? (resolvedCompanyLogo || getCentralCompanyLogo(r.companyId) || getCentralCompanyLogo(r.companyName) || r.companyLogo)
              : (getCentralCompanyLogo(r.companyId) || getCentralCompanyLogo(r.companyName) || r.companyLogo);

            const hasLiked = (r.likedBy || []).includes(currentUserId);
            const hasDisliked = (r.dislikedBy || []).includes(currentUserId);

            return (
              <div
                key={`${r.id}-${idx}`}
                className={`p-5 rounded-2xl border space-y-3.5 shadow-sm transition ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                {/* Header: Company Logo / Avatar, Author Name, Company Description Div */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {displayLogo ? (
                      <img
                        src={displayLogo}
                        alt={r.companyName}
                        className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 border border-slate-700 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        {r.companyName ? r.companyName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                          {r.authorName}
                        </h4>
                        {/* Description div beside the name showing company name */}
                        <div className="px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 text-[10px] font-semibold border border-slate-700/80 flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5 text-indigo-400" />
                          <span>{r.companyName || 'Client Organization'}</span>
                        </div>
                        {userIsReviewAuthor && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 text-[9px] font-bold">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                    {userIsReviewAuthor && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(r)}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        title="Edit your review"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Content Bubble: Category Tag, Stars, Title, Writeup */}
                <div
                  className={`p-4 rounded-xl border space-y-2.5 ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : 'bg-slate-950/80 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < r.rating
                                ? 'text-amber-400 fill-amber-400'
                                : isLight
                                ? 'text-slate-300'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {r.rating}.0
                      </span>
                    </div>

                    {r.category && (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 text-[10px] font-bold border border-slate-700/80">
                        {r.category}
                      </span>
                    )}
                  </div>

                  <h5 className="text-xs sm:text-sm font-bold text-slate-100">{r.title}</h5>

                  <div className="space-y-1">
                    <p
                      className={`text-xs leading-relaxed text-slate-300 ${
                        !isExpanded ? 'line-clamp-2' : ''
                      }`}
                    >
                      {r.content}
                    </p>
                    {r.content.length > 100 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(r.id)}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300 inline-block cursor-pointer pt-0.5"
                      >
                        {isExpanded ? 'Read less ▲' : 'Read more ▼'}
                      </button>
                    )}
                  </div>

                  {/* Reaction Toolbar (Likes & Dislikes) and Reply Trigger */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      {/* Like Button */}
                      <button
                        type="button"
                        onClick={() => handleReaction(r.id, 'like')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                          hasLiked
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                        title="I find this review helpful"
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${hasLiked ? 'fill-amber-400' : ''}`} />
                        <span>{r.likes || 0}</span>
                      </button>

                      {/* Dislike Button */}
                      <button
                        type="button"
                        onClick={() => handleReaction(r.id, 'dislike')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                          hasDisliked
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                            : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Not helpful"
                      >
                        <ThumbsDown className={`w-3.5 h-3.5 ${hasDisliked ? 'fill-rose-400' : ''}`} />
                        <span>{r.dislikes || 0}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReplyingReviewId(replyingReviewId === r.id ? null : r.id);
                        setReplyMessage('');
                      }}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                      <span>{replyingReviewId === r.id ? 'Cancel' : 'Reply'}</span>
                    </button>
                  </div>
                </div>

                {/* Official Support Replies / Comments Thread */}
                {r.replies && r.replies.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-semibold text-slate-300">
                          {r.replies.length} {r.replies.length === 1 ? 'received comment' : 'received comments'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleComments(r.id)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-indigo-500/20"
                      >
                        <span>{expandedCommentsReviewIds.has(r.id) ? 'Hide comments' : 'Show comments'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedCommentsReviewIds.has(r.id) ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Collapsible comments list */}
                    {expandedCommentsReviewIds.has(r.id) && (
                      <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                        {r.replies.map((reply) => {
                          const isMyComment =
                            (reply.authorId && reply.authorId === currentUserId) ||
                            (reply.authorName && user.name && reply.authorName.trim().toLowerCase() === user.name.trim().toLowerCase());
                          const isModeratorOrSupport = isSupportStaff || user.role === 'Admin' || user.isAdmin || user.isSuperAdmin;
                          const canDeleteComment = isMyComment || isModeratorOrSupport;

                          return (
                            <div
                              key={reply.id}
                              className="p-3 rounded-xl bg-slate-950 border border-indigo-500/20 space-y-1.5 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-indigo-300">{reply.authorName}</span>
                                  {/* Description div beside name: Department for support desk, Company for clients */}
                                  <div
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                                      reply.isOfficialSupport
                                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                        : 'bg-slate-800 text-indigo-300 border-slate-700'
                                    }`}
                                  >
                                    {reply.isOfficialSupport ? (
                                      <>
                                        <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />
                                        <span>{reply.departmentName || reply.authorRole || 'Customer Support & Helpdesk'}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Building2 className="w-2.5 h-2.5 text-indigo-400" />
                                        <span>{reply.companyName || reply.authorRole || r.companyName || 'Client Organization'}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {new Date(reply.createdAt).toLocaleDateString()}
                                  </span>
                                  {canDeleteComment && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(r.id, reply.id)}
                                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/40 transition cursor-pointer"
                                      title={isModeratorOrSupport && !isMyComment ? 'Moderate/Remove comment' : 'Delete your comment'}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">{reply.message}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Inline Reply Composer */}
                {replyingReviewId === r.id && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-2 animate-in fade-in duration-150">
                    <div className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                      <CornerDownRight className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Respond as {user.name || 'Help Desk'}</span>
                    </div>
                    <textarea
                      rows={2}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Write a support or peer response to this review..."
                      className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs outline-none focus:border-indigo-500 leading-relaxed"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReplyingReviewId(null)}
                        className="px-2.5 py-1 text-xs text-slate-400 hover:text-white font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePostReply(r.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Submit Reply</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Skima Admin Control Page Access Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <span>Skima Master Admin Control Page</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                Super Admin
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Control portal for managing all enterprise reviews, official replies, and resolving tickets.
            </p>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3 text-xs font-mono self-start sm:self-auto">
          <div>
            <span className="text-slate-400 text-[10px] block font-sans">Login User:</span>
            <code className="text-indigo-300 font-bold">entry-rheivatech-admin</code>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div>
            <span className="text-slate-400 text-[10px] block font-sans">Password:</span>
            <code className="text-amber-400 font-bold">dantayo58</code>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        itemName={confirmModal.itemName}
        confirmLabel="Delete Review"
        isDestructive={true}
        onConfirm={() => {
          confirmModal.action();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
