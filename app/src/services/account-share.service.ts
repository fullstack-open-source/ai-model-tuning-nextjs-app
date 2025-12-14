/**
 * Account Share Service
 * Handles all account sharing API calls
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory';
import type { ApiService } from '@lib/api/ApiService';
import type {
  AccountShare,
  AccountShareInvitation,
  AccountShareActivity,
  SendShareInvitationInput,
  RequestAccessInput,
  RespondToInvitationInput,
  UpdateShareInput,
  ShareStatistics,
  ShareActivityFilters,
  PaginatedShares,
  PaginatedInvitations,
  PaginatedActivities,
} from '@models/account-share.model';

class AccountShareService {
  private api: ApiService;

  constructor() {
    this.api = createPublicApiService();
  }

  /**
   * Set authenticated API service
   */
  setAuthApi(api: ApiService) {
    this.api = api;
  }

  // ============================================
  // SHARES - Active sharing relationships
  // ============================================

  /**
   * Get shares I've given to others (accounts I'm sharing)
   */
  async getSharesOwned(options?: {
    status?: 'active' | 'revoked' | 'expired' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<PaginatedShares> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const response = await this.api.get<{ data: PaginatedShares }>(
      `/account-shares/owned?${params}`
    );
    return response.data;
  }

  /**
   * Get shares I've received (accounts shared with me)
   */
  async getSharesReceived(options?: {
    status?: 'active' | 'revoked' | 'expired' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<PaginatedShares> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const response = await this.api.get<{ data: PaginatedShares }>(
      `/account-shares/received?${params}`
    );
    return response.data;
  }

  /**
   * Get a specific share by ID
   */
  async getShare(shareId: string): Promise<AccountShare> {
    const response = await this.api.get<{ data: { share: AccountShare } }>(
      `/account-shares/${shareId}`
    );
    return response.data.share;
  }

  /**
   * Update share settings (access level, permissions, etc.)
   */
  async updateShare(data: UpdateShareInput): Promise<AccountShare> {
    const { share_id, ...updateData } = data;
    const response = await this.api.put<{ data: { share: AccountShare } }>(
      `/account-shares/${share_id}`,
      updateData
    );
    return response.data.share;
  }

  /**
   * Revoke a share (as owner)
   */
  async revokeShare(shareId: string): Promise<void> {
    await this.api.delete<unknown>(`/account-shares/${shareId}`);
  }

  /**
   * Leave a shared account (as the user who received the share)
   */
  async leaveShare(shareId: string): Promise<void> {
    await this.api.post<unknown>(`/account-shares/${shareId}/leave`, {});
  }

  // ============================================
  // INVITATIONS - Sending and receiving invitations
  // ============================================

  /**
   * Send a share invitation to another user
   */
  async sendInvitation(data: SendShareInvitationInput): Promise<AccountShareInvitation> {
    const response = await this.api.post<{ data: { invitation: AccountShareInvitation } }>(
      '/account-shares/invitations',
      data
    );
    return response.data.invitation;
  }

  /**
   * Get invitations I've sent
   */
  async getInvitationsSent(options?: {
    status?: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<PaginatedInvitations> {
    const params = new URLSearchParams();
    params.append('type', 'sent');
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const response = await this.api.get<{ data: PaginatedInvitations }>(
      `/account-shares/invitations?${params}`
    );
    return response.data;
  }

  /**
   * Get invitations I've received
   */
  async getInvitationsReceived(options?: {
    status?: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<PaginatedInvitations> {
    const params = new URLSearchParams();
    params.append('type', 'received');
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const response = await this.api.get<{ data: PaginatedInvitations }>(
      `/account-shares/invitations?${params}`
    );
    return response.data;
  }

  /**
   * Get invitation by token (for accept/decline page)
   */
  async getInvitationByToken(token: string): Promise<AccountShareInvitation> {
    const response = await this.api.get<{ data: { invitation: AccountShareInvitation } }>(
      `/account-shares/invitations/token/${token}`
    );
    return response.data.invitation;
  }

  /**
   * Respond to an invitation (accept or decline)
   */
  async respondToInvitation(data: RespondToInvitationInput): Promise<{ share?: AccountShare; message: string }> {
    const response = await this.api.post<{ data: { share?: AccountShare; message: string } }>(
      '/account-shares/invitations/respond',
      data
    );
    return response.data;
  }

  /**
   * Cancel a sent invitation
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    await this.api.delete<unknown>(`/account-shares/invitations/${invitationId}`);
  }

  /**
   * Resend invitation email
   */
  async resendInvitation(invitationId: string): Promise<void> {
    await this.api.post<unknown>(`/account-shares/invitations/${invitationId}/resend`, {});
  }

  // ============================================
  // ACCESS REQUESTS - Request access to someone's account
  // ============================================

  /**
   * Request access to another user's account
   */
  async requestAccess(data: RequestAccessInput): Promise<AccountShareInvitation> {
    const response = await this.api.post<{ data: { invitation: AccountShareInvitation } }>(
      '/account-shares/request-access',
      data
    );
    return response.data.invitation;
  }

  /**
   * Get access requests I've sent
   */
  async getAccessRequestsSent(options?: {
    status?: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<PaginatedInvitations> {
    const params = new URLSearchParams();
    params.append('invitation_type', 'request');
    params.append('direction', 'sent');
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const response = await this.api.get<{ data: PaginatedInvitations }>(
      `/account-shares/invitations?${params}`
    );
    return response.data;
  }

  /**
   * Get access requests I've received (from others wanting access to my account)
   */
  async getAccessRequestsReceived(options?: {
    status?: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<PaginatedInvitations> {
    const params = new URLSearchParams();
    params.append('invitation_type', 'request');
    params.append('direction', 'received');
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const response = await this.api.get<{ data: PaginatedInvitations }>(
      `/account-shares/invitations?${params}`
    );
    return response.data;
  }

  /**
   * Respond to an access request (as account owner)
   */
  async respondToAccessRequest(data: RespondToInvitationInput & { access_level?: string }): Promise<{ share?: AccountShare; message: string }> {
    const response = await this.api.post<{ data: { share?: AccountShare; message: string } }>(
      '/account-shares/invitations/respond',
      data
    );
    return response.data;
  }

  // ============================================
  // ACTIVITY - Activity logs for shared accounts
  // ============================================

  /**
   * Get activity for my account shares (as owner)
   */
  async getMyShareActivity(filters?: ShareActivityFilters): Promise<PaginatedActivities> {
    const params = new URLSearchParams();
    if (filters?.share_id) params.append('share_id', filters.share_id);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.action_type) params.append('action_type', filters.action_type);
    if (filters?.from_date) params.append('from_date', filters.from_date);
    if (filters?.to_date) params.append('to_date', filters.to_date);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const response = await this.api.get<{ data: PaginatedActivities }>(
      `/account-shares/activity?${params}`
    );
    return response.data;
  }

  /**
   * Get activity for a specific share
   */
  async getShareActivity(shareId: string, filters?: ShareActivityFilters): Promise<PaginatedActivities> {
    const params = new URLSearchParams();
    if (filters?.action) params.append('action', filters.action);
    if (filters?.action_type) params.append('action_type', filters.action_type);
    if (filters?.from_date) params.append('from_date', filters.from_date);
    if (filters?.to_date) params.append('to_date', filters.to_date);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const response = await this.api.get<{ data: PaginatedActivities }>(
      `/account-shares/${shareId}/activity?${params}`
    );
    return response.data;
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get share statistics for current user
   */
  async getStatistics(): Promise<ShareStatistics> {
    const response = await this.api.get<{ data: ShareStatistics }>(
      '/account-shares/statistics'
    );
    return response.data;
  }

  // ============================================
  // SEARCH
  // ============================================

  /**
   * Search users to share with (by email or username)
   */
  async searchUsers(query: string): Promise<Array<{ user_id: string; email: string; user_name?: string; full_name?: string; profile_picture_url?: string }>> {
    const response = await this.api.get<{ data: { users: Array<{ user_id: string; email: string; user_name?: string; full_name?: string; profile_picture_url?: string }> } }>(
      `/account-shares/search-users?q=${encodeURIComponent(query)}`
    );
    return response.data.users;
  }
}

export const accountShareService = new AccountShareService();

