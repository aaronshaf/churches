import type { FC } from 'hono/jsx';
import { getGravatarUrl } from '../utils/crypto';

type Comment = {
  id: number;
  content: string;
  type?: 'user' | 'system';
  metadata?: string;
  createdAt: Date;
  userName?: string;
  userEmail: string;
  userImage?: string;
  userId: string;
  isOwn: boolean;
};

type ChurchCommentsProps = {
  churchId: number;
  churchName: string;
  churchPath: string;
  comments: Comment[];
  user?: {
    id: string;
    name?: string;
    email: string;
    role: 'admin' | 'contributor' | 'user';
  };
};

export const ChurchComments: FC<ChurchCommentsProps> = ({ churchId, churchPath, comments, user }) => {
  // Only show comments section for logged-in users
  if (!user) {
    return null;
  }

  const canSeeAllComments = user && (user.role === 'admin' || user.role === 'contributor');
  const visibleComments = canSeeAllComments ? comments : comments.filter((comment) => comment.isOwn);

  // Don't show anything if there are no visible comments
  if (visibleComments.length === 0) {
    return null;
  }

  return (
    <div class="space-y-6" data-testid="church-comments">
      {/* Header */}
      <div class="flex items-center justify-between" data-testid="comments-header">
        <div>
          <h3 class="text-lg font-semibold text-gray-900" data-testid="comments-title">
            {canSeeAllComments ? 'Feedback' : 'My Notes'}
          </h3>
          <p class="text-sm text-gray-600 mt-0.5">
            {canSeeAllComments ? 'Private comments from community members' : 'Your personal notes about this church'}
          </p>
        </div>
        {visibleComments.length > 0 && (
          <span
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
            data-testid="comments-count"
          >
            {visibleComments.length} {visibleComments.length === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </div>

      {/* Comments List */}
      {visibleComments.length > 0 && (
        <div class="space-y-3" data-testid="comments-list">
          {visibleComments.map((comment, index) => (
            <div key={comment.id} class="group" data-testid={`comment-${index}`}>
              <div
                class="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow"
                data-testid={`comment-container-${index}`}
              >
                <div class="flex items-start space-x-3">
                  {/* Avatar */}
                  <div class="flex-shrink-0">
                    {comment.userImage ? (
                      <img
                        src={comment.userImage}
                        alt={comment.userName || comment.userEmail}
                        class="w-9 h-9 rounded-full object-cover border border-gray-200"
                        onerror={`this.src='${getGravatarUrl(comment.userEmail, 36)}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';}`}
                      />
                    ) : (
                      <img
                        src={getGravatarUrl(comment.userEmail, 36)}
                        alt={comment.userName || comment.userEmail}
                        class="w-9 h-9 rounded-full object-cover border border-gray-200"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
                      />
                    )}
                    <div
                      class="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 hidden items-center justify-center"
                      style="display: none;"
                    >
                      <span class="text-sm font-semibold text-white">
                        {comment.userName
                          ? comment.userName.charAt(0).toUpperCase()
                          : comment.userEmail.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center space-x-2">
                        <p class="text-sm font-medium text-gray-900" data-testid={`comment-author-${index}`}>
                          {comment.userName || comment.userEmail.split('@')[0]}
                        </p>
                        {comment.isOwn && (
                          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-800">
                            You
                          </span>
                        )}
                        {comment.type === 'system' && (
                          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800">
                            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Change Log
                          </span>
                        )}
                        {canSeeAllComments && !comment.isOwn && comment.type !== 'system' && (
                          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            Member
                          </span>
                        )}
                      </div>
                      <div class="flex items-center space-x-3">
                        <time class="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year:
                              new Date(comment.createdAt).getFullYear() !== new Date().getFullYear()
                                ? 'numeric'
                                : undefined,
                          })}
                        </time>
                        {user.role === 'admin' && (
                          <div class="border-l border-gray-300 pl-3">
                            <form
                              method="post"
                              action={`/churches/${churchPath}/comments/${comment.id}/delete`}
                              class="inline"
                            >
                              <button
                                type="submit"
                                onclick="return confirm('Are you sure you want to delete this comment?')"
                                class="text-xs text-red-600 hover:text-red-800 focus:outline-none transition-colors font-medium"
                                title="Delete comment"
                                data-testid={`delete-comment-${index}`}
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                    <div class="prose prose-sm max-w-none">
                      {comment.type === 'system' ? (
                        <div class="text-gray-700 text-sm" data-testid={`comment-content-${index}`}>
                          <div
                            class={`comment-content ${comment.content.length > 500 ? 'comment-truncate' : ''}`}
                            data-comment-id={comment.id}
                            dangerouslySetInnerHTML={{
                              __html: comment.content
                                .replace(/```yaml\n([\s\S]*?)```/g, (_match, p1) => {
                                  return `<pre class="bg-gray-50 p-3 rounded-lg overflow-x-auto mt-2 text-xs font-mono">${p1.trim()}</pre>`;
                                })
                                .replace(/\n/g, '<br>'),
                            }}
                          />
                          {comment.content.length > 500 && (
                            <button
                              type="button"
                              class="mt-2 text-sm font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus:underline"
                              onclick={`toggleComment(${comment.id})`}
                              data-testid={`toggle-comment-${comment.id}`}
                            >
                              <span class="expand-text">Show more</span>
                              <span class="collapse-text hidden">Show less</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div class="text-gray-700" data-testid={`comment-content-${index}`}>
                          <p
                            class={`leading-relaxed whitespace-pre-wrap comment-content ${comment.content.length > 500 ? 'comment-truncate' : ''}`}
                            data-comment-id={comment.id}
                          >
                            {comment.content}
                          </p>
                          {comment.content.length > 500 && (
                            <button
                              type="button"
                              class="mt-2 text-sm font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus:underline"
                              onclick={`toggleComment(${comment.id})`}
                              data-testid={`toggle-comment-${comment.id}`}
                            >
                              <span class="expand-text">Show more</span>
                              <span class="collapse-text hidden">Show less</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .comment-truncate {
            max-height: 150px;
            overflow: hidden;
            position: relative;
          }
          
          .comment-truncate::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 50px;
            background: linear-gradient(to bottom, transparent, white);
          }
          
          .comment-content.expanded {
            max-height: none;
          }
          
          .comment-content.expanded::after {
            display: none;
          }
        `,
        }}
      />

      <script
        dangerouslySetInnerHTML={{
          __html: `
          function toggleComment(commentId) {
            const content = document.querySelector('[data-comment-id="' + commentId + '"]');
            const button = event.target.closest('button');
            const expandText = button.querySelector('.expand-text');
            const collapseText = button.querySelector('.collapse-text');
            
            if (content.classList.contains('expanded')) {
              content.classList.remove('expanded');
              expandText.classList.remove('hidden');
              collapseText.classList.add('hidden');
            } else {
              content.classList.add('expanded');
              expandText.classList.add('hidden');
              collapseText.classList.remove('hidden');
            }
          }
        `,
        }}
      />
    </div>
  );
};
