import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UserAvatar from "@/components/UserAvatar";
import EmptyState from "@/components/EmptyState";
import PostGallery from "@/components/PostGallery";
import ConfirmDialogBox from "@/components/ConfirmDialogBox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Post, Comment, ReactionType, UserRole } from "@/types";
import {
  ThumbsUp,
  Heart,
  HandHeart,
  Lightbulb,
  MessageCircle,
  Send,
  MoreHorizontal,
  Video,
  Image,
  FileText,
  Plus,
  PartyPopper,
  Laugh,
  Repeat2,
  Edit3,
  Trash2,
  ShieldAlert,
  Flag,
  Loader2,
} from "lucide-react";
import { cn, deduplicateById, getErrorMessage } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/components/ui/sonner";
import api from "@/services/api";
import { useNavigate } from "react-router-dom";
import PostForm from "@/components/PostForm";

const reactionConfig: Record<
  ReactionType,
  { icon: typeof ThumbsUp; label: string; color: string }
> = {
  LIKE: { icon: ThumbsUp, label: "Like", color: "text-primary" },
  CELEBRATE: {
    icon: PartyPopper,
    label: "Celebrate",
    color: "text-emerald-500",
  },
  SUPPORT: { icon: HandHeart, label: "Support", color: "text-warning" },
  LOVE: { icon: Heart, label: "Love", color: "text-destructive" },
  HAHA: { icon: Laugh, label: "Haha", color: "text-blue-500" },
  INSIGHTFUL: {
    icon: Lightbulb,
    label: "Insightful",
    color: "text-yellow-500",
  },
};

const WAIT_TIME = 100; // 100 ms
const MAX_ALLOWED_CHARACTERS = import.meta.env.VITE_MAX_ALLOWED_CHARACTERS;
const MAX_VISIBLE_CHARACTERS = 200;
const FEED_PAGE_LIMIT = import.meta.env.VITE_FEED_LIMIT;
const COMMENTS_PREVIEW_LIMIT = 3;

type AuthorSummaryRaw = {
  id: string;
  first_name: string;
  last_name: string;
  profile_pic?: string | null;
};

type PostActionType = "delete" | "adminDelete" | "report";

const ReactionButton = ({
  type,
  active,
  isReacting,
  onToggle,
  handleMouseEnter,
  handleMouseLeave,
}: {
  type: ReactionType;
  active: boolean;
  isReacting: boolean;
  onToggle: () => void;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
}) => {
  const config = reactionConfig[type];
  const Icon = config.icon;

  return (
    <button
      onClick={onToggle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={isReacting}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        active
          ? `${config.color} bg-secondary`
          : "text-muted-foreground hover:bg-secondary",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{type.toLocaleLowerCase()}</span>
    </button>
  );
};

const ReactionPicker = ({
  onReact,
  myReaction,
  isReacting,
}: {
  onReact: (type: ReactionType) => void;
  myReaction: ReactionType | null;
  isReacting: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    // If the mouse comes back before 500ms, cancel the closing timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    // Start a 500ms timer
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, WAIT_TIME);
  };

  const handleClick = (type: ReactionType) => {
    setOpen(false);
    onReact(type);
  };

  return (
    <div className="relative">
      <ReactionButton
        type={myReaction || "LIKE"}
        active={!!myReaction}
        isReacting={isReacting}
        onToggle={() => handleClick(myReaction || "LIKE")}
        handleMouseEnter={handleMouseEnter}
        handleMouseLeave={handleMouseLeave}
      />

      {!isReacting && open && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="absolute bottom-full left-0 sm:left-1/2 z-20 mb-2 flex sm:-translate-x-1/2 gap-1 rounded-full border bg-card p-1.5 shadow-xl animate-in fade-in zoom-in duration-200"
        >
          {(Object.keys(reactionConfig) as ReactionType[]).map((type) => {
            const config = reactionConfig[type];
            const Icon = config.icon;

            return (
              <button
                key={type}
                onClick={() => handleClick(type)}
                className={cn(
                  "rounded-full p-2 transition-transform hover:scale-125",
                  config.color,
                  "hover:bg-secondary",
                )}
                title={config.label}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CommentItem = ({ comment }: { comment: Comment }) => (
  <div className="flex gap-3">
    <UserAvatar name={comment.author.name} size="sm" />

    <div className="flex-1">
      <div className="rounded-xl bg-secondary px-4 py-2.5">
        <p className="text-sm font-semibold text-foreground">
          {comment.author.name}
        </p>
        <p className="text-sm text-foreground">{comment.content}</p>
      </div>
      <div className="mt-1 flex gap-4 px-2 text-xs text-muted-foreground">
        <span>
          {formatDistanceToNow(new Date(comment.updatedAt), {
            addSuffix: true,
          })}
        </span>
        <button className="font-medium hover:text-foreground">Like</button>
        <button className="font-medium hover:text-foreground">Reply</button>
      </div>
    </div>
  </div>
);

const PostCard = ({
  post,
  onFeedRefresh,
}: {
  post: Post;
  onFeedRefresh?: (options?: { reset?: boolean }) => Promise<void> | void;
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [hidePost, setHidePost] = useState<boolean>(true);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>("");
  const [isReacting, setIsReacting] = useState<boolean>(false);
  const [totalReactions, setTotalReactions] = useState<number>(
    post.totalReactions,
  );
  const [myReaction, setMyReaction] = useState<ReactionType | null>(
    post.myReaction,
  );
  const [reactionCounts, setReactionCounts] = useState<
    Record<ReactionType, number>
  >(post.reactionCounts);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] =
    useState<boolean>(false);
  const [isReposting, setIsReposting] = useState<boolean>(false);
  const [isRepostChoiceOpen, setIsRepostChoiceOpen] = useState<boolean>(false);
  const [isRepostThoughtsOpen, setIsRepostThoughtsOpen] =
    useState<boolean>(false);
  const [repostThoughts, setRepostThoughts] = useState<string>("");
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null);
  const [hasMoreComments, setHasMoreComments] = useState<boolean>(true);
  const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] =
    useState<boolean>(false);
  const [isActionConfirmOpen, setIsActionConfirmOpen] =
    useState<boolean>(false);
  const [selectedAction, setSelectedAction] = useState<PostActionType | null>(
    null,
  );
  const [isEditPostDialogOpen, setIsEditPostDialogOpen] =
    useState<boolean>(false);
  const [isUpdatingPost, setIsUpdatingPost] = useState<boolean>(false);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  const handleReact = async (type: ReactionType) => {
    console.log(`Reacted with ${type} on post ${post._id}`);

    setIsReacting(true);

    try {
      const previousReaction = myReaction;
      const payload = { postId: post._id, reactionType: type };
      const response = await api.post("/engagement/reactions", payload);

      console.log("Reaction API response:", response.data);
      const newReaction: ReactionType | null = response.data.newReaction;

      console.log("Reaction response:", newReaction);

      setReactionCounts((prev) => {
        const next = { ...prev };

        if (previousReaction) {
          next[previousReaction] = Math.max(
            0,
            (next[previousReaction] || 0) - 1,
          );
        }

        if (newReaction) {
          next[newReaction] = (next[newReaction] || 0) + 1;
        }

        return next;
      });

      setTotalReactions((prev) => {
        if (!previousReaction && newReaction) return prev + 1;
        if (previousReaction && !newReaction) return Math.max(0, prev - 1);
        return prev;
      });

      setMyReaction(newReaction);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Failed to react to post. Please try again."),
      );
    } finally {
      setIsReacting(false);
    }
  };

  const handleComment = async (postId: string) => {
    const willOpen = !showComments;
    setShowComments(willOpen);

    // Lazy-load the first page when opening for the first time
    if (willOpen && comments.length === 0) {
      await getComments(postId, true);
    }
  };

  const getComments = async (postId: string, reset = false) => {
    if (isLoadingComments || isLoadingMoreComments) return;
    if (!reset && !hasMoreComments) return;

    if (reset) {
      setIsLoadingComments(true);
    } else {
      setIsLoadingMoreComments(true);
    }

    try {
      const params = {
        limit: COMMENTS_PREVIEW_LIMIT + 1,
        ...(!reset && commentsCursor ? { cursor: commentsCursor } : {}),
      };

      // Get Comments
      const response = await api.get(`/engagement/comments/${postId}`, {
        params,
      });
      const { data, nextCursor } = response.data;

      // Get Authors
      const authorIds = Array.from(
        new Set(data.map((c) => c.authorId).filter(Boolean)),
      );

      if (!data || authorIds.length === 0) {
        setIsLoadingComments(false);
        setIsLoadingMoreComments(false);
        return;
      }

      const authorResponse = await api.get("/identity/users/summary", {
        params: { users: authorIds },
        paramsSerializer: { indexes: null },
      });

      const authors = authorResponse.data;
      const authorMap = new Map<string, AuthorSummaryRaw>(
        authors.map((a) => [a.id, a]),
      );

      const newComments: Comment[] = data.map((c) => {
        const a: AuthorSummaryRaw = authorMap.get(c.authorId);

        return {
          _id: c._id,
          postId: c.postId,
          content: c.content,
          isEdited: c.isEdited,
          updatedAt: c.updatedAt,
          author: {
            userId: a.id,
            name: `${a.first_name} ${a.last_name}`.trim(),
            avatar: a.profile_pic || null,
          },
        };
      });

      setComments((prev) =>
        reset
          ? newComments
          : [...prev, ...newComments].sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime(),
            ),
      );
      setCommentsCursor(nextCursor);
      setHasMoreComments(Boolean(nextCursor));
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Failed to fetch comments. Please try again."),
      );
    } finally {
      setIsLoadingComments(false);
      setIsLoadingMoreComments(false);
    }
  };

  const handleCommentsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (
      !showComments ||
      isLoadingMoreComments ||
      isLoadingComments ||
      !hasMoreComments
    ) {
      return;
    }

    const target = e.currentTarget;
    const threshold = 64;
    const reachedBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < threshold;

    if (reachedBottom) {
      void getComments(post._id);
    }
  };

  const postComment = async (postId: string) => {
    const normalizedComment = commentText.trim();
    if (!normalizedComment || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const payload = { postId, content: normalizedComment };
      const response = await api.post(`/engagement/comments`, payload);
      const { authorId, ...createdComment } = response.data;
      console.log("Comment created:", createdComment);

      const authorResponse = await api.get("/identity/users/summary", {
        params: { users: [authorId] },
        paramsSerializer: { indexes: null },
      });
      const author = authorResponse.data[0];
      console.log("Author info for comment:", author);

      const newComment: Comment = {
        _id: createdComment._id,
        postId: postId,
        content: createdComment.content,
        isEdited: createdComment.isEdited,
        updatedAt: createdComment.updatedAt,
        author: {
          userId: author.id,
          name: `${author.first_name} ${author.last_name}`.trim(),
          avatar: author.profile_pic || null,
        },
      };

      setComments((prev) =>
        [...prev, newComment].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
      );
      setCommentText("");
      setShowComments(true);
      toast.success("Comment added");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Failed to add comment. Please try again."),
      );
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleRepost = async (postId: string, content: string = "") => {
    if (isReposting) return;

    setIsReposting(true);

    try {
      const repostPayload = {
        originalPostId: postId,
        content,
      };

      const response = await api.post(
        "/engagement/posts/repost",
        repostPayload,
      );
      console.log("Repost response:", response.data);

      toast.success("Post reposted");
      await onFeedRefresh({ reset: true });
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Failed to repost. Please try again."),
      );
    } finally {
      setIsReposting(false);
    }
  };

  const handleDelete = async (postId: string, role: UserRole) => {
    console.log("Delete post placeholder:", postId);

    let endpoint: string = "/engagement/posts";
    // If ADMIN: call admin endpoint
    if (role === "ADMIN") endpoint = `${endpoint}/admin/${postId}`;
    // ELSE IF Owner: call regular endpoint
    else if (user.userId === post.author.userId)
      endpoint = `${endpoint}/${postId}`;
    // ELSE: not allowed to delete, show error and return
    else {
      toast.error("You don't have permission to delete this post");
      return;
    }

    try {
      await api.delete(endpoint);
      toast.success("Post deleted");
      await onFeedRefresh({ reset: true });
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Failed to delete post. Please try again."),
      );
    } finally {
      setIsActionConfirmOpen(false);
    }
  };

  const handleReport = async (postId: string) => {
    console.log("Report post placeholder:", postId);
    toast.success("Post reported");
    setIsActionConfirmOpen(false);
  };

  const handleUpdate = async (
    postId: string,
    payload: {
      content: string;
      newFiles: File[];
      remainingImageUrls: string[];
      remainingVideoUrl: string | null;
    },
  ) => {
    const trimmedContent = payload.content.trim();
    const totalMedia =
      payload.remainingImageUrls.length +
      (payload.remainingVideoUrl ? 1 : 0) +
      payload.newFiles.length;

    // Must have content or media
    if (!trimmedContent && totalMedia === 0) {
      toast.error("Post must have content or media.");
      return;
    }

    // Validate: max 5 images
    const newImageFiles = payload.newFiles.filter((f) =>
      f.type.startsWith("image/"),
    );
    const newVideoFiles = payload.newFiles.filter((f) =>
      f.type.startsWith("video/"),
    );
    const totalImages =
      payload.remainingImageUrls.length + newImageFiles.length;
    const totalVideos =
      (payload.remainingVideoUrl ? 1 : 0) + newVideoFiles.length;

    if (totalImages > 0 && totalVideos > 0) {
      toast.error("Cannot have both images and video.");
      return;
    }
    if (totalImages > 5) {
      toast.error("Maximum 5 images allowed.");
      return;
    }
    if (totalVideos > 1) {
      toast.error("Only 1 video allowed.");
      return;
    }

    setIsUpdatingPost(true);

    try {
      const formData = new FormData();
      formData.append("postId", postId);

      // Only send content if it actually changed
      const originalContent = post.content || "";
      if (trimmedContent !== originalContent.trim()) {
        formData.append("content", trimmedContent);
      }

      // Send remaining existing image URLs (backend uses this to know which to keep)
      const originalImages = post.images || [];
      if (payload.remainingImageUrls.length < originalImages.length) {
        if (payload.remainingImageUrls.length === 0)
          formData.append("imageUrls", null);

        payload.remainingImageUrls.forEach((url) => {
          formData.append("imageUrls", url);
        });
      }

      // Send remaining existing video URL
      const originalVideo = post.video || null;
      if (payload.remainingVideoUrl !== originalVideo) {
        formData.append("videoUrl", null);
      }

      // Append new media files
      payload.newFiles.forEach((file) => {
        formData.append("media", file);
      });

      console.log("Updating post with data:");

      await api.patch("/engagement/posts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Post updated successfully!");
      setIsEditPostDialogOpen(false);
      await onFeedRefresh?.({ reset: true });
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Failed to update post. Please try again."),
      );
    } finally {
      setIsUpdatingPost(false);
    }
  };

  const openActionConfirm = (action: PostActionType) => {
    setSelectedAction(action);
    setIsActionConfirmOpen(true);
  };

  const actionDialogContent =
    selectedAction === "delete"
      ? {
          title: "Delete Post",
          description:
            "Are you sure you want to delete this post? This action cannot be undone.",
          confirmText: "Delete",
          variant: "destructive" as const,
          onConfirm: () => handleDelete(post._id, user.role),
        }
      : selectedAction === "adminDelete"
        ? {
            title: "Delete as Admin",
            description:
              "Are you sure you want to delete this post as an admin? This action cannot be undone.",
            confirmText: "Delete",
            variant: "destructive" as const,
            onConfirm: () => handleDelete(post._id, user.role),
          }
        : {
            title: "Report Post",
            description: "Are you sure you want to report this post?",
            confirmText: "Report",
            variant: "default" as const,
            onConfirm: () => handleReport(post._id),
          };

  const openRepostDialog = () => {
    if (isReposting) return;
    setIsRepostChoiceOpen(true);
  };

  const handleSimpleRepost = async () => {
    setIsRepostChoiceOpen(false);
    await handleRepost(post._id);
  };

  const handleOpenRepostThoughts = () => {
    setIsRepostChoiceOpen(false);
    setIsRepostThoughtsOpen(true);
  };

  const handleSubmitRepostThoughts = async () => {
    const normalizedThoughts = repostThoughts.trim();
    if (!normalizedThoughts) {
      toast.error("Please add your thoughts before reposting");
      return;
    }

    await handleRepost(post._id, normalizedThoughts);
    setIsRepostThoughtsOpen(false);
    setRepostThoughts("");
  };

  const PostPreview = ({
    post,
    view,
  }: {
    post: Post;
    view: "inner" | "outer";
  }) => {
    console.log(`Rendering ${view} view for post:`, post);

    const canUpdate =
      Date.now() - new Date(post.createdAt).getTime() < 1 * 60 * 60 * 1000;

    return (
      <div>
        {/* Author Header */}
        <div className="flex items-start justify-between p-4 pb-2">
          <div className="flex gap-3">
            <UserAvatar
              name={post.author.name}
              avatar={post.author.avatar}
              size="md"
              online
            />
            <div>
              <p
                onClick={() => navigate(`profile/${post.author.userId}`)}
                className="text-sm font-semibold text-card-foreground hover:underline cursor-pointer"
              >
                {post.author.name}
              </p>

              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.updatedAt), {
                  addSuffix: true,
                })}{" "}
                {post.isEdited && "(Edited)"}
              </p>
            </div>
          </div>

          {view === "outer" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-52">
                {/* Post Owner Group */}
                {user.userId === post.author.userId && (
                  <>
                    {canUpdate && (
                      <>
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => setIsEditPostDialogOpen(true)}
                            className="gap-2"
                          >
                            <Edit3 className="h-4 w-4" />
                            <span>Update Post</span>
                          </DropdownMenuItem>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />
                      </>
                    )}

                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() => openActionConfirm("delete")}
                        className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Post</span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                )}

                {/* Admin Specific Actions */}
                {user.role === "ADMIN" && (
                  <DropdownMenuItem
                    onClick={() => openActionConfirm("adminDelete")}
                    className="gap-2 font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>Delete as Admin</span>
                  </DropdownMenuItem>
                )}

                {/* Reporting Section */}
                {user.role !== "ADMIN" &&
                  user.userId !== post.author.userId && (
                    <DropdownMenuItem
                      onClick={() => openActionConfirm("report")}
                      className="gap-2"
                    >
                      <Flag className="h-4 w-4" />
                      <span>Report Post</span>
                    </DropdownMenuItem>
                  )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Outer Content */}
        <div className="px-4 py-2">
          <p className="whitespace-pre-line text-sm leading-relaxed text-card-foreground text-justify">
            {hidePost && post.content?.length > MAX_VISIBLE_CHARACTERS ? (
              <>
                {post.content.slice(0, MAX_VISIBLE_CHARACTERS)}...`
                <span
                  className="text-blue-500 hover:underline cursor-pointer"
                  onClick={() => setHidePost(false)}
                >
                  show more
                </span>
              </>
            ) : (
              post.content
            )}
          </p>

          {/* Inner Post Rendering If Any */}
          {post.originalPostId ? (
            <div className="rounded-xl border bg-card shadow-sm">
              <PostPreview post={post.originalPostId} view="inner" />
            </div>
          ) : (
            <>
              {post.images && post.images.length > 0 && (
                <PostGallery images={post.images} />
              )}

              {post.video && (
                <div className="mt-3">
                  <video
                    src={post.video}
                    controls
                    className="w-full rounded-lg border max-h-96 object-cover bg-black"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <article className="rounded-xl border bg-card shadow-sm">
      {/* Header & Content */}
      <PostPreview post={post} view={"outer"} />

      {/* Reaction summary */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        {totalReactions > 0 && (
          <div className="flex items-center gap-1">
            {(Object.entries(reactionCounts) as [ReactionType, number][])
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([type]) => {
                const Icon = reactionConfig[type].icon;
                return (
                  <Icon
                    key={type}
                    className={cn("h-4 w-4", reactionConfig[type].color)}
                  />
                );
              })}
            <span className="ml-1 text-xs text-muted-foreground">
              {totalReactions}
            </span>
          </div>
        )}

        {comments.length > 0 && (
          <button
            onClick={() => setShowComments(!showComments)}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-evenly border-b px-2 py-1 pb-2">
        <ReactionPicker
          onReact={handleReact}
          myReaction={myReaction}
          isReacting={isReacting}
        />

        <button
          onClick={() => handleComment(post._id)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" /> Comment
        </button>

        <button
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={openRepostDialog}
          disabled={isReposting}
        >
          <Repeat2 className="h-4 w-4" />{" "}
          {isReposting ? "Reposting..." : "Repost"}
        </button>
      </div>

      <Dialog
        open={isRepostChoiceOpen}
        onOpenChange={(open) => setIsRepostChoiceOpen(open)}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Repost this post</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <button
              onClick={handleSimpleRepost}
              disabled={isReposting}
              className="w-full rounded-xl border p-4 text-left transition-colors hover:bg-secondary/70 disabled:opacity-60"
            >
              <p className="text-sm font-semibold text-foreground">Repost</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Share this post instantly with your network.
              </p>
            </button>

            <button
              onClick={handleOpenRepostThoughts}
              disabled={isReposting}
              className="w-full rounded-xl border p-4 text-left transition-colors hover:bg-secondary/70 disabled:opacity-60"
            >
              <p className="text-sm font-semibold text-foreground">
                Repost with your thoughts
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add your own context before reposting.
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRepostThoughtsOpen}
        onOpenChange={(open) => {
          setIsRepostThoughtsOpen(open);
          if (!open && !isReposting) {
            setRepostThoughts("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Repost with your thoughts</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Textarea
              value={repostThoughts}
              onChange={(e) => setRepostThoughts(e.target.value)}
              placeholder="Add your thoughts"
              className="min-h-[120px] resize-none"
              maxLength={MAX_ALLOWED_CHARACTERS}
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {repostThoughts.length}/{MAX_ALLOWED_CHARACTERS}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsRepostThoughtsOpen(false);
                    setRepostThoughts("");
                  }}
                  disabled={isReposting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitRepostThoughts}
                  disabled={isReposting || !repostThoughts.trim()}
                >
                  {isReposting ? "Reposting..." : "Repost"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialogBox
        open={isActionConfirmOpen}
        onOpenChange={setIsActionConfirmOpen}
        title={actionDialogContent.title}
        description={actionDialogContent.description}
        confirmText={actionDialogContent.confirmText}
        variant={actionDialogContent.variant}
        onConfirm={actionDialogContent.onConfirm}
      />

      <Dialog
        open={isEditPostDialogOpen}
        onOpenChange={setIsEditPostDialogOpen}
      >
        <PostForm
          title="Update Post"
          initialData={{
            content: post.content || "",
            mediaUrls: [
              ...(post.images || []),
              ...(post.video ? [post.video] : []),
            ],
          }}
          onSubmit={(payload) => handleUpdate(post._id, payload)}
          isSubmitting={isUpdatingPost}
          submitLabel="Update"
        />
      </Dialog>

      {/* Comments */}
      {showComments && (
        <div className="space-y-3 p-4 max-h-98">
          {/* New comment */}
          <div className="flex gap-3">
            <UserAvatar name={user.avatar || user.name} size="sm" />
            <div className="flex flex-1 items-end gap-2">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="min-h-[40px] resize-none rounded-xl bg-secondary text-sm"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    postComment(post._id);
                  }
                }}
              />

              <Button
                size="icon"
                variant="ghost"
                onClick={() => postComment(post._id)}
                disabled={!commentText.trim() || isSubmittingComment}
                title="Post Comment"
                className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            ref={commentsContainerRef}
            onScroll={handleCommentsScroll}
            className="space-y-3 p-4 max-h-96 overflow-y-auto"
          >
            {isLoadingComments && comments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Loading comments...
              </p>
            )}

            {comments.map((c) => (
              <CommentItem key={c._id} comment={c} />
            ))}

            {!isLoadingComments && comments.length === 0 && (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}

            {isLoadingMoreComments && (
              <p className="text-xs text-muted-foreground">
                Loading more comments...
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

const SocialFeedPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const handlePublish = async ({
    content,
    newFiles,
  }: {
    content: string;
    newFiles: File[];
  }) => {
    const normalizedContent = content.trim();

    if (normalizedContent.length > MAX_ALLOWED_CHARACTERS) {
      toast.error(`Content exceeds ${MAX_ALLOWED_CHARACTERS} characters limit`);
      return;
    }

    if (normalizedContent.length === 0 && newFiles.length === 0) {
      toast.error("Post cannot be empty. Please add content or media.");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("content", normalizedContent);
      newFiles.forEach((file) => {
        formData.append("media", file);
      });

      console.log("Publishing post...");
      await api.post("/engagement/posts", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setIsDialogOpen(false);
      fetchPosts({ reset: true });
      toast.success("Post published successfully!");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to publish post"));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPosts = useCallback(
    async (options?: { reset?: boolean }) => {
      const reset = options?.reset ?? false;
      if (isLoading) return;

      const cursorToUse = reset ? null : cursor;
      if (!reset && !cursorToUse) return;

      setIsLoading(true);

      try {
        // Create Parameters
        const params = { cursor: cursorToUse, limit: FEED_PAGE_LIMIT };
        console.log("Fetching posts with params:", params);

        const postResponse = await api.get("/engagement/posts", { params });

        const postsData = postResponse.data.data || [];
        console.log("Fetched posts:", postResponse.data);
        setCursor(postResponse.data.nextCursor ?? null);

        let finalPosts = [];

        if (postsData.length > 0) {
          // 1. Extract IDs from top-level posts AND nested original posts
          const authorIds = new Set<string>();

          postsData.forEach((p) => {
            if (p.authorId) authorIds.add(p.authorId);

            // ✨ Check if there's a populated original post and get its authorId
            if (p.originalPostId && typeof p.originalPostId === "object") {
              authorIds.add(p.originalPostId.authorId);
            }
          });

          // 2. Fetch all unique author summaries in one batch
          const authorResponse = await api.get("/identity/users/summary", {
            params: { users: Array.from(authorIds) },
            paramsSerializer: { indexes: null },
          });

          const authorsList = authorResponse.data || [];

          // Helper to format the author object for the UI
          const mapAuthor = (id: string) => {
            const info = authorsList.find((a) => a.id === id);
            return {
              userId: info?.id,
              name: `${info.first_name} ${info.last_name}`.trim(),
              avatar: info?.profile_pic || null,
            };
          };

          // 3. Merge author info into both layers of the post
          finalPosts = postsData.map((post) => {
            const mergedPost = {
              ...post,
              author: mapAuthor(post.authorId),
            };

            // ✨ If it's a repost, merge author info into the original post too
            if (
              post.originalPostId &&
              typeof post.originalPostId === "object"
            ) {
              mergedPost.originalPostId = {
                ...post.originalPostId,
                author: mapAuthor(post.originalPostId.authorId),
              };
            }

            return mergedPost;
          });
        }

        // 5. Update state
        setPosts((prevPosts) =>
          reset
            ? finalPosts
            : deduplicateById<Post>([...prevPosts, ...finalPosts]).sort(
                (a, b) =>
                  new Date(b.updatedAt).getTime() -
                  new Date(a.updatedAt).getTime(),
              ),
        );
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load posts"));
        console.error("Fetch Error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, cursor],
  );

  // Initial load
  useEffect(() => {
    fetchPosts({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto load next page when the sentinel enters the viewport
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || isLoading || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry?.isIntersecting) {
          fetchPosts();
        }
      },
      {
        root: null,
        rootMargin: "240px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [fetchPosts, isLoading, cursor]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Social Feed</h1>
        <p className="text-sm text-muted-foreground">
          Share updates and engage with the department community
        </p>
      </div>

      {/* Create post trigger */}
      <div className="group rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/20 active:scale-[0.99] cursor-pointer">
        <div className="flex flex-col gap-4">
          {/* Input Row */}
          <div
            className="flex items-center gap-3"
            onClick={() => setIsDialogOpen(true)}
          >
            <div className="relative">
              <UserAvatar name={user.avatar || user.name} size="md" />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-success" />
            </div>

            <div className="flex-1">
              <div className="w-full bg-secondary/40 group-hover:bg-secondary/60 rounded-full py-2.5 px-5 text-sm text-muted-foreground transition-colors font-medium text-left flex items-center justify-between">
                <span>What's on your mind, {user.name}?</span>
                <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
              </div>
            </div>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="flex items-center gap-1 border-t pt-3 mt-1">
            <button
              className="flex flex-1 items-center justify-center gap-2 py-2 rounded-lg hover:bg-secondary/80 transition-colors text-sm font-medium text-muted-foreground hover:text-primary"
              onClick={() => {
                console.log("Future work");
              }}
            >
              <Image className="h-4 w-4 text-blue-500" />
              <span className="hidden sm:inline">Photo</span>
            </button>

            <button
              className="flex flex-1 items-center justify-center gap-2 py-2 rounded-lg hover:bg-secondary/80 transition-colors text-sm font-medium text-muted-foreground hover:text-success"
              onClick={() => {
                console.log("Future work");
              }}
            >
              <Video className="h-4 w-4 text-success" />
              <span className="hidden sm:inline">Video</span>
            </button>

            <button
              className="flex flex-1 items-center justify-center gap-2 py-2 rounded-lg hover:bg-secondary/80 transition-colors text-sm font-medium text-muted-foreground hover:text-orange-500"
              onClick={() => {
                console.log("Future work");
              }}
            >
              <FileText className="h-4 w-4 text-orange-500" />
              <span className="hidden sm:inline">Article</span>
            </button>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <PostForm
          title="Create Post"
          onSubmit={handlePublish}
          isSubmitting={isLoading}
        />
      </Dialog>

      {/* Posts */}
      {isLoading && posts.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-12 w-12" />}
          title="No posts yet"
          description="Be the first to share something with the community!"
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onFeedRefresh={fetchPosts} />
          ))}

          {isLoading && posts.length > 0 && (
            <div className="flex justify-center mt-4">
              <span className="text-sm text-muted-foreground">
                Loading more posts...
              </span>
            </div>
          )}

          {cursor && <div ref={loadMoreRef} className="h-1 w-full" />}
        </div>
      )}
    </div>
  );
};

export default SocialFeedPage;

/* 
Future Work

1. Direct upload photos as new posts.
2. Implement direct video uploads.
3. Implement article creation flow.
4. Implement user tagging and hashtags in posts.
5. Update own comments
6. Delete own comments
7. Delete comments as admin
8. Report comments
*/
