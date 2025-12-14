/**
 * Account Share Models
 * Defines data structures for account sharing functionality
 */

import type { User } from './user.model';

// Access levels for shared accounts
export type AccessLevel = 'view_only' | 'limited' | 'full';

// Status for shares
export type ShareStatus = 'active' | 'revoked' | 'expired';

// Status for invitations
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

// Invitation types
export type InvitationType = 'share' | 'request';

// Activity action types
export type ShareActionType = 'info' | 'warning' | 'security';

// Activity actions
export type ShareAction =
  | 'share_invited'
  | 'share_accepted'
  | 'share_declined'
  | 'share_revoked'
  | 'share_expired'
  | 'access_request_sent'
  | 'access_request_accepted'
  | 'access_request_declined'
  | 'access_used'
  | 'permissions_updated'
  | 'share_renewed';

/**
 * Account Share - Active sharing relationship
 */
export interface AccountShare {
  share_id: string;
  owner_id: string;
  recipient_id: string;
  access_level: AccessLevel;
  custom_permissions?: string[] | null;
  share_name?: string | null;
  share_note?: string | null;
  expires_at?: string | Date | null;
  status: ShareStatus;
  is_active: boolean;
  created_at: string | Date;
  last_updated: string | Date;
  last_accessed?: string | Date | null;
  
  // Populated relations
  owner?: Partial<User>;
  recipient?: Partial<User>;
}

/**
 * Account Share Invitation
 */
export interface AccountShareInvitation {
  invitation_id: string;
  sender_id: string;
  invitation_type: InvitationType;
  recipient_email?: string | null;
  recipient_id?: string | null;
  target_owner_id?: string | null;
  access_level: AccessLevel;
  custom_permissions?: string[] | null;
  invitation_token: string;
  message?: string | null;
  status: InvitationStatus;
  expires_at: string | Date;
  responded_at?: string | Date | null;
  response_note?: string | null;
  created_at: string | Date;
  last_updated: string | Date;
  
  // Populated relations
  sender?: Partial<User>;
  recipient?: Partial<User>;
  targetOwner?: Partial<User>;
}

/**
 * Account Share Activity
 */
export interface AccountShareActivity {
  activity_id: string;
  share_id?: string | null;
  owner_id: string;
  actor_id: string;
  action: ShareAction | string;
  action_type: ShareActionType;
  description: string;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device?: string | null;
  browser?: string | null;
  location?: string | null;
  created_at: string | Date;
  
  // Populated relations
  owner?: Partial<User>;
  actor?: Partial<User>;
  share?: Partial<AccountShare>;
}

/**
 * Input for sending a share invitation
 */
export interface SendShareInvitationInput {
  recipient_email?: string;
  recipient_id?: string;
  access_level?: AccessLevel;
  custom_permissions?: string[];
  message?: string;
  expires_in_days?: number; // How many days until invitation expires (default 7)
}

/**
 * Input for requesting access to an account
 */
export interface RequestAccessInput {
  target_owner_email?: string;
  target_owner_id?: string;
  message?: string;
  requested_access_level?: AccessLevel;
}

/**
 * Input for responding to an invitation
 */
export interface RespondToInvitationInput {
  invitation_token: string;
  accept: boolean;
  response_note?: string;
}

/**
 * Input for updating share settings
 */
export interface UpdateShareInput {
  share_id: string;
  access_level?: AccessLevel;
  custom_permissions?: string[];
  share_name?: string;
  share_note?: string;
  expires_at?: string | null;
}

/**
 * Share statistics for dashboard
 */
export interface ShareStatistics {
  total_shares_owned: number;
  total_shares_received: number;
  active_shares_owned: number;
  active_shares_received: number;
  pending_invitations_sent: number;
  pending_invitations_received: number;
  pending_access_requests: number;
  active_shares: number;
  expired_shares: number;
}

/**
 * Share activity filters
 */
export interface ShareActivityFilters {
  share_id?: string;
  action?: ShareAction;
  action_type?: ShareActionType;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

/**
 * Paginated response for shares
 */
export interface PaginatedShares {
  shares: AccountShare[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Paginated response for invitations
 */
export interface PaginatedInvitations {
  invitations: AccountShareInvitation[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Paginated response for activities
 */
export interface PaginatedActivities {
  activities: AccountShareActivity[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Access level configuration
 */
export const ACCESS_LEVEL_CONFIG: Record<AccessLevel, { label: string; description: string; icon: string; color: string }> = {
  view_only: {
    label: 'View Only',
    description: 'Can only view account information, no modifications allowed',
    icon: 'Eye',
    color: 'blue'
  },
  limited: {
    label: 'Limited Access',
    description: 'Can view and perform limited actions',
    icon: 'Shield',
    color: 'yellow'
  },
  full: {
    label: 'Full Access',
    description: 'Full access to all account features',
    icon: 'Key',
    color: 'green'
  }
};

